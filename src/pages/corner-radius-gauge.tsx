import { createEffect, createMemo, createSignal, Show } from 'solid-js'
import { render } from 'solid-js/web'
import '../index.css'
import { PageLayout } from '../components/PageLayout'
import { BooleanField } from '../components/BooleanField'
import { SelectField } from '../components/SelectField'
import { OptionalNumberSlider } from '../components/NumberSlider'
import { SidebarSection } from '../components/SidebarSection'
import { DownloadFooter } from '../components/DownloadFooter'
import { useGeometry } from '../hooks/useGeometry'
import { attribution } from '../models/corner-radius-gauge'

const DEFAULTS = { text_style: 'debossed', text_top: true, text_bottom: false }

function urlOptInt(sp: URLSearchParams, key: string): number | null {
  const v = sp.get(key)
  if (v === null) return null
  const n = parseInt(v, 10)
  return isNaN(n) ? null : n
}

function CornerRadiusGaugePage() {
  const sp = new URLSearchParams(window.location.search)
  const [textStyle, setTextStyle] = createSignal(sp.get('text_style') ?? DEFAULTS.text_style)
  const [textTop, setTextTop] = createSignal(sp.has('text_top') ? sp.get('text_top') === 'true' : DEFAULTS.text_top)
  const [textBottom, setTextBottom] = createSignal(sp.has('text_bottom') ? sp.get('text_bottom') === 'true' : DEFAULTS.text_bottom)
  const [bodyExtruder, setBodyExtruder] = createSignal<number | null>(urlOptInt(sp, 'body_extruder'))
  const [textExtruder, setTextExtruder] = createSignal<number | null>(urlOptInt(sp, 'text_extruder'))

  const isMulticolour = createMemo(() => textStyle() === 'multicolour')

  const { objects, rendering, selectedObject, toggleObject, download } = useGeometry(
    'corner-radius-gauge',
    () => ({
      text_style: textStyle(), text_top: textTop(), text_bottom: textBottom(),
      body_extruder: isMulticolour() ? bodyExtruder() : null,
      text_extruder: isMulticolour() ? textExtruder() : null,
    }),
  )

  createEffect(() => {
    const params = new URLSearchParams()
    if (textStyle() !== DEFAULTS.text_style) params.set('text_style', textStyle())
    if (textTop() !== DEFAULTS.text_top) params.set('text_top', String(textTop()))
    if (textBottom() !== DEFAULTS.text_bottom) params.set('text_bottom', String(textBottom()))
    if (bodyExtruder() !== null) params.set('body_extruder', String(bodyExtruder()))
    if (textExtruder() !== null) params.set('text_extruder', String(textExtruder()))
    const qs = params.toString()
    history.replaceState(null, '', qs ? '?' + qs : window.location.pathname)
  })

  return (
    <PageLayout
      title="Corner Radius Gauge"
      description="Set of 10 gauge tiles for corner radii from 0.5 to 5 mm in 0.5 mm steps."
      attribution={attribution}
      objects={objects}
      selectedObject={selectedObject}
      onObjectClick={toggleObject}
      rendering={rendering}
      footer={
        <DownloadFooter
          label="Download"
          onStl={isMulticolour() ? undefined : () => download('stl')}
          on3mf={() => download('3mf')}
        />
      }
    >
      <SidebarSection label="Text" defaultOpen>
        <SelectField
          label="Style"
          value={textStyle()}
          onChange={setTextStyle}
          default={DEFAULTS.text_style}
          options={[
            { value: 'debossed', label: 'Debossed' },
            { value: 'multicolour', label: 'Multi-colour' },
          ]}
        />
        <BooleanField label="On top face" value={textTop()} onChange={setTextTop} default={DEFAULTS.text_top} />
        <BooleanField label="On bottom face" value={textBottom()} onChange={setTextBottom} default={DEFAULTS.text_bottom} />
      </SidebarSection>
      <Show when={isMulticolour()}>
        <SidebarSection label="Extruders" defaultOpen>
          <OptionalNumberSlider label="Body" value={bodyExtruder()} onChange={setBodyExtruder} min={1} max={8} step={1} />
          <OptionalNumberSlider label="Text" value={textExtruder()} onChange={setTextExtruder} min={1} max={8} step={1} />
        </SidebarSection>
      </Show>
    </PageLayout>
  )
}

render(() => <CornerRadiusGaugePage />, document.getElementById('root')!)
