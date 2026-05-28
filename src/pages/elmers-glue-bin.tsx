import { createEffect, createMemo, createSignal } from 'solid-js'
import { render } from 'solid-js/web'
import '../index.css'
import { PageLayout } from '../components/PageLayout'
import { ModelInfo } from '../components/ModelInfo'
import { SidebarSection } from '../components/SidebarSection'
import { BooleanField } from '../components/BooleanField'
import { BinHolesSection } from '../components/BinHolesSection'
import { DownloadFooter } from '../components/DownloadFooter'
import { useGeometry } from '../hooks/useGeometry'
import { createUrlSync } from '../hooks/urlSync'
import { attribution, info } from '../models/elmers-glue-bin'
import { type BinHoleSettings, binHoleSettingsFromUrl } from '../models/gridfinity-bin'

const sp = new URLSearchParams(window.location.search)
function urlBool(key: string, def: boolean) { const v = sp.get(key); return v !== null ? v !== 'false' : def }

function ElmersGlueBinPage() {
  const [stackable, setStackable] = createSignal(urlBool('stackable', false))
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
    stackable: stackable(),
    holes: holeSettings(),
  }))

  const { objects, rendering, selectedObject, toggleObject, download } = useGeometry('elmers-glue-bin', params)

  return (
    <PageLayout
      title="Elmer's Glue Bin"
      description="Gridfinity bin (4×2 cells) with a cradle for an Elmer's school glue 118ml bottle lying flat."
      attribution={attribution}
      header={<ModelInfo>{info(params())}</ModelInfo>}
      objects={objects}
      selectedObject={selectedObject}
      onObjectClick={toggleObject}
      rendering={rendering}
      footer={<DownloadFooter label="Download" onStl={() => download()} on3mf={() => download('3mf')} />}
    >
      <SidebarSection label="Options" defaultOpen>
        <BooleanField label="Stackable" value={stackable()} onChange={setStackable} default={false} urlKey="stackable" />
      </SidebarSection>
      <BinHolesSection value={holeSettings()} onChange={setHoleSettings} />
    </PageLayout>
  )
}

render(() => <ElmersGlueBinPage />, document.getElementById('root')!)
