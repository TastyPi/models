import { createEffect, createMemo, createSignal } from 'solid-js'
import { render } from 'solid-js/web'
import '../index.css'
import { PageLayout } from '../components/PageLayout'
import { ModelInfo } from '../components/ModelInfo'
import { NumberSlider } from '../components/NumberSlider'
import { SidebarSection } from '../components/SidebarSection'
import { BinHolesSection } from '../components/BinHolesSection'
import { DownloadFooter } from '../components/DownloadFooter'
import { useGeometry } from '../hooks/useGeometry'
import { createUrlSync } from '../hooks/urlSync'
import {
  attribution, info, HEIGHT_UNITS_DEFAULT, HEIGHT_UNITS_MIN, HEIGHT_UNITS_MAX,
} from '../models/scktt02-bin'
import { type BinHoleSettings, binHoleSettingsFromUrl } from '../models/gridfinity-bin'

const sp = new URLSearchParams(window.location.search)
function urlNum(key: string, def: number) { const v = sp.get(key); return v !== null ? parseFloat(v) : def }

function Scktt02BinPage() {
  const [heightUnits, setHeightUnits] = createSignal(urlNum('height_units', HEIGHT_UNITS_DEFAULT))
  const [holeSettings, setHoleSettings] = createSignal<BinHoleSettings>(binHoleSettingsFromUrl(sp, 6.1))

  const setUrl = createUrlSync()

  createEffect(() => {
    const h = holeSettings()
    setUrl('height_units', heightUnits() !== HEIGHT_UNITS_DEFAULT ? String(heightUnits()) : null)
    setUrl('magnet_size', h.magnet_size !== 6.1 ? String(h.magnet_size ?? 0) : null)
    setUrl('supportless', !h.supportless ? 'false' : null)
    setUrl('screw_holes', h.screw_holes ? 'true' : null)
    setUrl('corner_magnets', h.corner_magnets ? 'true' : null)
  })

  const params = createMemo(() => ({ height_units: heightUnits(), holes: holeSettings() }))

  const { objects, rendering, selectedObject, toggleObject, download } = useGeometry('scktt02-bin', params)

  return (
    <PageLayout
      title="SCKTT02 Socket Tester Bin"
      description="Gridfinity 2×2 bin with a round pocket for the LAP SCKTT02 socket tester."
      attribution={attribution}
      header={<ModelInfo>{info(heightUnits())}</ModelInfo>}
      objects={objects}
      selectedObject={selectedObject}
      onObjectClick={toggleObject}
      rendering={rendering}
      footer={<DownloadFooter label="Download" onStl={() => download()} on3mf={() => download('3mf')} />}
    >
      <SidebarSection label="Bin" defaultOpen>
        <NumberSlider
          label="Height (units)" value={heightUnits()} onChange={setHeightUnits}
          min={HEIGHT_UNITS_MIN} max={HEIGHT_UNITS_MAX} default={HEIGHT_UNITS_DEFAULT}
        />
      </SidebarSection>
      <BinHolesSection value={holeSettings()} onChange={setHoleSettings} />
    </PageLayout>
  )
}

render(() => <Scktt02BinPage />, document.getElementById('root')!)
