import { createSignal, createEffect, createResource, Show, For } from 'solid-js'
import * as THREE from 'three'
import { initManifold } from '../manifold'
import { groups } from '../models/registry'

function renderThumbnail(geom: unknown): string {
  const W = 280, H = 200
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true })
  renderer.setSize(W, H, false)

  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x1a1a2e)

  const m = (geom as any).getMesh()
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(m.vertProperties, m.numProp))
  geo.setIndex(new THREE.BufferAttribute(m.triVerts, 1))
  geo.computeBoundingSphere()
  geo.computeVertexNormals()

  const mesh = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({ color: 0x6688cc, roughness: 0.4, metalness: 0.1, flatShading: true })
  )
  scene.add(mesh)

  scene.add(new THREE.AmbientLight(0xffffff, 0.5))
  const sun = new THREE.DirectionalLight(0xffffff, 1.2)
  sun.position.set(100, 200, 100)
  scene.add(sun)
  const fill = new THREE.DirectionalLight(0x8899ff, 0.4)
  fill.position.set(-100, 50, -100)
  scene.add(fill)

  const sphere = geo.boundingSphere!
  const camera = new THREE.PerspectiveCamera(45, W / H, 0.1, sphere.radius * 20)
  const viewDir = new THREE.Vector3(1.2, 0.9, 2).normalize()
  const dist = (sphere.radius / Math.sin((45 / 2) * (Math.PI / 180))) * 1.1
  camera.position.copy(sphere.center).addScaledVector(viewDir, dist)
  camera.lookAt(sphere.center)

  renderer.render(scene, camera)
  const dataUrl = canvas.toDataURL('image/jpeg', 0.85)

  renderer.dispose()
  geo.dispose()
  ;(mesh.material as THREE.Material).dispose()

  return dataUrl
}

export function IndexPage() {
  const [ready] = createResource(initManifold)
  const [thumbnails, setThumbnails] = createSignal<Record<string, string>>({})

  createEffect(() => {
    if (!ready()) return
    const thumbs: Record<string, string> = {}
    for (const group of groups) {
      const { slug, model } = group.entries[0]
      const p = model.presets
      const defaults = Array.isArray(p) ? { ...p[0].values } : { ...p }
      try {
        const result = model.generate(defaults)
        let geom = (result !== null && typeof result === 'object' && 'pieces' in (result as object))
          ? (result as any).merged
          : result
        if (model.flatModel) geom = (geom as any).rotate([-90, 0, 0])
        thumbs[group.slug] = renderThumbnail(geom)
      } catch (e) {
        console.error('thumbnail failed for', slug, e)
      }
    }
    setThumbnails(thumbs)
  })

  return (
    <div style={{
      'min-height': '100vh', background: '#0e0e1a', color: '#e0e0e0',
      'font-family': 'system-ui, sans-serif', padding: '48px 32px',
      display: 'flex', 'flex-direction': 'column',
    }}>
      <h1 style={{ margin: '0 0 8px', 'font-size': '1.5rem', color: '#fff' }}>Models</h1>
      <p style={{ margin: '0 0 40px', 'font-size': '0.875rem', color: '#555' }}>
        Parametric 3D-printable models
      </p>
      <div style={{ display: 'grid', 'grid-template-columns': 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px', 'max-width': '960px' }}>
        <For each={groups}>
          {(group) => (
            <a
              href={`${group.slug}/`}
              style={{
                display: 'block', background: '#12121f',
                'border-radius': '8px', border: '1px solid #1e1e30',
                'text-decoration': 'none', color: 'inherit',
                transition: 'border-color 0.15s', overflow: 'hidden',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#6688cc')}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#1e1e30')}
            >
              <Show
                when={thumbnails()[group.slug]}
                fallback={
                  <div style={{ height: '160px', background: '#0e0e1a', display: 'flex', 'align-items': 'center', 'justify-content': 'center' }}>
                    <span style={{ color: '#333', 'font-size': '0.75rem' }}>{ready() ? '—' : 'Loading…'}</span>
                  </div>
                }
              >
                {(src) => <img src={src()} alt={group.label} style={{ display: 'block', width: '100%', height: '160px', 'object-fit': 'cover' }} />}
              </Show>
              <div style={{ padding: '16px' }}>
                <div style={{ 'font-size': '1rem', 'font-weight': '600', color: '#fff', 'margin-bottom': '6px' }}>
                  {group.label}
                </div>
                <div style={{ 'font-size': '0.8rem', color: '#666', 'line-height': '1.5' }}>
                  {group.description ?? group.entries[0].model.description}
                </div>
              </div>
            </a>
          )}
        </For>
      </div>
      <footer style={{ 'font-size': '0.72rem', color: '#555', 'line-height': '1.7', 'margin-top': 'auto', 'padding-top': '48px' }}>
        <div>© 2026 Graham Rogers</div>
        <div>
          <a href="https://opensource.org/licenses/MIT" target="_blank" rel="noopener noreferrer"
            style={{ color: '#666', 'text-decoration': 'none' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#aabbdd')}
            onMouseLeave={(e) => (e.currentTarget.style.color = '#666')}
          >MIT</a>
          {' '}(code) ·{' '}
          <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer"
            style={{ color: '#666', 'text-decoration': 'none' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#aabbdd')}
            onMouseLeave={(e) => (e.currentTarget.style.color = '#666')}
          >CC BY 4.0</a>
          {' '}(designs)
        </div>
      </footer>
    </div>
  )
}
