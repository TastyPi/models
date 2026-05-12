import { createSignal, createEffect, createResource, Show, For } from 'solid-js'
import * as THREE from 'three'
import type { Manifold } from 'manifold-3d'
import { initManifold } from '../manifold'
import { isPieced, type GeomResult } from '../types'
import * as wallHook from '../models/wall-hook'
import * as gridfinityBaseplate from '../models/gridfinity-baseplate'
import * as cornerRadiusGauge from '../models/corner-radius-gauge'
import * as gridfinityBin from '../models/gridfinity-bin'
import * as magnetTest from '../models/magnet-test'

function extractMerged(result: GeomResult): Manifold {
  return isPieced(result) ? result.merged : result
}

const MODELS: { slug: string; label: string; description: string; generate: () => Manifold }[] = [
  {
    slug: 'wall-hook',
    label: 'Wall Hook',
    description: 'Triangular prism hook. Side (a) mounts against the wall with screw holes, side (b) is the hook arm with a retention lip, side (c) is the hypotenuse — print flat on side (c), no supports needed.',
    generate: () => wallHook.generate({
      wall_side_height: 20, depth: 10, width: 50,
      lip_height: 25, lip_thickness: 5, lip_edge_radius: 2.5,
      screw_holes: 2, screw_spacing: 20, screw_type: 'wood4', screw_shaft: 4, screw_head: 8,
      driver_type: 'ltt', driver_diameter: 10, countersunk: true,
    }),
  },
  {
    slug: 'gridfinity-baseplate',
    label: 'Gridfinity Baseplate',
    description: 'Parametric Gridfinity baseplate with optional walls, magnet pockets, and print-bed-aware splitting.',
    generate: () => extractMerged(gridfinityBaseplate.generate({
      cells_x: 3, cells_y: 3,
      edge_n: 'wall', edge_s: 'wall', edge_e: 'wall', edge_w: 'wall',
      wall_n: null, wall_s: null, wall_e: null, wall_w: null,
      separate_walls: false, wall_connector: 'wall_male', corner_style: 'corner_l',
      corner_radius_sw: 0, corner_radius_se: 0, corner_radius_ne: 0, corner_radius_nw: 0,
      base_style: 'open', magnets: false,
      restrict_bed: false, bed_type: 'prusa_core_one', bed_x: 250, bed_y: 220,
    })).rotate(-90, 0, 0),
  },
  {
    slug: 'corner-radius-gauge',
    label: 'Corner Radius Gauge',
    description: 'Set of 10 gauge tiles for corner radii from 0.5 to 5 mm in 0.5 mm steps.',
    generate: () => extractMerged(cornerRadiusGauge.generate(
      { text_style: 'debossed', text_top: true, text_bottom: false }
    )).rotate(-90, 0, 0),
  },
  {
    slug: 'gridfinity-box',
    label: 'Gridfinity Bin',
    description: 'Parametric Gridfinity bin with optional magnets, stacking lip, and X/Y dividers.',
    generate: () => gridfinityBin.generate({
      cells_x: 2, cells_y: 2, height_units: 3, stacking_lip: true,
      magnets: false, magnet_style: 'smooth', magnet_size: 6.2,
      chamfer: false, supportless: false, dividers_x: 0, dividers_y: 0,
    }),
  },
  {
    slug: 'magnet-test',
    label: 'Magnet Press-Fit Test',
    description: 'Six pockets left to right: crush ribs, then plain bores at 6.0, 6.1, 6.2, 6.3, 6.4 mm. Centre push-out hole in each.',
    generate: () => magnetTest.generate({}).rotate(-90, 0, 0),
  },
]

function renderThumbnail(geom: Manifold): string {
  const W = 280, H = 200
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true })
  renderer.setSize(W, H, false)

  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x1a1a2e)

  const m = geom.getMesh()
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
  ;(mesh.material as THREE.MeshStandardMaterial).dispose()

  return dataUrl
}

export function IndexPage() {
  const [ready] = createResource(initManifold)
  const [thumbnails, setThumbnails] = createSignal<Record<string, string>>({})

  createEffect(() => {
    if (!ready()) return
    const thumbs: Record<string, string> = {}
    for (const entry of MODELS) {
      try {
        thumbs[entry.slug] = renderThumbnail(entry.generate())
      } catch (e) {
        console.error('thumbnail failed for', entry.slug, e)
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
        <For each={MODELS}>
          {(entry) => (
            <a
              href={`${entry.slug}/`}
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
                when={thumbnails()[entry.slug]}
                fallback={
                  <div style={{ height: '160px', background: '#0e0e1a', display: 'flex', 'align-items': 'center', 'justify-content': 'center' }}>
                    <span style={{ color: '#333', 'font-size': '0.75rem' }}>{ready() ? '—' : 'Loading…'}</span>
                  </div>
                }
              >
                {(src) => <img src={src()} alt={entry.label} style={{ display: 'block', width: '100%', height: '160px', 'object-fit': 'cover' }} />}
              </Show>
              <div style={{ padding: '16px' }}>
                <div style={{ 'font-size': '1rem', 'font-weight': '600', color: '#fff', 'margin-bottom': '6px' }}>
                  {entry.label}
                </div>
                <div style={{ 'font-size': '0.8rem', color: '#666', 'line-height': '1.5' }}>
                  {entry.description}
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
