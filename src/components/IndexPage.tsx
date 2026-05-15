import { createSignal, onMount, onCleanup, Show, For } from 'solid-js'
import * as THREE from 'three'
import type { PreviewMesh } from '../types'
import styles from './IndexPage.module.css'
import { VIEW_DIR, addSceneLights, setupCamera } from './sceneHelpers'

const MODELS: { slug: string; label: string; description: string; params: Record<string, unknown> }[] = [
  {
    slug: 'corner-radius-gauge',
    label: 'Corner Radius Gauge',
    description: 'Set of 10 gauge tiles for corner radii from 0.5 to 5 mm in 0.5 mm steps.',
    params: { text_style: 'debossed', text_top: true, text_bottom: false },
  },
  {
    slug: 'gridfinity-bin',
    label: 'Gridfinity Bin',
    description: 'Parametric Gridfinity bin with optional magnets, stacking lip, and X/Y dividers.',
    params: {
      cells_x: 2, cells_y: 2, height_units: 3, stacking_lip: true,
      magnets: false, magnet_style: 'smooth', magnet_size: 6.2,
      chamfer: false, supportless: false, corner_magnets: false, dividers_x: 0, dividers_y: 0,
    },
  },
  {
    slug: 'gridfinity-baseplate',
    label: 'Gridfinity Baseplate',
    description: 'Parametric Gridfinity baseplate with optional walls, magnet pockets, and print-bed-aware splitting.',
    params: {
      cells_x: 3, cells_y: 3,
      edge_n: 'wall', edge_s: 'wall', edge_e: 'wall', edge_w: 'wall',
      wall_n: null, wall_s: null, wall_e: null, wall_w: null,
      separate_walls: false, wall_connector: 'wall_male',
      corner_radius_sw: 0, corner_radius_se: 0, corner_radius_ne: 0, corner_radius_nw: 0,
      base_style: 'open', magnets: false,
      restrict_bed: false, bed_type: 'prusa_core_one', bed_x: 250, bed_y: 220,
    },
  },
  {
    slug: 'magnet-test',
    label: 'Magnet Press-Fit Test',
    description: 'Six pockets left to right: crush ribs, then plain bores at 6.0, 6.1, 6.2, 6.3, 6.4 mm. Centre push-out hole in each.',
    params: {},
  },
  {
    slug: 'wall-hook',
    label: 'Wall Hook',
    description: 'Triangular prism hook. Side (a) mounts against the wall with screw holes, side (b) is the hook arm with a retention lip, side (c) is the hypotenuse — print flat on side (c), no supports needed.',
    params: {
      wall_side_height: 20, depth: 10, width: 50,
      lip_height: 25, lip_thickness: 5, lip_edge_radius: 2.5,
      screw_holes: 2, screw_spacing: 20, screw_type: 'wood4', screw_shaft: 4, screw_head: 8,
      driver_type: 'ltt', driver_diameter: 10, countersunk: true,
    },
  },
]

function renderThumbnail(objects: PreviewMesh[]): string {
  const W = 280, H = 200
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true })
  renderer.setSize(W, H, false)

  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x1a1a2e)

  const mat = new THREE.MeshStandardMaterial({ color: 0x6688cc, roughness: 0.4, metalness: 0.1, flatShading: true })
  const geos: THREE.BufferGeometry[] = []
  const box = new THREE.Box3()
  for (const { mesh } of objects) {
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(mesh.vertProperties, mesh.numProp))
    geo.setIndex(new THREE.BufferAttribute(mesh.triVerts, 1))
    geo.computeBoundingSphere()
    geos.push(geo)
    scene.add(new THREE.Mesh(geo, mat))
    box.expandByObject(new THREE.Mesh(geo))
  }

  addSceneLights(scene)

  const sphere = new THREE.Sphere()
  box.getBoundingSphere(sphere)
  const camera = new THREE.PerspectiveCamera(45, W / H, 0.1, sphere.radius * 20)
  setupCamera(camera)
  const dist = (sphere.radius / Math.sin((45 / 2) * (Math.PI / 180))) * 1.1
  camera.position.copy(sphere.center).addScaledVector(VIEW_DIR, dist)
  camera.lookAt(sphere.center)

  renderer.render(scene, camera)
  const dataUrl = canvas.toDataURL('image/jpeg', 0.85)

  renderer.dispose()
  for (const geo of geos) geo.dispose()
  mat.dispose()

  return dataUrl
}

type WorkerOutMsg =
  | { type: 'result'; key: string; objects: PreviewMesh[] }
  | { type: 'error'; key: string }

export function IndexPage() {
  const [thumbnails, setThumbnails] = createSignal<Record<string, string>>({})

  onMount(() => {
    const worker = new Worker(new URL('../previewWorker.ts', import.meta.url), { type: 'module' })

    worker.onmessage = (e: MessageEvent<WorkerOutMsg>) => {
      const msg = e.data
      if (msg.type !== 'result') return
      try {
        const thumb = renderThumbnail(msg.objects)
        setThumbnails(prev => ({ ...prev, [msg.key]: thumb }))
      } catch (err) {
        console.error('thumbnail render failed for', msg.key, err)
      }
    }

    for (const entry of MODELS) {
      worker.postMessage({ type: 'generate', key: entry.slug, slug: entry.slug, params: entry.params })
    }

    onCleanup(() => worker.terminate())
  })

  return (
    <div class={styles.page}>
      <h1 class={styles.heading}>Models</h1>
      <p class={styles.subheading}>Parametric 3D-printable models</p>
      <div class={styles.grid}>
        <For each={MODELS}>
          {(entry) => (
            <a href={`${entry.slug}/`} class={styles.card}>
              <Show
                when={thumbnails()[entry.slug]}
                fallback={
                  <div class={styles.thumbnailPlaceholder}>
                    <span class={styles.thumbnailPlaceholderText}>Loading…</span>
                  </div>
                }
              >
                {(src) => <img src={src()} alt={entry.label} class={styles.thumbnail} />}
              </Show>
              <div class={styles.cardBody}>
                <div class={styles.cardTitle}>{entry.label}</div>
                <div class={styles.cardDescription}>{entry.description}</div>
              </div>
            </a>
          )}
        </For>
      </div>
      <footer class={styles.footer}>
        <div>© 2026 Graham Rogers</div>
        <div>
          <a href="https://opensource.org/licenses/MIT" target="_blank" rel="noopener noreferrer" class={styles.footerLink}>MIT</a>
          {' '}(code) ·{' '}
          <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer" class={styles.footerLink}>CC BY 4.0</a>
          {' '}(designs)
        </div>
      </footer>
    </div>
  )
}
