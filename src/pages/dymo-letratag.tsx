import { createEffect, createMemo, createSignal } from 'solid-js'
import { render } from 'solid-js/web'
import '../index.css'
import { PageLayout } from '../components/PageLayout'
import { ModelInfo } from '../components/ModelInfo'
import { BooleanField } from '../components/BooleanField'
import { NumberSlider } from '../components/NumberSlider'
import { SidebarSection } from '../components/SidebarSection'
import { BinHolesSection } from '../components/BinHolesSection'
import { useGeometry } from '../hooks/useGeometry'
import { attribution, info, HEIGHT_UNITS_MIN, HEIGHT_UNITS_MAX } from '../models/dymo-letratag'
import { type BinHoleSettings, binHoleSettingsFromUrl, binHoleSettingsToUrl } from '../models/gridfinity-bin'

const sp = new URLSearchParams(window.location.search)
function urlNum(key: string, def: number) { const v = sp.get(key); return v !== null ? parseFloat(v) : def }
function urlBool(key: string, def: boolean) { const v = sp.get(key); return v !== null ? v === 'true' : def }

function DymoLetraTagPage() {
  const [heightUnits, setHeightUnits] = createSignal(urlNum('height_units', HEIGHT_UNITS_MAX))
  const [stackingLip, setStackingLip] = createSignal(urlBool('stacking_lip', true))
  const [split, setSplit] = createSignal(urlBool('split', false))
  const [holeSettings, setHoleSettings] = createSignal<BinHoleSettings>(binHoleSettingsFromUrl(sp, null))

  const params = createMemo(() => ({
    height_units: heightUnits(),
    stacking_lip: stackingLip(),
    split: split(),
    holes: holeSettings(),
  }))

  const { objects, rendering, selectedObject, toggleObject, download } = useGeometry('dymo-letratag', params)

  createEffect(() => {
    const p = params()
    const url = new URLSearchParams()
    if (p.height_units !== HEIGHT_UNITS_MAX) url.set('height_units', String(p.height_units))
    if (!p.stacking_lip) url.set('stacking_lip', 'false')
    if (p.split) url.set('split', 'true')
    binHoleSettingsToUrl(url, p.holes)
    window.history.replaceState(null, '', '?' + url.toString())
  })

  return (
    <PageLayout
      title="Dymo LetraTag Bin"
      description="Gridfinity bin (3×6 cells) with an exact-fit cavity for the Dymo LetraTag label maker."
      attribution={attribution}
      header={<ModelInfo>{info({ stacking_lip: stackingLip(), height_units: heightUnits() })}</ModelInfo>}
      objects={objects}
      selectedObject={selectedObject}
      onObjectClick={toggleObject}
      rendering={rendering}
      download={download}
      downloadNote="3MF includes per-part infill settings"
    >
      <SidebarSection label="Bin" defaultOpen>
        <NumberSlider label="Height (units)" value={heightUnits()} onChange={setHeightUnits} min={HEIGHT_UNITS_MIN} max={HEIGHT_UNITS_MAX} />
        <BooleanField label="Stacking lip" value={stackingLip()} onChange={setStackingLip} description={stackingLip() ? 'The label maker is taller than the bin, so stacking is not possible — aesthetic only.' : undefined} />
        <BooleanField label="Split for small beds" value={split()} onChange={setSplit} />
      </SidebarSection>
      <BinHolesSection value={holeSettings()} onChange={setHoleSettings} />
    </PageLayout>
  )
}

render(() => <DymoLetraTagPage />, document.getElementById('root')!)
