import { createSignal, createMemo, createResource, Show } from 'solid-js'
import { initManifold } from '../manifold'
import type { ModelDefinition } from '../types'
import { ModelViewer } from './ModelViewer'
import { ParameterForm } from './ParameterForm'

interface Props {
  model: ModelDefinition
}

function makeDefaultParams(model: ModelDefinition) {
  return Object.fromEntries(
    Object.entries(model.parameters).map(([k, p]) => [k, p.default])
  ) as Record<string, number | boolean>
}

function paramsFromUrl(model: ModelDefinition, defaults: Record<string, number | boolean>) {
  const sp = new URLSearchParams(window.location.search)
  const out = { ...defaults }
  for (const [k, p] of Object.entries(model.parameters)) {
    const val = sp.get(k)
    if (val !== null) out[k] = p.type === 'boolean' ? val === 'true' : parseFloat(val)
  }
  return out
}

function paramsToUrl(p: Record<string, number | boolean>, defaults: Record<string, number | boolean>) {
  const sp = new URLSearchParams()
  for (const [k, v] of Object.entries(p)) {
    if (v !== defaults[k]) sp.set(k, String(v))
  }
  const qs = sp.toString()
  history.replaceState(null, '', qs ? '?' + qs : window.location.pathname)
}

export function ModelPage(props: Props) {
  const [ready] = createResource(initManifold)

  const defaults = makeDefaultParams(props.model)
  const [params, setParams] = createSignal(paramsFromUrl(props.model, defaults))

  const updateParams = (k: string, v: number | boolean) => {
    const next = { ...params(), [k]: v }
    setParams(next)
    paramsToUrl(next, defaults)
  }

  const geometry = createMemo(() => {
    if (!ready()) return null
    try { return props.model.generate(params()) } catch (e) { console.error(e); return null }
  })

  const downloadStl = () => {
    const geom = geometry()
    if (!geom) return
    const transformed = props.model.exportTransform
      ? props.model.exportTransform(params(), geom)
      : geom
    const buf = buildStl((transformed as any).getMesh())
    const url = URL.createObjectURL(new Blob([buf], { type: 'application/octet-stream' }))
    Object.assign(document.createElement('a'), {
      href: url,
      download: props.model.name.toLowerCase().replace(/\s+/g, '-') + '.stl',
    }).click()
    URL.revokeObjectURL(url)
  }

  return (
    <div style={{ display: 'flex', height: '100vh', 'font-family': 'system-ui, sans-serif', color: '#e0e0e0' }}>
      <aside style={{ width: '260px', 'flex-shrink': '0', background: '#12121f', padding: '20px', 'overflow-y': 'auto', display: 'flex', 'flex-direction': 'column', gap: '16px' }}>
        <div>
          <a href="../" style={{ 'font-size': '0.75rem', color: '#555', 'text-decoration': 'none', display: 'inline-block', 'margin-bottom': '12px' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#6688cc')}
            onMouseLeave={(e) => (e.currentTarget.style.color = '#555')}
          >← All models</a>
          <h2 style={{ margin: '0 0 4px', 'font-size': '1.1rem', color: '#fff' }}>{props.model.name}</h2>
          <p style={{ margin: 0, 'font-size': '0.8rem', color: '#777' }}>{props.model.description}</p>
        </div>

        <Show when={!ready.loading} fallback={<p style={{ color: '#777', 'font-size': '0.85rem' }}>Initializing…</p>}>
          <ParameterForm
            parameters={props.model.parameters}
            values={params()}
            groups={props.model.groups}
            onChange={updateParams}
          />
          <button
            onClick={downloadStl}
            style={{ padding: '10px', background: '#6688cc', color: '#fff', border: 'none', 'border-radius': '6px', cursor: 'pointer', 'font-size': '0.875rem', 'margin-top': 'auto' }}
          >
            Download STL
          </button>
        </Show>
      </aside>

      <main style={{ flex: '1' }}>
        <ModelViewer geometry={geometry} />
      </main>
    </div>
  )
}

// Build a binary STL. Coordinates are remapped to Z-up for slicer compatibility:
// slicer X = manifold X, slicer Y = -manifold Z, slicer Z = manifold Y
function buildStl(m: { vertProperties: Float32Array; triVerts: Uint32Array; numProp: number }): ArrayBuffer {
  const { vertProperties: v, triVerts: t, numProp: s } = m
  const n = t.length / 3
  const buf = new ArrayBuffer(84 + n * 50)
  const dv = new DataView(buf)
  dv.setUint32(80, n, true)
  let o = 84
  const px = (base: number) =>  v[base]
  const py = (base: number) => -v[base + 2]
  const pz = (base: number) =>  v[base + 1]
  for (let i = 0; i < n; i++) {
    const a = t[i * 3] * s, b = t[i * 3 + 1] * s, c = t[i * 3 + 2] * s
    const ux = px(b)-px(a), uy = py(b)-py(a), uz = pz(b)-pz(a)
    const wx = px(c)-px(a), wy = py(c)-py(a), wz = pz(c)-pz(a)
    const nx = uy*wz-uz*wy, ny = uz*wx-ux*wz, nz = ux*wy-uy*wx
    const len = Math.hypot(nx, ny, nz) || 1
    dv.setFloat32(o, nx/len, true); dv.setFloat32(o+4, ny/len, true); dv.setFloat32(o+8, nz/len, true); o += 12
    for (const idx of [a, b, c]) {
      dv.setFloat32(o, px(idx), true); dv.setFloat32(o+4, py(idx), true); dv.setFloat32(o+8, pz(idx), true); o += 12
    }
    o += 2
  }
  return buf
}
