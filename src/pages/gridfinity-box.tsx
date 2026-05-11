import { createEffect, createMemo, createSignal, Show } from 'solid-js'
import { render } from 'solid-js/web'
import '../index.css'
import { PageLayout } from '../components/PageLayout'
import { BooleanField } from '../components/BooleanField'
import { NumberSlider } from '../components/NumberSlider'
import { SidebarSection } from '../components/SidebarSection'
import { useGeometry } from '../hooks/useGeometry'
import { attribution, info } from '../models/gridfinity-bin'

const sp = new URLSearchParams(window.location.search)
function urlNum(key: string, def: number) { const v = sp.get(key); return v !== null ? parseFloat(v) : def }
function urlBool(key: string, def: boolean) { const v = sp.get(key); return v !== null ? v === 'true' : def }

function GridfinityBinPage() {
  const [cellsX, setCellsX] = createSignal(urlNum('cells_x', 1))
  const [cellsY, setCellsY] = createSignal(urlNum('cells_y', 1))
  const [heightUnits, setHeightUnits] = createSignal(urlNum('height_units', 3))
  const [stackingLip, setStackingLip] = createSignal(urlBool('stacking_lip', true))
  const [magnets, setMagnets] = createSignal(urlBool('magnets', true))
  const [crushRibs, setCrushRibs] = createSignal(urlBool('crush_ribs', false))
  const [chamfer, setChamfer] = createSignal(urlBool('chamfer', false))
  const [supportless, setSupportless] = createSignal(urlBool('supportless', false))
  const [dividersX, setDividersX] = createSignal(urlNum('dividers_x', 0))
  const [dividersY, setDividersY] = createSignal(urlNum('dividers_y', 0))

  const infoStr = createMemo(() => info(cellsX(), cellsY(), heightUnits(), stackingLip()))

  const params = createMemo(() => ({
    cells_x: cellsX(), cells_y: cellsY(), height_units: heightUnits(),
    stacking_lip: stackingLip(),
    magnets: magnets(), crush_ribs: crushRibs(), chamfer: chamfer(), supportless: supportless(),
    dividers_x: dividersX(), dividers_y: dividersY(),
  }))

  const { geometry, rendering, download } = useGeometry('gridfinity-bin', params)

  createEffect(() => {
    const p = params()
    const url = new URLSearchParams()
    url.set('cells_x', String(p.cells_x))
    url.set('cells_y', String(p.cells_y))
    url.set('height_units', String(p.height_units))
    url.set('stacking_lip', String(p.stacking_lip))
    url.set('magnets', String(p.magnets))
    if (p.magnets) {
      url.set('crush_ribs', String(p.crush_ribs))
      url.set('chamfer', String(p.chamfer))
      url.set('supportless', String(p.supportless))
    }
    if (p.dividers_x > 0) url.set('dividers_x', String(p.dividers_x))
    if (p.dividers_y > 0) url.set('dividers_y', String(p.dividers_y))
    window.history.replaceState(null, '', '?' + url.toString())
  })

  return (
    <PageLayout
      title="Gridfinity Bin"
      description="Gridfinity bin with configurable width, depth, and height."
      attribution={attribution}
      header={<p style={{ margin: '0', 'font-size': '0.8rem', color: '#777' }}>{infoStr()}</p>}
      geometry={geometry}
      rendering={rendering}
      footer={
        <button
          onClick={() => download()}
          style={{
            background: '#6688cc', color: '#fff', border: 'none', 'border-radius': '4px',
            padding: '8px 12px', cursor: 'pointer', 'font-size': '0.85rem', width: '100%',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = '#7799dd')}
          onMouseLeave={(e) => (e.currentTarget.style.background = '#6688cc')}
        >Download STL</button>
      }
    >
      <SidebarSection label="Size" defaultOpen>
        <NumberSlider label="Width (cells)" value={cellsX()} onChange={setCellsX} min={1} max={10} />
        <NumberSlider label="Depth (cells)" value={cellsY()} onChange={setCellsY} min={1} max={10} />
        <NumberSlider label="Height (units)" value={heightUnits()} onChange={setHeightUnits} min={1} max={9} />
        <BooleanField label="Stacking lip" value={stackingLip()} onChange={setStackingLip} />
      </SidebarSection>

      <SidebarSection label="Magnets" defaultOpen checked={magnets} onCheckedChange={setMagnets}>
        <Show when={magnets()}>
          <BooleanField label="Crush ribs" value={crushRibs()} onChange={setCrushRibs} />
          <BooleanField label="Chamfer" value={chamfer()} onChange={setChamfer} />
          <BooleanField label="Supportless" value={supportless()} onChange={setSupportless} />
        </Show>
      </SidebarSection>

      <SidebarSection label="Dividers" defaultOpen>
        <NumberSlider label="X dividers" value={dividersX()} onChange={setDividersX} min={0} max={5} />
        <NumberSlider label="Y dividers" value={dividersY()} onChange={setDividersY} min={0} max={5} />
      </SidebarSection>
    </PageLayout>
  )
}

render(() => <GridfinityBinPage />, document.getElementById('root')!)
