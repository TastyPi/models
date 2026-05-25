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
import { useGeometry } from '../hooks/useGeometry'
import { attribution, info, CELL, type BinHoleSettings, binHoleSettingsFromUrl, binHoleSettingsToUrl } from '../models/gridfinity-bin'

const sp = new URLSearchParams(window.location.search)
function urlNum(key: string, def: number) { const v = sp.get(key); return v !== null ? parseFloat(v) : def }
function urlBool(key: string, def: boolean) { const v = sp.get(key); return v !== null ? v === 'true' : def }
function urlStr(key: string, def: string) { const v = sp.get(key); return v !== null ? v : def }

function GridfinityBinPage() {
  const [cellsX, setCellsX] = createSignal(urlNum('cells_x', 1))
  const [cellsY, setCellsY] = createSignal(urlNum('cells_y', 1))
  const [cellSize, setCellSize] = createSignal(urlNum('cell_size', CELL))
  const [heightUnits, setHeightUnits] = createSignal(urlNum('height_units', 3))
  const [stackingLip, setStackingLip] = createSignal(urlBool('stacking_lip', true))
  const [baseStyle, setBaseStyle] = createSignal(urlStr('base_style', 'flat'))
  const [dividersX, setDividersX] = createSignal(urlNum('dividers_x', 0))
  const [dividersY, setDividersY] = createSignal(urlNum('dividers_y', 0))

  // magnet_size: null = no magnet holes, number = hole diameter in mm; 0 in URL encodes null
  const [holeSettings, setHoleSettings] = createSignal<BinHoleSettings>(binHoleSettingsFromUrl(sp, 6.1))
  const [labelStyle, setLabelStyle] = createSignal(urlStr('label_style', 'none'))

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

  createEffect(() => {
    const p = params()
    const url = new URLSearchParams()
    url.set('cells_x', String(p.cells_x))
    url.set('cells_y', String(p.cells_y))
    if (p.cell_size !== CELL) url.set('cell_size', String(p.cell_size))
    url.set('height_units', String(p.height_units))
    url.set('stacking_lip', String(p.stacking_lip))
    if (p.base_style !== 'flat') url.set('base_style', p.base_style)
    if (p.dividers_x > 0) url.set('dividers_x', String(p.dividers_x))
    if (p.dividers_y > 0) url.set('dividers_y', String(p.dividers_y))
    binHoleSettingsToUrl(url, p.holes, 6.1)
    if (p.label_style !== 'none') url.set('label_style', p.label_style)
    window.history.replaceState(null, '', '?' + url.toString())
  })

  return (
    <PageLayout
      title="Gridfinity Bin"
      description="Gridfinity bin with configurable width, depth, and height."
      attribution={attribution}
      header={<ModelInfo>{infoStr()}</ModelInfo>}
      objects={objects}
      selectedObject={selectedObject}
      onObjectClick={toggleObject}
      rendering={rendering}
      footer={<DownloadFooter label="Download" onStl={() => download()} on3mf={() => download('3mf')} />}
    >
      <SidebarSection label="Size" defaultOpen>
        <NumberSlider label="Width (cells)" value={cellsX()} onChange={setCellsX} min={1} max={10} />
        <NumberSlider label="Depth (cells)" value={cellsY()} onChange={setCellsY} min={1} max={10} />
        <NumberSlider label="Cell size (mm)" value={cellSize()} onChange={setCellSize} min={21} max={84} step={1} />
        <NumberSlider label="Height (units)" value={heightUnits()} onChange={setHeightUnits} min={1} max={9} labelAddon={<HeightReferenceDialog />} />
        <BooleanField label="Stacking lip" value={stackingLip()} onChange={setStackingLip} />
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
            <BooleanField label="Tab" value={labelStyle() !== 'none'} onChange={v => setLabelStyle(v ? 'center' : 'none')} />
          </Show>
        </SidebarSection>
      </Show>

      <SidebarSection label="Dividers" defaultOpen>
        <NumberSlider label="X dividers" value={dividersX()} onChange={setDividersX} min={0} max={5} />
        <NumberSlider label="Y dividers" value={dividersY()} onChange={setDividersY} min={0} max={5} />
      </SidebarSection>

      <SidebarSection label="Base" defaultOpen>
        <SelectField
          label="Style"
          value={baseStyle()}
          onChange={setBaseStyle}
          options={[
            { value: 'flat', label: 'Flat' },
            { value: 'hollow', label: 'Hollow' },
            { value: 'scoop', label: 'Scoop' },
          ]}
        />
      </SidebarSection>

      <BinHolesSection value={holeSettings()} onChange={setHoleSettings} />
    </PageLayout>
  )
}

render(() => <GridfinityBinPage />, document.getElementById('root')!)
