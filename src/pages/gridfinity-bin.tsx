import { createEffect, createMemo, createSignal, Show } from 'solid-js'
import { render } from 'solid-js/web'
import '../index.css'
import { PageLayout } from '../components/PageLayout'
import { ModelInfo } from '../components/ModelInfo'
import { BooleanField } from '../components/BooleanField'
import { NumberSlider } from '../components/NumberSlider'
import { SelectField } from '../components/SelectField'
import { SidebarSection } from '../components/SidebarSection'
import { BinHolesSection } from '../components/BinHolesSection'
import { DownloadFooter } from '../components/DownloadFooter'
import { HeightReferenceDialog } from '../components/HeightReferenceDialog'
import { PresetSelect } from '../components/PresetSelect'
import { useGeometry } from '../hooks/useGeometry'
import { createUrlSync, UrlSyncContext } from '../hooks/urlSync'
import { attribution, info, CELL, type BinHoleSettings, binHoleSettingsFromUrl } from '../models/gridfinity-bin'

const sp = new URLSearchParams(window.location.search)
function urlNum(key: string, def: number) { const v = sp.get(key); return v !== null ? parseFloat(v) : def }
function urlBool(key: string, def: boolean) { const v = sp.get(key); return v !== null ? v === 'true' : def }
function urlStr(key: string, def: string) { const v = sp.get(key); return v !== null ? v : def }

interface Preset {
  cells_x: number; cells_y: number; height_units: number
  stacking_lip: boolean; base_style: string; label_style: string
  dividers_x: number; dividers_y: number
  holes: BinHoleSettings
}

const PRESETS: Record<string, Partial<Preset>> = {
  none: {},
  small_screws: {
    cells_x: 1, cells_y: 1, height_units: 3,
    stacking_lip: true, base_style: 'scoop', label_style: 'center',
    dividers_x: 0, dividers_y: 0,
  },
  long_screws: {
    cells_x: 2, cells_y: 1, height_units: 3,
    stacking_lip: true, base_style: 'scoop', label_style: 'left',
    dividers_x: 0, dividers_y: 0,
  },
}

const PRESET_OPTIONS = [
  { value: 'small_screws', label: 'Small screws' },
  { value: 'long_screws', label: 'Long screws' },
]

function GridfinityBinPage() {
  const initialPresetKey = sp.get('preset') ?? 'none'
  const base = PRESETS[initialPresetKey] ?? {}

  const [cellsX, setCellsX] = createSignal(urlNum('cells_x', base.cells_x ?? 1))
  const [cellsY, setCellsY] = createSignal(urlNum('cells_y', base.cells_y ?? 1))
  const [cellSize, setCellSize] = createSignal(urlNum('cell_size', CELL))
  const [heightUnits, setHeightUnits] = createSignal(urlNum('height_units', base.height_units ?? 3))
  const [stackingLip, setStackingLip] = createSignal(urlBool('stacking_lip', base.stacking_lip ?? true))
  const [baseStyle, setBaseStyle] = createSignal(urlStr('base_style', base.base_style ?? 'flat'))
  const [dividersX, setDividersX] = createSignal(urlNum('dividers_x', base.dividers_x ?? 0))
  const [dividersY, setDividersY] = createSignal(urlNum('dividers_y', base.dividers_y ?? 0))

  // magnet_size: null = no magnet holes, number = hole diameter in mm; 0 in URL encodes null
  const [holeSettings, setHoleSettings] = createSignal<BinHoleSettings>(binHoleSettingsFromUrl(sp, base.holes?.magnet_size ?? 6.1))
  const [labelStyle, setLabelStyle] = createSignal(urlStr('label_style', base.label_style ?? 'none'))

  const [presetSel, setPresetSel] = createSignal(initialPresetKey)
  const [presetParams, setPresetParams] = createSignal<Partial<Preset>>(base)

  const d = <K extends keyof Preset>(key: K) => presetParams()[key]

  const isDirty = createMemo(() => {
    const p = presetParams()
    const h = holeSettings()
    return (p.cells_x !== undefined && cellsX() !== p.cells_x) ||
      (p.cells_y !== undefined && cellsY() !== p.cells_y) ||
      (p.height_units !== undefined && heightUnits() !== p.height_units) ||
      (p.stacking_lip !== undefined && stackingLip() !== p.stacking_lip) ||
      (p.base_style !== undefined && baseStyle() !== p.base_style) ||
      (p.label_style !== undefined && labelStyle() !== p.label_style) ||
      (p.dividers_x !== undefined && dividersX() !== p.dividers_x) ||
      (p.dividers_y !== undefined && dividersY() !== p.dividers_y) ||
      (p.holes !== undefined && (
        h.magnet_size !== p.holes.magnet_size || h.screw_holes !== p.holes.screw_holes ||
        h.supportless !== p.holes.supportless || h.corner_magnets !== p.holes.corner_magnets
      ))
  })

  const applyPreset = (p: Partial<Preset>) => {
    if (p.cells_x !== undefined) setCellsX(p.cells_x)
    if (p.cells_y !== undefined) setCellsY(p.cells_y)
    if (p.height_units !== undefined) setHeightUnits(p.height_units)
    if (p.stacking_lip !== undefined) setStackingLip(p.stacking_lip)
    if (p.base_style !== undefined) setBaseStyle(p.base_style)
    if (p.label_style !== undefined) setLabelStyle(p.label_style)
    if (p.dividers_x !== undefined) setDividersX(p.dividers_x)
    if (p.dividers_y !== undefined) setDividersY(p.dividers_y)
    if (p.holes !== undefined) setHoleSettings({ ...p.holes })
  }

  const setUrl = createUrlSync()

  const onPresetChange = (v: string) => {
    setPresetSel(v)
    const p = PRESETS[v] ?? {}
    setPresetParams(p)
    applyPreset(p)
    setUrl('preset', v === 'none' ? null : v)
  }

  createEffect(() => {
    const p = presetParams()
    const h = holeSettings()
    setUrl('cells_x', cellsX() !== (p.cells_x ?? 1) ? String(cellsX()) : null)
    setUrl('cells_y', cellsY() !== (p.cells_y ?? 1) ? String(cellsY()) : null)
    setUrl('cell_size', cellSize() !== CELL ? String(cellSize()) : null)
    setUrl('height_units', heightUnits() !== (p.height_units ?? 3) ? String(heightUnits()) : null)
    setUrl('stacking_lip', stackingLip() !== (p.stacking_lip ?? true) ? String(stackingLip()) : null)
    setUrl('base_style', baseStyle() !== (p.base_style ?? 'flat') ? baseStyle() : null)
    setUrl('dividers_x', dividersX() !== (p.dividers_x ?? 0) ? String(dividersX()) : null)
    setUrl('dividers_y', dividersY() !== (p.dividers_y ?? 0) ? String(dividersY()) : null)
    setUrl('label_style', heightUnits() > 1 && labelStyle() !== (p.label_style ?? 'none') ? labelStyle() : null)
    setUrl('magnet_size', h.magnet_size !== (p.holes?.magnet_size ?? 6.1) ? String(h.magnet_size ?? 0) : null)
    setUrl('supportless', h.supportless !== (p.holes?.supportless ?? true) ? String(h.supportless) : null)
    setUrl('screw_holes', h.screw_holes !== (p.holes?.screw_holes ?? false) ? String(h.screw_holes) : null)
    setUrl('corner_magnets', h.corner_magnets !== (p.holes?.corner_magnets ?? false) ? String(h.corner_magnets) : null)
  })

  const infoStr = createMemo(() => info(cellsX(), cellsY(), heightUnits(), stackingLip(), cellSize()))

  const params = createMemo(() => ({
    cells_x: cellsX(), cells_y: cellsY(), cell_size: cellSize(), height_units: heightUnits(),
    stacking_lip: stackingLip(),
    base_style: baseStyle() as 'flat' | 'hollow' | 'scoop',
    holes: holeSettings(),
    dividers_x: dividersX(), dividers_y: dividersY(),
    label_style: labelStyle() as 'none' | 'full' | 'left' | 'center' | 'right',
  }))

  const { objects, rendering, selectedObject, toggleObject, download } = useGeometry('gridfinity-bin', params)

  return (
    <UrlSyncContext.Provider value={setUrl}>
      <PageLayout
        title="Gridfinity Bin"
        description="Gridfinity bin with configurable width, depth, and height."
        attribution={attribution}
        header={
          <>
            <PresetSelect
              value={presetSel()}
              onChange={onPresetChange}
              options={PRESET_OPTIONS}
              dirty={isDirty()}
              onResetAll={() => applyPreset(presetParams())}
            />
            <ModelInfo>{infoStr()}</ModelInfo>
          </>
        }
        objects={objects}
        selectedObject={selectedObject}
        onObjectClick={toggleObject}
        rendering={rendering}
        footer={<DownloadFooter label="Download" onStl={() => download()} on3mf={() => download('3mf')} />}
      >
        <SidebarSection label="Size" defaultOpen>
          <NumberSlider label="Width (cells)" value={cellsX()} onChange={setCellsX} min={1} max={10} default={d('cells_x')} />
          <NumberSlider label="Depth (cells)" value={cellsY()} onChange={setCellsY} min={1} max={10} default={d('cells_y')} />
          <NumberSlider label="Cell size (mm)" value={cellSize()} onChange={setCellSize} min={21} max={84} step={1} />
          <NumberSlider label="Height (units)" value={heightUnits()} onChange={setHeightUnits} min={1} max={9} labelAddon={<HeightReferenceDialog />} default={d('height_units')} />
          <BooleanField label="Stacking lip" value={stackingLip()} onChange={setStackingLip} default={d('stacking_lip')} />
        </SidebarSection>

        <Show when={heightUnits() > 1}>
          <SidebarSection label="Label" defaultOpen={false}>
            <Show when={cellsX() === 1} fallback={
              <SelectField
                label="Tab"
                value={labelStyle()}
                onChange={setLabelStyle}
                options={[
                  { value: 'none', label: 'None' },
                  { value: 'center', label: 'Center' },
                  { value: 'left', label: 'Left' },
                  { value: 'right', label: 'Right' },
                  { value: 'full', label: 'Full width' },
                ]}
              />
            }>
              <BooleanField
                label="Tab"
                value={labelStyle() !== 'none'}
                onChange={v => setLabelStyle(v ? 'center' : 'none')}
              />
            </Show>
          </SidebarSection>
        </Show>

        <SidebarSection label="Dividers" defaultOpen>
          <NumberSlider label="X dividers" value={dividersX()} onChange={setDividersX} min={0} max={5} default={d('dividers_x')} />
          <NumberSlider label="Y dividers" value={dividersY()} onChange={setDividersY} min={0} max={5} default={d('dividers_y')} />
        </SidebarSection>

        <SidebarSection label="Base" defaultOpen>
          <SelectField
            label="Style"
            value={baseStyle()}
            onChange={setBaseStyle}
            default={d('base_style')}
            options={[
              { value: 'flat', label: 'Flat' },
              { value: 'hollow', label: 'Hollow' },
              { value: 'scoop', label: 'Scoop' },
            ]}
          />
        </SidebarSection>

        <BinHolesSection value={holeSettings()} onChange={setHoleSettings} />
      </PageLayout>
    </UrlSyncContext.Provider>
  )
}

render(() => <GridfinityBinPage />, document.getElementById('root')!)
