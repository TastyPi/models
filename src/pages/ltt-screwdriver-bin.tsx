import { createMemo, createSignal } from 'solid-js'
import { render } from 'solid-js/web'
import '../index.css'
import { PageLayout } from '../components/PageLayout'
import { ModelInfo } from '../components/ModelInfo'
import { SelectField } from '../components/SelectField'
import { BooleanField } from '../components/BooleanField'
import { SidebarSection } from '../components/SidebarSection'
import { BinHolesSection } from '../components/BinHolesSection'
import { DownloadFooter } from '../components/DownloadFooter'
import { useGeometry } from '../hooks/useGeometry'
import { attribution, info, collectBitHoles, type BitZoneSettings } from '../models/ltt-screwdriver-bin'
import { type BinHoleSettings, binHoleSettingsFromUrl, binHoleSettingsToUrl } from '../models/gridfinity-bin'

const sp = new URLSearchParams(window.location.search)
function urlBool(key: string, def: boolean) { const v = sp.get(key); return v !== null ? v === 'true' : def }
function urlZoneSide(key: string): 'none' | 'extension' | 'pen' {
  const v = sp.get(key)
  if (v === 'extension') return 'extension'
  if (v === 'pen') return 'pen'
  return 'none'
}

function urlScrewType(): 'standard' | 'stubby' {
  return sp.get('type') === 'stubby' ? 'stubby' : 'standard'
}

function LttScrewdriverBinPage() {
  const [screwType, setScrewType] = createSignal<'standard' | 'stubby'>(urlScrewType())
  const [bitHoles, setBitHoles] = createSignal(urlBool('bit_holes', false))
  const [holeSettings, setHoleSettings] = createSignal<BinHoleSettings>(binHoleSettingsFromUrl(sp, 6.2))
  const [zones, setZones] = createSignal<BitZoneSettings>({
    left:  urlZoneSide('zone_left'),
    right: urlZoneSide('zone_right'),
  })

  const bitHoleCount = createMemo(() => collectBitHoles(screwType(), zones().left, zones().right).length)

  const params = createMemo(() => ({
    type: screwType(),
    holes: holeSettings(),
    zones: zones(),
    bitHoles: bitHoles(),
  }))

  const { objects, rendering, selectedObject, toggleObject, download } = useGeometry('ltt-screwdriver-bin', params)

  const updateUrl = () => {
    const p = params()
    const url = new URLSearchParams()
    if (p.type !== 'standard') url.set('type', p.type)
    if (p.bitHoles)             url.set('bit_holes', 'true')
    if (p.zones.left  !== 'none') url.set('zone_left',  p.zones.left)
    if (p.zones.right !== 'none') url.set('zone_right', p.zones.right)
    binHoleSettingsToUrl(url, p.holes)
    window.history.replaceState(null, '', '?' + url.toString())
  }

  const setZone = <K extends keyof BitZoneSettings>(key: K, v: BitZoneSettings[K]) => {
    setZones(prev => ({ ...prev, [key]: v }))
    updateUrl()
  }

  return (
    <PageLayout
      title="LTT Screwdriver Bin"
      description="Gridfinity bin with an exact-fit cavity for the LTT Standard or Stubby screwdriver."
      attribution={attribution}
      designLicense={{ label: 'CC BY-NC 4.0', url: 'https://creativecommons.org/licenses/by-nc/4.0/' }}
      header={<ModelInfo>{info(screwType(), zones())}</ModelInfo>}
      objects={objects}
      selectedObject={selectedObject}
      onObjectClick={toggleObject}
      rendering={rendering}
      footer={<DownloadFooter label="Download" onStl={() => download()} on3mf={() => download('3mf')} />}
    >
      <SidebarSection label="Screwdriver" defaultOpen>
        <SelectField
          label="Model"
          value={screwType()}
          onChange={(v) => { setScrewType(v as 'standard' | 'stubby'); updateUrl() }}
          options={[
            { value: 'standard', label: 'Standard' },
            { value: 'stubby', label: 'Stubby' },
          ]}
        />
      </SidebarSection>
      <SidebarSection label="Extras" defaultOpen>
        <BooleanField label={`Bit holes (${bitHoleCount()})`} value={bitHoles()} onChange={v => { setBitHoles(v); updateUrl() }} />
        <SelectField
          label="Left groove"
          value={zones().left}
          onChange={v => setZone('left', v as 'none' | 'extension' | 'pen')}
          options={[
            { value: 'none', label: 'None' },
            { value: 'extension', label: 'Shaft extension' },
            { value: 'pen', label: 'Pen groove' },
          ]}
        />
        <SelectField
          label="Right groove"
          value={zones().right}
          onChange={v => setZone('right', v as 'none' | 'extension' | 'pen')}
          options={[
            { value: 'none', label: 'None' },
            { value: 'extension', label: 'Shaft extension' },
            { value: 'pen', label: 'Pen groove' },
          ]}
        />
      </SidebarSection>
      <BinHolesSection value={holeSettings()} onChange={(v) => { setHoleSettings(v); updateUrl() }} />
    </PageLayout>
  )
}

render(() => <LttScrewdriverBinPage />, document.getElementById('root')!)
