import { createEffect, createSignal } from 'solid-js'
import { render } from 'solid-js/web'
import '../index.css'
import { PageLayout } from '../components/PageLayout'
import { BooleanField } from '../components/BooleanField'
import { SelectField } from '../components/SelectField'
import { SidebarSection } from '../components/SidebarSection'
import { useGeometry } from '../hooks/useGeometry'
import { attribution } from '../models/corner-radius-gauge'

const DEFAULTS = { text_style: 'debossed', text_top: true, text_bottom: false }

function CornerRadiusGaugePage() {
  const sp = new URLSearchParams(window.location.search)
  const [textStyle, setTextStyle] = createSignal(sp.get('text_style') ?? DEFAULTS.text_style)
  const [textTop, setTextTop] = createSignal(sp.has('text_top') ? sp.get('text_top') === 'true' : DEFAULTS.text_top)
  const [textBottom, setTextBottom] = createSignal(sp.has('text_bottom') ? sp.get('text_bottom') === 'true' : DEFAULTS.text_bottom)

  const { geometry, pieces, rendering, selectedPiece, togglePiece, download } = useGeometry(
    'corner-radius-gauge',
    () => ({ text_style: textStyle(), text_top: textTop(), text_bottom: textBottom() }),
  )

  createEffect(() => {
    const params = new URLSearchParams()
    if (textStyle() !== DEFAULTS.text_style) params.set('text_style', textStyle())
    if (textTop() !== DEFAULTS.text_top) params.set('text_top', String(textTop()))
    if (textBottom() !== DEFAULTS.text_bottom) params.set('text_bottom', String(textBottom()))
    const qs = params.toString()
    history.replaceState(null, '', qs ? '?' + qs : window.location.pathname)
  })

  return (
    <PageLayout
      title="Corner Radius Gauge"
      description="Set of 10 gauge tiles for corner radii from 0.5 to 5 mm in 0.5 mm steps."
      attribution={attribution}
      geometry={geometry}
      pieces={pieces}
      selectedPiece={selectedPiece}
      onPieceClick={togglePiece}
      download={download}
      rendering={rendering}
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
    </PageLayout>
  )
}


render(() => <CornerRadiusGaugePage />, document.getElementById('root')!)
