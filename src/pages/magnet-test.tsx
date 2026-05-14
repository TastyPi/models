import { render } from 'solid-js/web'
import '../index.css'
import { PageLayout } from '../components/PageLayout'
import { useGeometry } from '../hooks/useGeometry'

const btnStyle = {
  padding: '10px', background: '#6688cc', color: '#fff', border: 'none',
  'border-radius': '6px', cursor: 'pointer', 'font-size': '0.875rem', width: '100%',
} as const
const btnStyleOutline = { padding: '8px', background: 'none', color: '#6688cc', border: '1px solid #6688cc', 'border-radius': '6px', cursor: 'pointer', 'font-size': '0.8rem', width: '100%' } as const

function MagnetTestPage() {
  const { geometry, rendering, download } = useGeometry('magnet-test', () => ({}))

  return (
    <PageLayout
      title="Magnet Press-Fit Test"
      description="Compare crush ribs vs plain bore sizes for 6×2mm magnets."
      geometry={geometry}
      rendering={rendering}
      footer={<>
        <button onClick={() => download()} style={btnStyle}>Download STL</button>
        <button onClick={() => download(undefined, '3mf')} style={btnStyleOutline}>Download 3MF</button>
      </>}
    >
      <div style={{ 'font-size': '0.8rem', color: '#777', 'line-height': '1.6' }}>
        <p style={{ margin: '0 0 8px' }}>Six pockets, left to right: crush ribs, then plain bores at 6.0, 6.1, 6.2, 6.3, and 6.4 mm diameter.</p>
        <p style={{ margin: '0 0 12px' }}>Each pocket has a centre push-out hole (3 mm) so you can recover magnets after testing.</p>
        <a
          href="https://www.printables.com/model/1718287-magnet-press-fit-tester"
          target="_blank" rel="noopener noreferrer"
          style={{ display: 'inline-flex', 'align-items': 'center', gap: '6px', color: '#e27546', 'text-decoration': 'none', opacity: '0.85', transition: 'opacity 0.15s' }}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.85')}
        >
          <svg width="14" height="14" viewBox="0 0 512 512" style={{ 'flex-shrink': '0' }}>
            <path d="M77.9 512 256 409.6 77.9 307.2zM256 0 77.9 102.4 256 204.8v204.8l178.1-102.4V102.4z" fill="#e27546"/>
          </svg>
          View on Printables
        </a>
      </div>
    </PageLayout>
  )
}

render(() => <MagnetTestPage />, document.getElementById('root')!)
