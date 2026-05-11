import { render } from 'solid-js/web'
import '../index.css'
import { PageLayout } from '../components/PageLayout'
import { useGeometry } from '../hooks/useGeometry'

const btnStyle = {
  padding: '10px', background: '#6688cc', color: '#fff', border: 'none',
  'border-radius': '6px', cursor: 'pointer', 'font-size': '0.875rem', width: '100%',
} as const

function MagnetTestPage() {
  const { geometry, rendering, download } = useGeometry('magnet-test', () => ({}))

  return (
    <PageLayout
      title="Magnet Press-Fit Test"
      description="Compare crush ribs vs plain bore sizes for 6×2mm magnets."
      geometry={geometry}
      rendering={rendering}
      footer={<button onClick={() => download()} style={btnStyle}>Download STL</button>}
    >
      <div style={{ 'font-size': '0.8rem', color: '#777', 'line-height': '1.6' }}>
        <p style={{ margin: '0 0 8px' }}>Left to right: crush ribs (Cr), then plain bores at 6.0 – 6.4 mm.</p>
        <p style={{ margin: '0' }}>Centre hole in each pocket lets you push magnets back out.</p>
      </div>
    </PageLayout>
  )
}

render(() => <MagnetTestPage />, document.getElementById('root')!)
