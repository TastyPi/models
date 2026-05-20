import { createEffect, createMemo, createSignal } from 'solid-js'
import { render } from 'solid-js/web'
import '../index.css'
import { PageLayout } from '../components/PageLayout'
import { ModelInfo } from '../components/ModelInfo'
import { BooleanField } from '../components/BooleanField'
import { SidebarSection } from '../components/SidebarSection'
import { HolesSection } from '../components/HolesSection'
import { DownloadFooter } from '../components/DownloadFooter'
import { useGeometry } from '../hooks/useGeometry'
import { attribution, info } from '../models/dymo-letratag'

const sp = new URLSearchParams(window.location.search)
function urlNum(key: string, def: number) { const v = sp.get(key); return v !== null ? parseFloat(v) : def }
function urlBool(key: string, def: boolean) { const v = sp.get(key); return v !== null ? v === 'true' : def }

function DymoLetraTagPage() {
  const [stackingLip, setStackingLip] = createSignal(urlBool('stacking_lip', true))
  const [split, setSplit] = createSignal(urlBool('split', false))
  const [magnetSize, setMagnetSize] = createSignal<number | null>(
    sp.has('magnet_size') ? (urlNum('magnet_size', 6.2) || null) : null
  )
  const [screwHoles, setScrewHoles] = createSignal(urlBool('screw_holes', false))
  const [supportless, setSupportless] = createSignal(urlBool('supportless', true))
  const [cornerMagnets, setCornerMagnets] = createSignal(urlBool('corner_magnets', false))

  const params = createMemo(() => ({
    stacking_lip: stackingLip(),
    split: split(),
    magnet_size: magnetSize(),
    screw_holes: screwHoles(),
    supportless: supportless(),
    corner_magnets: cornerMagnets(),
  }))

  const { objects, rendering, selectedObject, toggleObject, download } = useGeometry('dymo-letratag', params)

  createEffect(() => {
    const p = params()
    const url = new URLSearchParams()
    if (!p.stacking_lip) url.set('stacking_lip', 'false')
    if (p.split) url.set('split', 'true')
    if (p.magnet_size !== null) {
      if (p.magnet_size !== 6.2) url.set('magnet_size', String(p.magnet_size))
      if (p.supportless) url.set('supportless', 'true')
    } else {
      url.set('magnet_size', '0')
    }
    if (p.screw_holes) url.set('screw_holes', 'true')
    if ((p.magnet_size !== null || p.screw_holes) && p.corner_magnets) url.set('corner_magnets', 'true')
    window.history.replaceState(null, '', '?' + url.toString())
  })

  return (
    <PageLayout
      title="Dymo LetraTag Bin"
      description="Gridfinity bin (3×6 cells, 6 units tall) with an exact-fit cavity for the Dymo LetraTag label maker."
      attribution={attribution}
      header={<ModelInfo>{info(stackingLip())}</ModelInfo>}
      objects={objects}
      selectedObject={selectedObject}
      onObjectClick={toggleObject}
      rendering={rendering}
      footer={<DownloadFooter label="Download" onStl={() => download()} on3mf={() => download('3mf')} />}
    >
      <SidebarSection label="Bin" defaultOpen>
        <BooleanField label="Stacking lip" value={stackingLip()} onChange={setStackingLip} />
        <BooleanField label="Split for small beds" value={split()} onChange={setSplit} />
      </SidebarSection>
      <HolesSection
        magnetSize={magnetSize()} onMagnetSize={setMagnetSize}
        screwHoles={screwHoles()} onScrewHoles={setScrewHoles}
        supportless={supportless()} onSupportless={setSupportless}
        cornerMagnets={cornerMagnets()} onCornerMagnets={setCornerMagnets}
      />
    </PageLayout>
  )
}

render(() => <DymoLetraTagPage />, document.getElementById('root')!)
