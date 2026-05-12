import { createMemo, createSignal, Show } from 'solid-js'
import { render } from 'solid-js/web'
import '../index.css'
import { PageLayout } from '../components/PageLayout'
import { BooleanField } from '../components/BooleanField'
import { NumberSlider, OptionalNumberSlider } from '../components/NumberSlider'
import { PresetSelect } from '../components/PresetSelect'
import { SelectField } from '../components/SelectField'
import { SidebarSection } from '../components/SidebarSection'
import { useGeometry } from '../hooks/useGeometry'
import { createUrlSync, UrlSyncContext } from '../hooks/urlSync'
import { attribution, EP_WALL_MIN, OUTER_R } from '../models/gridfinity-baseplate'
import { BED_OPTIONS } from '../printBed'
import styles from './gridfinity-baseplate.module.css'

const CELL = 42

const LS_KEY = 'persistent-params'
function readLS<T>(key: string, def: T): T {
  try { const v = JSON.parse(localStorage.getItem(LS_KEY) ?? '{}')[key]; return v === undefined ? def : v as T } catch { return def }
}
function writeLS(key: string, value: unknown) {
  try { const s = JSON.parse(localStorage.getItem(LS_KEY) ?? '{}'); localStorage.setItem(LS_KEY, JSON.stringify({ ...s, [key]: value })) } catch {}
}

const sp = new URLSearchParams(window.location.search)
function urlNum(key: string, def: number) { const v = sp.get(key); return v !== null ? parseFloat(v) : def }
function urlBool(key: string, def: boolean) { const v = sp.get(key); return v !== null ? v === 'true' : def }
function urlStr(key: string, def: string) { return sp.get(key) ?? def }
function urlOptNum(key: string, def: number | null) {
  const v = sp.get(key)
  if (v === null) return def
  if (v === 'null') return null
  return parseFloat(v)
}

function GridfinityBaseplatePage() {
  const halfords = {
    cells_x: 13, cells_y: 9,
    edge_n: 'wall', edge_s: 'wall', edge_e: 'wall', edge_w: 'wall',
    wall_n: 12.5, wall_s: 12.5, wall_e: 11, wall_w: 11,
    separate_walls: false, wall_connector: 'wall_male', corner_style: 'corner_l',
    corner_radius_sw: 2.5, corner_radius_se: 2.5, corner_radius_ne: 0, corner_radius_nw: 0,
    base_style: 'open', magnets: false,
  }

  const [cellsX, setCellsX] = createSignal(urlNum('cells_x', halfords.cells_x))
  const [cellsY, setCellsY] = createSignal(urlNum('cells_y', halfords.cells_y))
  const [wallN, setWallN] = createSignal<number | null>(urlOptNum('wall_n', halfords.wall_n))
  const [wallS, setWallS] = createSignal<number | null>(urlOptNum('wall_s', halfords.wall_s))
  const [wallE, setWallE] = createSignal<number | null>(urlOptNum('wall_e', halfords.wall_e))
  const [wallW, setWallW] = createSignal<number | null>(urlOptNum('wall_w', halfords.wall_w))
  const [edgeN, setEdgeN] = createSignal(urlStr('edge_n', halfords.edge_n))
  const [edgeS, setEdgeS] = createSignal(urlStr('edge_s', halfords.edge_s))
  const [edgeE, setEdgeE] = createSignal(urlStr('edge_e', halfords.edge_e))
  const [edgeW, setEdgeW] = createSignal(urlStr('edge_w', halfords.edge_w))
  const [separateWalls, setSeparateWalls] = createSignal(urlBool('separate_walls', halfords.separate_walls))
  const [wallConnector, setWallConnector] = createSignal(urlStr('wall_connector', halfords.wall_connector))
  const [cornerStyle, setCornerStyle] = createSignal(urlStr('corner_style', halfords.corner_style))
  const [cornerSW, setCornerSW] = createSignal(urlNum('corner_radius_sw', halfords.corner_radius_sw))
  const [cornerSE, setCornerSE] = createSignal(urlNum('corner_radius_se', halfords.corner_radius_se))
  const [cornerNE, setCornerNE] = createSignal(urlNum('corner_radius_ne', halfords.corner_radius_ne))
  const [cornerNW, setCornerNW] = createSignal(urlNum('corner_radius_nw', halfords.corner_radius_nw))
  const [baseStyle, setBaseStyle] = createSignal(urlStr('base_style', halfords.base_style))
  const [magnets, setMagnets] = createSignal(urlBool('magnets', halfords.magnets))

  // Print bed params — stored in localStorage, not URL
  const [restrictBed, _setRestrictBed] = createSignal(readLS('restrict_bed', false))
  const setRestrictBed = (v: boolean) => { _setRestrictBed(v); writeLS('restrict_bed', v) }
  const [bedType, _setBedType] = createSignal(readLS('bed_type', 'prusa_core_one'))
  const setBedType = (v: string) => { _setBedType(v); writeLS('bed_type', v) }
  const [bedX, _setBedX] = createSignal(readLS('bed_x', 250))
  const setBedX = (v: number) => { _setBedX(v); writeLS('bed_x', v) }
  const [bedY, _setBedY] = createSignal(readLS('bed_y', 220))
  const setBedY = (v: number) => { _setBedY(v); writeLS('bed_y', v) }

  const hasWalls = createMemo(() => wallN() !== null || wallS() !== null || wallE() !== null || wallW() !== null)
  const hasCorner = createMemo(() =>
    ((wallN() !== null) && (wallE() !== null || wallW() !== null)) ||
    ((wallS() !== null) && (wallE() !== null || wallW() !== null))
  )
  const wallMin = createMemo(() => separateWalls() && wallConnector() === 'wall_female' ? EP_WALL_MIN : 0)

  const info = createMemo(() => {
    const wN = restrictBed() || edgeN() === 'wall' ? (wallN() ?? 0) : 0
    const wS = restrictBed() || edgeS() === 'wall' ? (wallS() ?? 0) : 0
    const wE = restrictBed() || edgeE() === 'wall' ? (wallE() ?? 0) : 0
    const wW = restrictBed() || edgeW() === 'wall' ? (wallW() ?? 0) : 0
    const w = cellsX() * CELL + wW + wE
    const d = cellsY() * CELL + wN + wS
    return `${w} × ${d} mm assembled`
  })

  const params = createMemo(() => ({
    cells_x: cellsX(), cells_y: cellsY(),
    edge_n: edgeN(), edge_s: edgeS(), edge_e: edgeE(), edge_w: edgeW(),
    wall_n: wallN(), wall_s: wallS(), wall_e: wallE(), wall_w: wallW(),
    separate_walls: separateWalls(), wall_connector: wallConnector(),
    corner_style: cornerStyle(),
    corner_radius_sw: cornerSW(), corner_radius_se: cornerSE(),
    corner_radius_ne: cornerNE(), corner_radius_nw: cornerNW(),
    base_style: baseStyle(), magnets: magnets(),
    restrict_bed: restrictBed(), bed_type: bedType(), bed_x: bedX(), bed_y: bedY(),
  }))

  const { geometry, pieces, rendering, selectedPiece, setSelectedPiece, download } = useGeometry('gridfinity-baseplate', params)

  const setUrl = createUrlSync()

  const [presetSel, setPresetSel] = createSignal('halfords')
  const [presetParams, setPresetParams] = createSignal<typeof halfords | null>(halfords)
  const isDirty = createMemo(() => {
    const p = presetParams()
    if (!p) return false
    return cellsX() !== p.cells_x || cellsY() !== p.cells_y ||
      edgeN() !== p.edge_n || edgeS() !== p.edge_s || edgeE() !== p.edge_e || edgeW() !== p.edge_w ||
      wallN() !== p.wall_n || wallS() !== p.wall_s || wallE() !== p.wall_e || wallW() !== p.wall_w ||
      separateWalls() !== p.separate_walls || wallConnector() !== p.wall_connector || cornerStyle() !== p.corner_style ||
      cornerSW() !== p.corner_radius_sw || cornerSE() !== p.corner_radius_se ||
      cornerNE() !== p.corner_radius_ne || cornerNW() !== p.corner_radius_nw ||
      baseStyle() !== p.base_style || magnets() !== p.magnets
  })
  const applyPreset = (p: typeof halfords) => {
    setCellsX(p.cells_x); setCellsY(p.cells_y)
    setEdgeN(p.edge_n); setEdgeS(p.edge_s); setEdgeE(p.edge_e); setEdgeW(p.edge_w)
    setWallN(p.wall_n); setWallS(p.wall_s); setWallE(p.wall_e); setWallW(p.wall_w)
    setSeparateWalls(p.separate_walls); setWallConnector(p.wall_connector); setCornerStyle(p.corner_style)
    setCornerSW(p.corner_radius_sw); setCornerSE(p.corner_radius_se)
    setCornerNE(p.corner_radius_ne); setCornerNW(p.corner_radius_nw)
    setBaseStyle(p.base_style); setMagnets(p.magnets)
  }
  const onPresetChange = (v: string) => {
    setPresetSel(v)
    const p = v === 'halfords' ? halfords : null
    setPresetParams(p)
    if (p) applyPreset(p)
  }

  return (
    <UrlSyncContext.Provider value={setUrl}>
      <PageLayout
        title="Gridfinity Baseplate"
        attribution={attribution}
        geometry={geometry}
        pieces={pieces}
        selectedPiece={selectedPiece}
        onPieceClick={setSelectedPiece}
        rendering={rendering}
        header={
          <div>
            <PresetSelect
              value={presetSel()}
              onChange={onPresetChange}
              options={[{ value: 'halfords', label: 'Halfords 3 Drawer Middle Chest (13×9)' }]}
              dirty={!!presetParams() && isDirty()}
              onResetAll={() => applyPreset(presetParams()!)}
            />
            <p class={styles.info}>{info()}</p>
          </div>
        }
        footer={
          <Show
            when={selectedPiece() >= 0 && pieces()}
            fallback={
              <button onClick={() => download()} class={styles.downloadBtn}>Download STL</button>
            }
          >
            <button onClick={() => download(selectedPiece())} class={styles.downloadBtn}>
              Download {pieces()?.[selectedPiece()]?.label} STL
            </button>
          </Show>
        }
      >
        <SidebarSection label="Print bed" defaultOpen checked={restrictBed} onCheckedChange={setRestrictBed}>
          <SelectField label="Printer" value={bedType()} onChange={setBedType} options={BED_OPTIONS} />
          <Show when={bedType() === 'custom'}>
            <NumberSlider label="Bed X (mm)" value={bedX()} onChange={setBedX} min={42} max={500} />
            <NumberSlider label="Bed Y (mm)" value={bedY()} onChange={setBedY} min={42} max={500} />
          </Show>
        </SidebarSection>
        <SidebarSection label="Style" defaultOpen>
          <SelectField label="Base style" value={baseStyle()} onChange={setBaseStyle} default={presetParams()?.base_style} urlKey="base_style" options={[
            { value: 'solid', label: 'Solid' },
            { value: 'open', label: 'Open' },
          ]} />
          <Show when={baseStyle() === 'solid'}>
            <BooleanField label="Magnet pockets" value={magnets()} onChange={setMagnets} default={presetParams()?.magnets} urlKey="magnets" />
          </Show>
        </SidebarSection>
        <SidebarSection label="Size" defaultOpen>
          <NumberSlider label="Width (cells)" value={cellsX()} onChange={setCellsX} min={1} max={20} default={presetParams()?.cells_x} urlKey="cells_x" />
          <NumberSlider label="Depth (cells)" value={cellsY()} onChange={setCellsY} min={1} max={20} default={presetParams()?.cells_y} urlKey="cells_y" />
        </SidebarSection>
        <SidebarSection label="Corners" defaultOpen>
          <p class={styles.cornerLabel}>Radius (mm)</p>
          <div class={styles.cornerGrid}>
            <NumberSlider label="NW" value={cornerNW()} onChange={setCornerNW} min={0} max={OUTER_R} step={0.5} default={presetParams()?.corner_radius_nw} urlKey="corner_radius_nw" />
            <NumberSlider label="NE" value={cornerNE()} onChange={setCornerNE} min={0} max={OUTER_R} step={0.5} default={presetParams()?.corner_radius_ne} urlKey="corner_radius_ne" />
            <NumberSlider label="SW" value={cornerSW()} onChange={setCornerSW} min={0} max={OUTER_R} step={0.5} default={presetParams()?.corner_radius_sw} urlKey="corner_radius_sw" />
            <NumberSlider label="SE" value={cornerSE()} onChange={setCornerSE} min={0} max={OUTER_R} step={0.5} default={presetParams()?.corner_radius_se} urlKey="corner_radius_se" />
          </div>
        </SidebarSection>
        <SidebarSection label="Walls" defaultOpen>
          <Show when={restrictBed() && hasWalls()}>
            <BooleanField
              label="Print walls separately"
              value={separateWalls()}
              onChange={setSeparateWalls}
              default={presetParams()?.separate_walls}
              urlKey="separate_walls"
              description="Recommended when designing a plate for a new product — if measurements are off, only the walls need reprinting."
            />
          </Show>
          <Show when={restrictBed() && separateWalls() && hasWalls()}>
            <SelectField label="Wall connector" value={wallConnector()} onChange={setWallConnector} default={presetParams()?.wall_connector} urlKey="wall_connector" options={[
              { value: 'wall_male',   label: 'Male on wall' },
              { value: 'wall_female', label: 'Female on wall' },
            ]} />
          </Show>
          <Show when={restrictBed() && separateWalls() && hasCorner()}>
            <SelectField label="Corner style" value={cornerStyle()} onChange={setCornerStyle} default={presetParams()?.corner_style} urlKey="corner_style" options={[
              { value: 'corner_l',   label: 'L-shaped' },
              { value: 'corner_cw',  label: 'Clockwise' },
              { value: 'corner_ccw', label: 'Anti-clockwise' },
              { value: 'corner_ns',  label: 'Included in N/S walls' },
              { value: 'corner_ew',  label: 'Included in E/W walls' },
            ]} />
          </Show>
          <Show when={!restrictBed()}>
            <SelectField label="North edge" value={edgeN()} onChange={setEdgeN} default={presetParams()?.edge_n} urlKey="edge_n" options={[
              { value: 'wall', label: 'Wall' }, { value: 'male', label: 'Male connector' }, { value: 'female', label: 'Female connector' },
            ]} />
            <SelectField label="South edge" value={edgeS()} onChange={setEdgeS} default={presetParams()?.edge_s} urlKey="edge_s" options={[
              { value: 'wall', label: 'Wall' }, { value: 'male', label: 'Male connector' }, { value: 'female', label: 'Female connector' },
            ]} />
            <SelectField label="East edge" value={edgeE()} onChange={setEdgeE} default={presetParams()?.edge_e} urlKey="edge_e" options={[
              { value: 'wall', label: 'Wall' }, { value: 'male', label: 'Male connector' }, { value: 'female', label: 'Female connector' },
            ]} />
            <SelectField label="West edge" value={edgeW()} onChange={setEdgeW} default={presetParams()?.edge_w} urlKey="edge_w" options={[
              { value: 'wall', label: 'Wall' }, { value: 'male', label: 'Male connector' }, { value: 'female', label: 'Female connector' },
            ]} />
          </Show>
          <Show when={restrictBed() || edgeN() === 'wall'}>
            <OptionalNumberSlider label="North (mm)" value={wallN()} onChange={setWallN} min={wallMin()} max={40} step={0.5} default={presetParams()?.wall_n} urlKey="wall_n" />
          </Show>
          <Show when={restrictBed() || edgeS() === 'wall'}>
            <OptionalNumberSlider label="South (mm)" value={wallS()} onChange={setWallS} min={wallMin()} max={40} step={0.5} default={presetParams()?.wall_s} urlKey="wall_s" />
          </Show>
          <Show when={restrictBed() || edgeE() === 'wall'}>
            <OptionalNumberSlider label="East (mm)"  value={wallE()} onChange={setWallE} min={wallMin()} max={40} step={0.5} default={presetParams()?.wall_e} urlKey="wall_e" />
          </Show>
          <Show when={restrictBed() || edgeW() === 'wall'}>
            <OptionalNumberSlider label="West (mm)"  value={wallW()} onChange={setWallW} min={wallMin()} max={40} step={0.5} default={presetParams()?.wall_w} urlKey="wall_w" />
          </Show>
        </SidebarSection>
      </PageLayout>
    </UrlSyncContext.Provider>
  )
}

render(() => <GridfinityBaseplatePage />, document.getElementById('root')!)
