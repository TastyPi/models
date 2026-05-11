import { createEffect, createMemo, createSignal, Show } from 'solid-js'
import { render } from 'solid-js/web'
import '../index.css'
import { PageLayout } from '../components/PageLayout'
import { BooleanField } from '../components/BooleanField'
import { NumberSlider, OptionalNumberSlider } from '../components/NumberSlider'
import { SelectField } from '../components/SelectField'
import { SidebarSection } from '../components/SidebarSection'
import { useGeometry } from '../hooks/useGeometry'
import { attribution, EP_WALL_MIN, OUTER_R } from '../models/gridfinity-baseplate'
import { BED_OPTIONS } from '../printBed'

const CELL = 42

const LS_KEY = 'persistent-params'
function readLS<T>(key: string, def: T): T {
  try { const v = JSON.parse(localStorage.getItem(LS_KEY) ?? '{}')[key]; return v === undefined ? def : v as T } catch { return def }
}
function writeLS(key: string, value: unknown) {
  try { const s = JSON.parse(localStorage.getItem(LS_KEY) ?? '{}'); localStorage.setItem(LS_KEY, JSON.stringify({ ...s, [key]: value })) } catch {}
}

const PRESET = {
  cells_x: 13, cells_y: 9,
  edge_n: 'wall', edge_s: 'wall', edge_e: 'wall', edge_w: 'wall',
  wall_n: 12.5, wall_s: 12.5, wall_e: 11, wall_w: 11,
  separate_walls: false, wall_connector: 'wall_male', corner_style: 'corner_l',
  corner_radius: 0, base_style: 'open', magnets: false,
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
  const [cellsX, setCellsX] = createSignal(urlNum('cells_x', PRESET.cells_x))
  const [cellsY, setCellsY] = createSignal(urlNum('cells_y', PRESET.cells_y))
  const [wallN, setWallN] = createSignal<number | null>(urlOptNum('wall_n', PRESET.wall_n))
  const [wallS, setWallS] = createSignal<number | null>(urlOptNum('wall_s', PRESET.wall_s))
  const [wallE, setWallE] = createSignal<number | null>(urlOptNum('wall_e', PRESET.wall_e))
  const [wallW, setWallW] = createSignal<number | null>(urlOptNum('wall_w', PRESET.wall_w))
  const [edgeN, setEdgeN] = createSignal(urlStr('edge_n', PRESET.edge_n))
  const [edgeS, setEdgeS] = createSignal(urlStr('edge_s', PRESET.edge_s))
  const [edgeE, setEdgeE] = createSignal(urlStr('edge_e', PRESET.edge_e))
  const [edgeW, setEdgeW] = createSignal(urlStr('edge_w', PRESET.edge_w))
  const [separateWalls, setSeparateWalls] = createSignal(urlBool('separate_walls', PRESET.separate_walls))
  const [wallConnector, setWallConnector] = createSignal(urlStr('wall_connector', PRESET.wall_connector))
  const [cornerStyle, setCornerStyle] = createSignal(urlStr('corner_style', PRESET.corner_style))
  const [cornerRadius, setCornerRadius] = createSignal(urlNum('corner_radius', PRESET.corner_radius))
  const [baseStyle, setBaseStyle] = createSignal(urlStr('base_style', PRESET.base_style))
  const [magnets, setMagnets] = createSignal(urlBool('magnets', PRESET.magnets))

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
    corner_style: cornerStyle(), corner_radius: cornerRadius(),
    base_style: baseStyle(), magnets: magnets(),
    restrict_bed: restrictBed(), bed_type: bedType(), bed_x: bedX(), bed_y: bedY(),
  }))

  const { geometry, pieces, rendering, selectedPiece, setSelectedPiece, download } = useGeometry('gridfinity-baseplate', params)

  createEffect(() => {
    const urlParams = new URLSearchParams()
    if (cellsX() !== PRESET.cells_x) urlParams.set('cells_x', String(cellsX()))
    if (cellsY() !== PRESET.cells_y) urlParams.set('cells_y', String(cellsY()))
    if (edgeN() !== PRESET.edge_n) urlParams.set('edge_n', edgeN())
    if (edgeS() !== PRESET.edge_s) urlParams.set('edge_s', edgeS())
    if (edgeE() !== PRESET.edge_e) urlParams.set('edge_e', edgeE())
    if (edgeW() !== PRESET.edge_w) urlParams.set('edge_w', edgeW())
    if (wallN() !== PRESET.wall_n) urlParams.set('wall_n', wallN() === null ? 'null' : String(wallN()))
    if (wallS() !== PRESET.wall_s) urlParams.set('wall_s', wallS() === null ? 'null' : String(wallS()))
    if (wallE() !== PRESET.wall_e) urlParams.set('wall_e', wallE() === null ? 'null' : String(wallE()))
    if (wallW() !== PRESET.wall_w) urlParams.set('wall_w', wallW() === null ? 'null' : String(wallW()))
    if (separateWalls() !== PRESET.separate_walls) urlParams.set('separate_walls', String(separateWalls()))
    if (wallConnector() !== PRESET.wall_connector) urlParams.set('wall_connector', wallConnector())
    if (cornerStyle() !== PRESET.corner_style) urlParams.set('corner_style', cornerStyle())
    if (cornerRadius() !== PRESET.corner_radius) urlParams.set('corner_radius', String(cornerRadius()))
    if (baseStyle() !== PRESET.base_style) urlParams.set('base_style', baseStyle())
    if (magnets() !== PRESET.magnets) urlParams.set('magnets', String(magnets()))
    const qs = urlParams.toString()
    history.replaceState(null, '', qs ? '?' + qs : window.location.pathname)
  })

  const [presetSel, setPresetSel] = createSignal('halfords')
  const onPresetChange = (v: string) => {
    setPresetSel(v)
    if (v === 'halfords') {
      setCellsX(PRESET.cells_x); setCellsY(PRESET.cells_y)
      setEdgeN(PRESET.edge_n); setEdgeS(PRESET.edge_s); setEdgeE(PRESET.edge_e); setEdgeW(PRESET.edge_w)
      setWallN(PRESET.wall_n); setWallS(PRESET.wall_s); setWallE(PRESET.wall_e); setWallW(PRESET.wall_w)
      setSeparateWalls(PRESET.separate_walls); setWallConnector(PRESET.wall_connector); setCornerStyle(PRESET.corner_style)
      setCornerRadius(PRESET.corner_radius); setBaseStyle(PRESET.base_style); setMagnets(PRESET.magnets)
    }
  }

  return (
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
          <SelectField
            label="Preset"
            value={presetSel()}
            onChange={onPresetChange}
            options={[
              { value: 'halfords', label: 'Halfords 3 Drawer Middle Chest (13×9)' },
            ]}
          />
          <p style={{ margin: '6px 0 0', 'font-size': '0.78rem', color: '#5a8a6a', 'font-variant-numeric': 'tabular-nums' }}>{info()}</p>
        </div>
      }
      footer={
        <Show
          when={selectedPiece() >= 0 && pieces()}
          fallback={
            <button onClick={() => download()} style={btnStyle}>Download STL</button>
          }
        >
          <button onClick={() => download(selectedPiece())} style={btnStyle}>
            Download {pieces()?.[selectedPiece()]?.label} STL
          </button>
          <button onClick={() => download()} style={btnStyleOutline}>Download all STL</button>
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
        <SelectField label="Base style" value={baseStyle()} onChange={setBaseStyle} options={[
          { value: 'solid', label: 'Solid' },
          { value: 'open', label: 'Open' },
        ]} />
        <Show when={baseStyle() === 'solid'}>
          <BooleanField label="Magnet pockets" value={magnets()} onChange={setMagnets} />
        </Show>
        <NumberSlider label="Outer corner radius (mm)" value={cornerRadius()} onChange={setCornerRadius} min={0} max={OUTER_R} step={0.5} />
      </SidebarSection>
      <SidebarSection label="Size" defaultOpen>
        <NumberSlider label="Width (cells)" value={cellsX()} onChange={setCellsX} min={1} max={20} />
        <NumberSlider label="Depth (cells)" value={cellsY()} onChange={setCellsY} min={1} max={20} />
      </SidebarSection>
      <SidebarSection label="Walls" defaultOpen>
        <Show when={restrictBed() && hasWalls()}>
          <BooleanField
            label="Print walls separately"
            value={separateWalls()}
            onChange={setSeparateWalls}
            description="Recommended when designing a plate for a new product — if measurements are off, only the walls need reprinting."
          />
        </Show>
        <Show when={restrictBed() && separateWalls() && hasWalls()}>
          <SelectField label="Wall connector" value={wallConnector()} onChange={setWallConnector} options={[
            { value: 'wall_male',   label: 'Male on wall' },
            { value: 'wall_female', label: 'Female on wall' },
          ]} />
        </Show>
        <Show when={restrictBed() && separateWalls() && hasCorner()}>
          <SelectField label="Corner style" value={cornerStyle()} onChange={setCornerStyle} options={[
            { value: 'corner_l',   label: 'L-shaped' },
            { value: 'corner_cw',  label: 'Clockwise' },
            { value: 'corner_ccw', label: 'Anti-clockwise' },
            { value: 'corner_ns',  label: 'Included in N/S walls' },
            { value: 'corner_ew',  label: 'Included in E/W walls' },
          ]} />
        </Show>
        <Show when={!restrictBed()}>
          <SelectField label="North edge" value={edgeN()} onChange={setEdgeN} options={[
            { value: 'wall', label: 'Wall' }, { value: 'male', label: 'Male connector' }, { value: 'female', label: 'Female connector' },
          ]} />
          <SelectField label="South edge" value={edgeS()} onChange={setEdgeS} options={[
            { value: 'wall', label: 'Wall' }, { value: 'male', label: 'Male connector' }, { value: 'female', label: 'Female connector' },
          ]} />
          <SelectField label="East edge" value={edgeE()} onChange={setEdgeE} options={[
            { value: 'wall', label: 'Wall' }, { value: 'male', label: 'Male connector' }, { value: 'female', label: 'Female connector' },
          ]} />
          <SelectField label="West edge" value={edgeW()} onChange={setEdgeW} options={[
            { value: 'wall', label: 'Wall' }, { value: 'male', label: 'Male connector' }, { value: 'female', label: 'Female connector' },
          ]} />
        </Show>
        <Show when={restrictBed() || edgeN() === 'wall'}>
          <OptionalNumberSlider label="North (mm)" value={wallN()} onChange={setWallN} min={wallMin()} max={40} step={0.5} />
        </Show>
        <Show when={restrictBed() || edgeS() === 'wall'}>
          <OptionalNumberSlider label="South (mm)" value={wallS()} onChange={setWallS} min={wallMin()} max={40} step={0.5} />
        </Show>
        <Show when={restrictBed() || edgeE() === 'wall'}>
          <OptionalNumberSlider label="East (mm)"  value={wallE()} onChange={setWallE} min={wallMin()} max={40} step={0.5} />
        </Show>
        <Show when={restrictBed() || edgeW() === 'wall'}>
          <OptionalNumberSlider label="West (mm)"  value={wallW()} onChange={setWallW} min={wallMin()} max={40} step={0.5} />
        </Show>
      </SidebarSection>
    </PageLayout>
  )
}

const btnStyle = { padding: '10px', background: '#6688cc', color: '#fff', border: 'none', 'border-radius': '6px', cursor: 'pointer', 'font-size': '0.875rem', width: '100%' } as const
const btnStyleOutline = { padding: '8px', background: 'none', color: '#6688cc', border: '1px solid #6688cc', 'border-radius': '6px', cursor: 'pointer', 'font-size': '0.8rem', width: '100%' } as const

render(() => <GridfinityBaseplatePage />, document.getElementById('root')!)
