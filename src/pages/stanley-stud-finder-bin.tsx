import { createEffect, createMemo, createSignal } from 'solid-js'
import { render } from 'solid-js/web'
import '../index.css'
import { PageLayout } from '../components/PageLayout'
import { ModelInfo } from '../components/ModelInfo'
import { BooleanField } from '../components/BooleanField'
import { SidebarSection } from '../components/SidebarSection'
import { BinHolesSection } from '../components/BinHolesSection'
import { useGeometry } from '../hooks/useGeometry'
import { createUrlSync } from '../hooks/urlSync'
import { attribution, info } from '../models/stanley-stud-finder-bin'
import { type BinHoleSettings, binHoleSettingsFromUrl } from '../models/gridfinity-bin'

const sp = new URLSearchParams(window.location.search)
function urlBool(key: string, def: boolean) { const v = sp.get(key); return v !== null ? v === 'true' : def }

function StanleyStudFinderBinPage() {
  const [stackable, setStackable] = createSignal(urlBool('stackable', false))
  const [holeSettings, setHoleSettings] = createSignal<BinHoleSettings>(binHoleSettingsFromUrl(sp, 6.1))

  const setUrl = createUrlSync()

  createEffect(() => {
    const h = holeSettings()
    setUrl('stackable', stackable() ? 'true' : null)
    setUrl('magnet_size', h.magnet_size !== 6.1 ? String(h.magnet_size ?? 0) : null)
    setUrl('supportless', !h.supportless ? 'false' : null)
    setUrl('screw_holes', h.screw_holes ? 'true' : null)
    setUrl('corner_magnets', h.corner_magnets ? 'true' : null)
  })

  const params = createMemo(() => ({
    stackable: stackable(),
    holes: holeSettings(),
  }))

  const { objects, rendering, selectedObject, toggleObject, download } = useGeometry('stanley-stud-finder-bin', params)

  return (
    <PageLayout
      title="Stanley Stud Finder Bin"
      description="Gridfinity bin (2×4 cells) with an exact-fit cavity for the Stanley stud finder."
      attribution={attribution}
      header={<ModelInfo>{info(stackable())}</ModelInfo>}
      objects={objects}
      selectedObject={selectedObject}
      onObjectClick={toggleObject}
      rendering={rendering}
      download={download}
    >
      <SidebarSection label="Bin" defaultOpen>
        <BooleanField label="Stackable" value={stackable()} onChange={setStackable} />
      </SidebarSection>
      <BinHolesSection value={holeSettings()} onChange={setHoleSettings} />
    </PageLayout>
  )
}

render(() => <StanleyStudFinderBinPage />, document.getElementById('root')!)
