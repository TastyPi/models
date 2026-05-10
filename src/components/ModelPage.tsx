import { createSignal, createMemo, createEffect, on, onCleanup, Show, For } from 'solid-js'
import type { ModelDefinition, ModelGroup, Preset, RawMesh } from '../types'
import { ModelViewer } from './ModelViewer'
import { ParameterForm } from './ParameterForm'

type PieceMesh = { label: string; mesh: RawMesh; secondaryMesh?: RawMesh }

// LRU geometry cache — keyed by model name + serialised params.
// Map insertion order gives O(1) LRU: delete+re-insert on hit, evict from front on overflow.
class GeometryCache {
  private entries = new Map<string, { mesh: RawMesh; pieces?: PieceMesh[]; bytes: number }>()
  private used = 0
  private readonly limit: number
  constructor(limit: number) { this.limit = limit }

  get(key: string) {
    const e = this.entries.get(key)
    if (!e) return undefined
    this.entries.delete(key)
    this.entries.set(key, e)
    return e
  }

  set(key: string, mesh: RawMesh, pieces?: PieceMesh[]) {
    const bytes = mesh.vertProperties.byteLength + mesh.triVerts.byteLength +
      (pieces?.reduce((s, p) => s + p.mesh.vertProperties.byteLength + p.mesh.triVerts.byteLength +
        (p.secondaryMesh?.vertProperties.byteLength ?? 0) + (p.secondaryMesh?.triVerts.byteLength ?? 0), 0) ?? 0)
    if (this.entries.has(key)) { this.used -= this.entries.get(key)!.bytes; this.entries.delete(key) }
    this.entries.set(key, { mesh, pieces, bytes })
    this.used += bytes
    for (const [k, e] of this.entries) {
      if (this.used <= this.limit || this.entries.size <= 1) break
      this.used -= e.bytes
      this.entries.delete(k)
    }
  }
}

const geometryCache = new GeometryCache(256 * 1024 * 1024)

interface Props {
  model: ModelDefinition  // default model (first entry, or sole model)
  group?: ModelGroup
}

// Returns the base defaults for a model: first preset values if presets is a list, otherwise the plain record.
function baseDefaults(model: ModelDefinition): Record<string, number | boolean | string> {
  const p = model.presets
  return Array.isArray(p) ? { ...p[0].values } : { ...p }
}

function paramsFromUrl(model: ModelDefinition, defaults: Record<string, number | boolean | string | null>) {
  const sp = new URLSearchParams(window.location.search)
  const out = { ...defaults }
  for (const [k, p] of Object.entries(model.parameters)) {
    if (p.localStorage) continue
    const val = sp.get(k)
    if (val !== null) {
      if (p.type === 'number' && (p as any).optional && val === 'null') out[k] = null
      else if (p.type === 'boolean') out[k] = val === 'true'
      else if (p.type === 'number') out[k] = parseFloat(val)
      else out[k] = val
    }
  }
  return out
}

const LS_KEY = 'persistent-params'

function loadLocalStorage(model: ModelDefinition): Record<string, number | boolean | string | null> {
  try {
    const stored: Record<string, unknown> = JSON.parse(localStorage.getItem(LS_KEY) ?? '{}')
    const out: Record<string, number | boolean | string | null> = {}
    for (const [k, p] of Object.entries(model.parameters)) {
      if (!p.localStorage || !(k in stored)) continue
      const v = stored[k]
      if (p.type === 'boolean' && typeof v === 'boolean') out[k] = v
      else if (p.type === 'number') {
        if (v === null && (p as any).optional) out[k] = null
        else if (typeof v === 'number') out[k] = v
      }
      else if (p.type === 'select' && typeof v === 'string') out[k] = v
    }
    return out
  } catch { return {} }
}

function saveLocalStorage(key: string, value: number | boolean | string | null) {
  try {
    const stored = JSON.parse(localStorage.getItem(LS_KEY) ?? '{}')
    localStorage.setItem(LS_KEY, JSON.stringify({ ...stored, [key]: value }))
  } catch {}
}

export function ModelPage(props: Props) {
  const worker = new Worker(new URL('../renderWorker.ts', import.meta.url), { type: 'module' })
  onCleanup(() => worker.terminate())

  const isMulti = () => (props.group?.entries.length ?? 0) > 1

  // Active slug: read from ?model= on load; null for single-model pages
  const [activeSlug, setActiveSlug] = createSignal<string | null>(
    isMulti()
      ? (new URLSearchParams(window.location.search).get('model') ?? props.group!.entries[0].slug)
      : null
  )

  const activeModel = createMemo((): ModelDefinition => {
    if (!isMulti()) return props.model
    return props.group!.entries.find(e => e.slug === activeSlug())?.model ?? props.model
  })

  const presetList = createMemo((): Preset[] | null => {
    const p = activeModel().presets
    return Array.isArray(p) ? p : null
  })

  // Active preset index: 0 (first) when presets is a list, null otherwise
  const [activePresetIdx, setActivePresetIdx] = createSignal<number | null>(
    Array.isArray(props.model.presets) ? 0 : null
  )

  const effectiveDefaults = createMemo((): Record<string, number | boolean | string> => {
    const list = presetList()
    const idx = activePresetIdx()
    if (list !== null && idx !== null) return { ...baseDefaults(activeModel()), ...list[idx].values }
    return baseDefaults(activeModel())
  })

  const [params, setParams] = createSignal<Record<string, number | boolean | string | null>>({
    ...paramsFromUrl(activeModel(), effectiveDefaults()),
    ...loadLocalStorage(activeModel()),
  })

  // Reset params and preset selection whenever the active model changes (must run before clamping)
  createEffect(on(activeModel, (model) => {
    const list = Array.isArray(model.presets) ? model.presets : null
    setActivePresetIdx(list ? 0 : null)
    setParams({ ...paramsFromUrl(model, baseDefaults(model)), ...loadLocalStorage(model) })
  }, { defer: true }))

  // Clamp all number params to their dynamic bounds in one batched update
  createEffect(() => {
    const current = params()
    const safeVals = current as Record<string, number | boolean | string>
    const corrections: Record<string, number> = {}
    for (const [key, param] of Object.entries(activeModel().parameters)) {
      if (param.type !== 'number') continue
      if (!(key in current)) continue  // params not yet reset for this model — skip
      if (current[key] === null) continue  // optional param that is disabled — skip
      const val = current[key] as number
      const lo = typeof param.min === 'function' ? param.min(safeVals) : (param.min ?? -Infinity)
      const hi = typeof param.max === 'function' ? param.max(safeVals) : (param.max ?? Infinity)
      const clamped = Math.min(Math.max(val, lo), hi)
      if (clamped !== val) corrections[key] = clamped
    }
    if (Object.keys(corrections).length > 0) {
      const next = { ...current, ...corrections }
      setParams(next)
      history.replaceState(null, '', buildQs(next))
    }
  })

  // Build query string including ?model= when not the default entry
  const buildQs = (p: Record<string, number | boolean | string | null>) => {
    const sp = new URLSearchParams()
    const firstSlug = props.group?.entries[0].slug
    if (activeSlug() && activeSlug() !== firstSlug) sp.set('model', activeSlug()!)
    const base = baseDefaults(activeModel())
    const modelParams = activeModel().parameters
    for (const [k, v] of Object.entries(p)) {
      if (modelParams[k]?.localStorage) continue
      if (v !== base[k]) sp.set(k, v === null ? 'null' : String(v))
    }
    const qs = sp.toString()
    return qs ? '?' + qs : window.location.pathname
  }

  const switchModel = (slug: string) => {
    setActiveSlug(slug)
    const firstSlug = props.group?.entries[0].slug
    const qs = slug !== firstSlug ? '?model=' + slug : ''
    history.pushState(null, '', qs || window.location.pathname)
  }

  const applyPreset = (idx: number) => {
    const list = presetList()
    if (!list) return
    setActivePresetIdx(idx)
    const next = { ...baseDefaults(activeModel()), ...list[idx].values }
    setParams(next)
    history.replaceState(null, '', buildQs(next))
  }

  const isDirty = createMemo(() => {
    const defaults = effectiveDefaults()
    const current = params()
    const modelParams = activeModel().parameters
    return Object.keys(defaults).some(k => !modelParams[k]?.localStorage && current[k] !== defaults[k])
  })

  const resetAll = () => {
    const defaults = effectiveDefaults()
    const current = params()
    const next = { ...current }
    for (const [k, p] of Object.entries(activeModel().parameters)) {
      if (!p.localStorage) next[k] = defaults[k]
    }
    setParams(next)
    history.replaceState(null, '', buildQs(next))
  }

  const updateParams = (k: string, v: number | boolean | string | null) => {
    const next = { ...params(), [k]: v }
    setParams(next)
    if (activeModel().parameters[k]?.localStorage) {
      saveLocalStorage(k, v)
    } else {
      history.replaceState(null, '', buildQs(next))
    }
  }

  const [geometry, setGeometry] = createSignal<RawMesh | null>(null)
  const [pieces, setPieces] = createSignal<PieceMesh[] | null>(null)
  const [selectedPiece, setSelectedPiece] = createSignal(-1)
  const [rendering, setRendering] = createSignal(true)
  let currentKey: string | null = null
  const pendingCallbacks = new Map<string, (mesh: RawMesh) => void>()

  worker.onmessage = (e: MessageEvent) => {
    const msg = e.data as { type: 'result'; key: string; mesh: RawMesh; pieces?: PieceMesh[] } | { type: 'error'; key: string }
    if (msg.type === 'result') {
      geometryCache.set(msg.key, msg.mesh, msg.pieces)
      if (msg.key === currentKey) {
        setGeometry(msg.mesh)
        setPieces(msg.pieces ?? null)
        setRendering(false)
        currentKey = null
      }
      const cb = pendingCallbacks.get(msg.key)
      if (cb) { pendingCallbacks.delete(msg.key); cb(msg.mesh) }
    } else {
      if (msg.key === currentKey) { setGeometry(null); setPieces(null); setRendering(false); currentKey = null }
      pendingCallbacks.delete(msg.key)
    }
  }

  createEffect(() => {
    const model = activeModel()
    const p = params()

    setSelectedPiece(-1)

    const key = `${model.name}::${JSON.stringify(p)}`
    const cached = geometryCache.get(key)
    if (cached) {
      currentKey = null
      setGeometry(cached.mesh)
      setPieces(cached.pieces ?? null)
      setRendering(false)
      return
    }

    setRendering(true)
    currentKey = key

    const timer = setTimeout(() => {
      if (currentKey !== key) return
      worker.postMessage({ type: 'generate', key, modelName: model.name, params: p })
    }, 150)

    onCleanup(() => clearTimeout(timer))
  })

  const safeParams = createMemo(() => Object.fromEntries(Object.entries(params()).filter(([, v]) => v !== null)) as Record<string, number | boolean | string>)
  const info = createMemo(() => activeModel().info?.(safeParams()) ?? null)

  const downloadStl = (pieceIndex?: number) => {
    const model = activeModel()
    const p = params()
    const pieceLabel = pieceIndex !== undefined ? pieces()?.[pieceIndex]?.label : undefined
    const slug = (pieceLabel ?? model.name).toLowerCase().replace(/\s+/g, '-')
    const key = `export::${model.name}::${pieceIndex ?? 'all'}::${JSON.stringify(p)}`
    pendingCallbacks.set(key, (mesh) => {
      const buf = buildStl(mesh)
      const url = URL.createObjectURL(new Blob([buf], { type: 'application/octet-stream' }))
      Object.assign(document.createElement('a'), { href: url, download: slug + '.stl' }).click()
      URL.revokeObjectURL(url)
    })
    worker.postMessage({ type: 'export', key, modelName: model.name, params: p, pieceIndex })
  }

  return (
    <div style={{ display: 'flex', height: '100vh', 'font-family': 'system-ui, sans-serif', color: '#e0e0e0' }}>
      <aside style={{ width: '260px', 'flex-shrink': '0', background: '#12121f', display: 'flex', 'flex-direction': 'column', overflow: 'hidden' }}>
        {/* Fixed header */}
        <div style={{ 'padding-top': '20px', 'padding-left': '20px', 'padding-right': '20px', 'padding-bottom': presetList() ? '12px' : '0', 'flex-shrink': '0' }}>
          <a href="../" style={{ 'font-size': '0.75rem', color: '#555', 'text-decoration': 'none', display: 'inline-block', 'margin-bottom': '12px' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#6688cc')}
            onMouseLeave={(e) => (e.currentTarget.style.color = '#555')}
          >← All models</a>
          <Show
            when={isMulti()}
            fallback={<h2 style={{ margin: '0 0 4px', 'font-size': '1.1rem', color: '#fff' }}>{activeModel().name}</h2>}
          >
            <div style={{ 'font-size': '0.6rem', color: '#555', 'text-transform': 'uppercase', 'letter-spacing': '0.08em', 'margin-bottom': '4px' }}>
              {props.group!.label}
            </div>
            <select
              value={activeSlug() ?? undefined}
              onChange={(e) => switchModel(e.currentTarget.value)}
              style={{
                width: '100%', background: '#1e1e30', color: '#fff',
                border: '1px solid #2a2a40', 'border-radius': '6px',
                padding: '6px 8px', 'font-size': '1rem', 'font-weight': '600',
                cursor: 'pointer', 'margin-bottom': '4px',
              }}
            >
              <For each={props.group!.entries}>
                {(entry) => <option value={entry.slug}>{entry.label ?? entry.model.name}</option>}
              </For>
            </select>
          </Show>
          <p style={{ margin: 0, 'font-size': '0.8rem', color: '#777' }}>{activeModel().description}</p>
          <Show when={presetList()}>
            {(list) => (
              <div style={{ 'margin-top': '12px' }}>
                <div style={{ display: 'flex', 'align-items': 'baseline', 'justify-content': 'space-between', 'margin-bottom': '4px' }}>
                  <div style={{ 'font-size': '0.6rem', color: '#555', 'text-transform': 'uppercase', 'letter-spacing': '0.08em' }}>Preset</div>
                  <Show when={isDirty()}>
                    <button
                      onClick={resetAll}
                      style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', 'font-size': '0.7rem', padding: '0' }}
                    >Reset all</button>
                  </Show>
                </div>
                <select
                  value={activePresetIdx() ?? 0}
                  onChange={(e) => applyPreset(parseInt(e.currentTarget.value))}
                  style={{
                    width: '100%', background: '#1e1e30', color: '#fff',
                    border: '1px solid #2a2a40', 'border-radius': '6px',
                    padding: '6px 8px', 'font-size': '0.875rem', cursor: 'pointer',
                  }}
                >
                  <For each={list()}>
                    {(preset, i) => <option value={i()}>{preset.label}</option>}
                  </For>
                </select>
              </div>
            )}
          </Show>
          <Show when={info()}>
            <p style={{ margin: '6px 0 12px', 'font-size': '0.78rem', color: '#5a8a6a', 'font-variant-numeric': 'tabular-nums' }}>{info()}</p>
          </Show>
        </div>

        {/* Scrollable parameters */}
        <div style={{ flex: '1', 'overflow-y': 'auto', padding: '12px 20px', 'border-top': '1px solid #2a2a3a' }}>
          <ParameterForm
            parameters={activeModel().parameters}
            values={params()}
            groups={activeModel().groups}
            defaults={effectiveDefaults()}
            onChange={updateParams}
          />
        </div>

        {/* Fixed footer */}
        <div style={{ padding: '12px 20px 20px', 'flex-shrink': '0', display: 'flex', 'flex-direction': 'column', gap: '8px', 'border-top': '1px solid #2a2a3a' }}>
          <Show when={selectedPiece() >= 0 && pieces()}>
            <button
              onClick={() => downloadStl(selectedPiece())}
              style={{ padding: '10px', background: '#6688cc', color: '#fff', border: 'none', 'border-radius': '6px', cursor: 'pointer', 'font-size': '0.875rem' }}
            >
              Download {pieces()?.[selectedPiece()]?.label} STL
            </button>
            <button
              onClick={() => downloadStl()}
              style={{ padding: '8px', background: 'none', color: '#6688cc', border: '1px solid #6688cc', 'border-radius': '6px', cursor: 'pointer', 'font-size': '0.8rem' }}
            >
              Download all STL
            </button>
          </Show>
          <Show when={!(selectedPiece() >= 0 && pieces())}>
            <button
              onClick={() => downloadStl()}
              style={{ padding: '10px', background: '#6688cc', color: '#fff', border: 'none', 'border-radius': '6px', cursor: 'pointer', 'font-size': '0.875rem' }}
            >
              Download STL
            </button>
          </Show>
          <div style={{ 'border-top': '1px solid #2a2a3a', 'padding-top': '12px', 'font-size': '0.68rem', color: '#666', 'line-height': '1.5' }}>
            <div>
              {'© 2026 Graham Rogers · '}
              <a href="https://github.com/TastyPi/models" target="_blank" rel="noopener noreferrer"
                style={{ color: '#778', 'text-decoration': 'none' }}
                onMouseEnter={(e) => (e.currentTarget.style.color = '#aabbdd')}
                onMouseLeave={(e) => (e.currentTarget.style.color = '#778')}
              >GitHub</a>
            </div>
            <div>
              <a href="https://opensource.org/licenses/MIT" target="_blank" rel="noopener noreferrer" title="MIT licence (source code)"
                style={{ color: '#778', 'text-decoration': 'none' }}
                onMouseEnter={(e) => (e.currentTarget.style.color = '#aabbdd')}
                onMouseLeave={(e) => (e.currentTarget.style.color = '#778')}
              >MIT</a>
              {' (code) · '}
              <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer" title="CC BY 4.0 (generated designs)"
                style={{ color: '#778', 'text-decoration': 'none' }}
                onMouseEnter={(e) => (e.currentTarget.style.color = '#aabbdd')}
                onMouseLeave={(e) => (e.currentTarget.style.color = '#778')}
              >CC BY 4.0</a>
              {' (designs)'}
            </div>
            <Show when={activeModel().attribution && activeModel().attribution!.length > 0}>
              <div style={{ 'margin-top': '2px' }}>
                {'Based on '}
                <For each={activeModel().attribution}>
                  {(credit, i) => (
                    <>
                      {i() > 0 && ' · '}
                      <a href={credit.url} target="_blank" rel="noopener noreferrer"
                        title={`${credit.name} by ${credit.author} (${credit.license})`}
                        style={{ color: '#778', 'text-decoration': 'none', 'white-space': 'nowrap' }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = '#aabbdd')}
                        onMouseLeave={(e) => (e.currentTarget.style.color = '#778')}
                      >{credit.name}</a>
                    </>
                  )}
                </For>
              </div>
            </Show>
          </div>
        </div>
      </aside>

      <main style={{ flex: '1', position: 'relative' }}>
        <ModelViewer
          geometry={geometry}
          pieces={pieces}
          selectedPiece={selectedPiece}
          onPieceClick={setSelectedPiece}
        />
        <Show when={rendering()}>
          <div style={{
            position: 'absolute', bottom: '16px', right: '16px',
            background: 'rgba(18,18,31,0.85)', color: '#666',
            padding: '5px 12px', 'border-radius': '4px', 'font-size': '0.75rem',
          }}>Rendering…</div>
        </Show>
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
