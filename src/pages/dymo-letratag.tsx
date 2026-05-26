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
import { createUrlSync } from '../hooks/urlSync'
import { attribution, info, HEIGHT_UNITS_MIN, HEIGHT_UNITS_MAX } from '../models/dymo-letratag'
import { type BinHoleSettings, binHoleSettingsFromUrl } from '../models/gridfinity-bin'

const sp = new URLSearchParams(window.location.search)
function urlNum(key: string, def: number) { const v = sp.get(key); return v !== null ? parseFloat(v) : def }
function urlBool(key: string, def: boolean) { const v = sp.get(key); return v !== null ? v === 'true' : def }

function DymoLetraTagPage() {
  const [heightUnits, setHeightUnits] = createSignal(urlNum('height_units', HEIGHT_UNITS_MAX))
  const [split, setSplit] = createSignal(urlBool('split', false))
  const [holeSettings, setHoleSettings] = createSignal<BinHoleSettings>(binHoleSettingsFromUrl(sp, 6.1))

  const setUrl = createUrlSync()

  createEffect(() => {
    const h = holeSettings()
    setUrl('height_units', heightUnits() !== HEIGHT_UNITS_MAX ? String(heightUnits()) : null)
    setUrl('split', split() ? 'true' : null)
    setUrl('magnet_size', h.magnet_size !== 6.1 ? String(h.magnet_size ?? 0) : null)
    setUrl('supportless', !h.supportless ? 'false' : null)
    setUrl('screw_holes', h.screw_holes ? 'true' : null)
    setUrl('corner_magnets', h.corner_magnets ? 'true' : null)
  })

  const params = createMemo(() => ({
    height_units: heightUnits(),
    split: split(),
    holes: holeSettings(),
  }))

  const { objects, rendering, selectedObject, toggleObject, download } = useGeometry('dymo-letratag', params)

  return (
    <PageLayout
      title="Dymo LetraTag Bin"
      description="Gridfinity bin (3×6 cells) with an exact-fit cavity for the Dymo LetraTag label maker."
      attribution={attribution}
      header={<ModelInfo>{info(heightUnits())}</ModelInfo>}
      objects={objects}
      selectedObject={selectedObject}
      onObjectClick={toggleObject}
      rendering={rendering}
      download={download}
      downloadNote="3MF includes per-part infill settings"
    >
      <SidebarSection label="Bin" defaultOpen>
        <NumberSlider label="Height (units)" value={heightUnits()} onChange={setHeightUnits} min={HEIGHT_UNITS_MIN} max={HEIGHT_UNITS_MAX} />
        <BooleanField label="Split for small beds" value={split()} onChange={setSplit} />
      </SidebarSection>
      <BinHolesSection value={holeSettings()} onChange={setHoleSettings} />
    </PageLayout>
  )
}

render(() => <DymoLetraTagPage />, document.getElementById('root')!)
