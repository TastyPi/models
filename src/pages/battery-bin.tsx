import { createEffect, createMemo, createSignal } from 'solid-js'
import { render } from 'solid-js/web'
import '../index.css'
import { PageLayout } from '../components/PageLayout'
import { ModelInfo } from '../components/ModelInfo'
import { SelectField } from '../components/SelectField'
import { SidebarSection } from '../components/SidebarSection'
import { BinHolesSection } from '../components/BinHolesSection'
import { DownloadFooter } from '../components/DownloadFooter'
import { useGeometry } from '../hooks/useGeometry'
import { createUrlSync, UrlSyncContext } from '../hooks/urlSync'
import { attribution, info, type BatteryBinParams, type BatteryBinType } from '../models/battery-bin'
import { type BinHoleSettings, binHoleSettingsFromUrl } from '../models/gridfinity-bin'

const sp = new URLSearchParams(window.location.search)
function urlStr(key: string, def: string) { const v = sp.get(key); return v !== null ? v : def }

function BatteryBinPage() {
  const [type, setType] = createSignal(urlStr('type', 'aa') as BatteryBinType)
  const [holeSettings, setHoleSettings] = createSignal<BinHoleSettings>(binHoleSettingsFromUrl(sp, 6.1))

  const setUrl = createUrlSync()

  createEffect(() => {
    const h = holeSettings()
    setUrl('magnet_size', h.magnet_size !== 6.1 ? String(h.magnet_size ?? 0) : null)
    setUrl('supportless', !h.supportless ? 'false' : null)
    setUrl('screw_holes', h.screw_holes ? 'true' : null)
    setUrl('corner_magnets', h.corner_magnets ? 'true' : null)
  })

  const params = createMemo<BatteryBinParams>(() => ({ type: type(), holes: holeSettings() }))

  const { objects, rendering, selectedObject, toggleObject, download } = useGeometry('battery-bin', params)

  return (
    <UrlSyncContext.Provider value={setUrl}>
      <PageLayout
        title="Battery Bin"
        description="Gridfinity 1×1 battery bins: 5 AA, or two 9V (MN1604) with 3 AAA or MN21."
        attribution={attribution}
        header={<ModelInfo>{info(type())}</ModelInfo>}
        objects={objects}
        selectedObject={selectedObject}
        onObjectClick={toggleObject}
        rendering={rendering}
        footer={<DownloadFooter label="Download" onStl={() => download()} on3mf={() => download('3mf')} />}
      >
        <SidebarSection label="Batteries" defaultOpen>
          <SelectField
            label="Type"
            value={type()}
            onChange={v => setType(v as BatteryBinType)}
            default="aa"
            urlKey="type"
            options={[
              { value: 'aa', label: '5 × AA' },
              { value: 'mixed', label: '2 × 9V + 3 × AAA or MN21' },
            ]}
          />
        </SidebarSection>

        <BinHolesSection value={holeSettings()} onChange={setHoleSettings} />
      </PageLayout>
    </UrlSyncContext.Provider>
  )
}

render(() => <BatteryBinPage />, document.getElementById('root')!)
