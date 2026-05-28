import { createEffect, createMemo, createSignal } from 'solid-js'
import { render } from 'solid-js/web'
import '../index.css'
import { PageLayout } from '../components/PageLayout'
import { ModelInfo } from '../components/ModelInfo'
import { BinHolesSection } from '../components/BinHolesSection'
import { DownloadFooter } from '../components/DownloadFooter'
import { useGeometry } from '../hooks/useGeometry'
import { createUrlSync } from '../hooks/urlSync'
import { attribution, info } from '../models/battery-tester-bin'
import { type BinHoleSettings, binHoleSettingsFromUrl } from '../models/gridfinity-bin'

const sp = new URLSearchParams(window.location.search)

function BatteryTesterBinPage() {
  const [holeSettings, setHoleSettings] = createSignal<BinHoleSettings>(binHoleSettingsFromUrl(sp, 6.1))

  const setUrl = createUrlSync()

  createEffect(() => {
    const h = holeSettings()
    setUrl('magnet_size', h.magnet_size !== 6.1 ? String(h.magnet_size ?? 0) : null)
    setUrl('supportless', !h.supportless ? 'false' : null)
    setUrl('screw_holes', h.screw_holes ? 'true' : null)
    setUrl('corner_magnets', h.corner_magnets ? 'true' : null)
  })

  const params = createMemo(() => ({
    holes: holeSettings(),
    stacking_lip: false,
  }))

  const { objects, rendering, selectedObject, toggleObject, download } = useGeometry('battery-tester-bin', params)

  return (
    <PageLayout
      title="BT-168 Battery Tester Bin"
      description="Gridfinity bin (3×1 cells, 6 units tall) with an exact-fit cavity for the BT-168 digital battery tester."
      attribution={attribution}
      designLicense={{ label: 'CC BY-SA 4.0', url: 'https://creativecommons.org/licenses/by-sa/4.0/' }}
      header={<ModelInfo>{info()}</ModelInfo>}
      objects={objects}
      selectedObject={selectedObject}
      onObjectClick={toggleObject}
      rendering={rendering}
      footer={<DownloadFooter label="Download" onStl={() => download()} on3mf={() => download('3mf')} />}
    >
      <BinHolesSection value={holeSettings()} onChange={setHoleSettings} />
    </PageLayout>
  )
}

render(() => <BatteryTesterBinPage />, document.getElementById('root')!)
