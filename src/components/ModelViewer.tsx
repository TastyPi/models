import { createEffect, createSignal, onCleanup, onMount, untrack, Show } from 'solid-js'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import type { RawMesh, PreviewMesh } from '../types'
import { VIEW_DIR, addSceneLights, setupCamera } from './sceneHelpers'

interface Props {
  objects?: () => PreviewMesh[] | null
  selectedObject?: () => ReadonlySet<number>
  onObjectClick?: (index: number) => void
}

// Shared material instances — swapped onto meshes without reallocation
const matPrimary   = new THREE.MeshStandardMaterial({ color: 0x6688cc, roughness: 0.4, metalness: 0.1, flatShading: true })
const matHover     = new THREE.MeshStandardMaterial({ color: 0x7799dd, roughness: 0.35, metalness: 0.12, flatShading: true })
const matHighlight = new THREE.MeshStandardMaterial({ color: 0x99bbff, roughness: 0.3, metalness: 0.15, flatShading: true })
const matDimmed    = new THREE.MeshStandardMaterial({ color: 0x2a3a5a, roughness: 0.7, metalness: 0.0, flatShading: true, transparent: true, opacity: 0.35 })


function buildGeo(raw: RawMesh): THREE.BufferGeometry {
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(raw.vertProperties, raw.numProp))
  geo.setIndex(new THREE.BufferAttribute(raw.triVerts, 1))
  geo.computeBoundingSphere()
  return geo
}

export function ModelViewer(props: Props) {
  let containerRef!: HTMLDivElement
  let canvasRef!: HTMLCanvasElement
  const [overlayLabel, setOverlayLabel] = createSignal<string | null>(null)
  const [canReset, setCanReset] = createSignal(false)
  let doResetCamera: (() => void) | null = null

  onMount(() => {
    const renderer = new THREE.WebGLRenderer({ canvas: canvasRef, antialias: true })
    renderer.setPixelRatio(window.devicePixelRatio)

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x1a1a2e)

    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 2000)
    setupCamera(camera)
    camera.position.set(-250, -150, 180)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.target.set(0, 0, 0)
    controls.update()

    addSceneLights(scene)

    let objectMeshes: THREE.Mesh[] = []
    let hoveredIdx = -1
    let rafId: number | null = null
    let hadGeometry = false
    let isResetting = false
    const onCameraMove = () => { if (!isResetting) setCanReset(true) }

    const raycaster = new THREE.Raycaster()
    const mouse = new THREE.Vector2()
    let mouseDownX = 0, mouseDownY = 0

    const render = () => { controls.update(); renderer.render(scene, camera) }
    const scheduleRender = () => {
      if (rafId === null) rafId = requestAnimationFrame(() => { rafId = null; render() })
    }

    controls.addEventListener('change', scheduleRender)

    const syncSize = () => {
      const w = containerRef.clientWidth, h = containerRef.clientHeight
      renderer.setSize(w, h, false)
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      scheduleRender()
    }
    syncSize()

    const ro = new ResizeObserver(syncSize)
    ro.observe(containerRef)

    const selectionLabel = (sel: ReadonlySet<number>) => {
      if (sel.size === 0) return null
      if (sel.size === 1) return props.objects?.()?.[sel.values().next().value!]?.label ?? null
      return `${sel.size} objects selected`
    }

    const objectMat = (i: number, sel: ReadonlySet<number>): THREE.Material => {
      if (sel.has(i)) return matHighlight
      if (i === hoveredIdx) return matHover
      if (sel.size > 0) return matDimmed
      return matPrimary
    }

    const applyMaterials = (sel: ReadonlySet<number>) => {
      for (let i = 0; i < objectMeshes.length; i++) {
        objectMeshes[i].material = objectMat(i, sel)
      }
      scheduleRender()
    }

    // Rebuild scene geometry when objects data changes.
    // Reads selectedObject via untrack so selection changes don't trigger a full rebuild.
    createEffect(() => {
      const objectsData = props.objects?.() ?? null
      const hasGeometry = objectsData !== null && objectsData.length > 0
      const geomChanged = !hadGeometry && hasGeometry
      if (hasGeometry) hadGeometry = true

      for (const m of objectMeshes) { scene.remove(m); m.geometry.dispose() }
      objectMeshes = []
      hoveredIdx = -1
      setOverlayLabel(null)

      const sel = untrack(() => props.selectedObject?.() ?? new Set<number>())

      if (objectsData && objectsData.length > 0) {
        for (let i = 0; i < objectsData.length; i++) {
          objectMeshes.push(new THREE.Mesh(buildGeo(objectsData[i].mesh), objectMat(i, sel)))
          scene.add(objectMeshes[i])
        }
      }

      // Use the narrower of vertical/horizontal half-FOV so the model fits regardless of portrait/landscape
      const fitDist = (r: number) => {
        const fovY = camera.fov * Math.PI / 180
        const fovX = 2 * Math.atan(Math.tan(fovY / 2) * camera.aspect)
        const halfFov = Math.min(fovY, fovX) / 2
        return (r / Math.sin(halfFov)) * 1.2
      }

      let sphere: THREE.Sphere | null = null
      if (objectsData && objectsData.length > 0) {
        const box = new THREE.Box3()
        for (const m of objectMeshes) box.expandByObject(m)
        sphere = new THREE.Sphere()
        box.getBoundingSphere(sphere)
      }

      if (sphere) {
        if (geomChanged) {
          const dist = fitDist(sphere.radius)
          controls.target.copy(sphere.center)
          camera.position.copy(sphere.center).addScaledVector(VIEW_DIR, dist)
          camera.near = dist * 0.01
          camera.far = dist * 10
          camera.updateProjectionMatrix()
          controls.update()
          controls.addEventListener('change', onCameraMove)
        }

        const s = sphere
        doResetCamera = () => {
          isResetting = true
          const dist = fitDist(s.radius)
          controls.target.copy(s.center)
          camera.position.copy(s.center).addScaledVector(VIEW_DIR, dist)
          camera.near = dist * 0.01
          camera.far = dist * 10
          camera.updateProjectionMatrix()
          controls.update()
          scheduleRender()
          setCanReset(false)
          isResetting = false
        }
      }

      scheduleRender()
    })

    // Update materials (only) when selection changes — no geometry rebuild.
    createEffect(() => {
      const sel = props.selectedObject?.() ?? new Set<number>()
      if (objectMeshes.length === 0) return
      hoveredIdx = -1
      canvasRef.style.cursor = ''
      applyMaterials(sel)
      setOverlayLabel(selectionLabel(sel))
    })

    // Raycasting
    const hitIndex = (e: MouseEvent) => {
      if (objectMeshes.length === 0) return -1
      const rect = canvasRef.getBoundingClientRect()
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
      raycaster.setFromCamera(mouse, camera)
      const hits = raycaster.intersectObjects(objectMeshes)
      if (hits.length === 0) return -1
      return objectMeshes.indexOf(hits[0].object as THREE.Mesh)
    }

    const onMouseDown = (e: MouseEvent) => { mouseDownX = e.clientX; mouseDownY = e.clientY }
    const onClick = (e: MouseEvent) => {
      if (Math.hypot(e.clientX - mouseDownX, e.clientY - mouseDownY) > 5) return
      props.onObjectClick?.(hitIndex(e))
    }
    const onMouseMove = (e: MouseEvent) => {
      if (objectMeshes.length === 0) return
      const newHovered = hitIndex(e)
      canvasRef.style.cursor = newHovered >= 0 ? 'pointer' : ''
      if (newHovered === hoveredIdx) return
      hoveredIdx = newHovered
      const sel = props.selectedObject?.() ?? new Set<number>()
      applyMaterials(sel)
      setOverlayLabel(newHovered >= 0 ? (props.objects?.()?.[newHovered]?.label ?? null) : selectionLabel(sel))
    }
    const onMouseLeave = () => {
      if (hoveredIdx < 0) return
      hoveredIdx = -1
      canvasRef.style.cursor = ''
      const sel = props.selectedObject?.() ?? new Set<number>()
      applyMaterials(sel)
      setOverlayLabel(selectionLabel(sel))
    }

    canvasRef.addEventListener('mousedown', onMouseDown)
    canvasRef.addEventListener('click', onClick)
    canvasRef.addEventListener('mousemove', onMouseMove)
    canvasRef.addEventListener('mouseleave', onMouseLeave)

    onCleanup(() => {
      if (rafId !== null) cancelAnimationFrame(rafId)
      controls.removeEventListener('change', scheduleRender)
      controls.removeEventListener('change', onCameraMove)
      ro.disconnect()
      for (const m of objectMeshes) { scene.remove(m); m.geometry.dispose() }
      renderer.dispose()
      canvasRef.removeEventListener('mousedown', onMouseDown)
      canvasRef.removeEventListener('click', onClick)
      canvasRef.removeEventListener('mousemove', onMouseMove)
      canvasRef.removeEventListener('mouseleave', onMouseLeave)
    })
  })

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%', height: '100%' }}>
      <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%' }} />
      <Show when={canReset()}>
        <button
          onClick={() => doResetCamera?.()}
          title="Reset camera"
          style={{
            position: 'absolute', top: '10px', right: '10px',
            background: 'rgba(18,18,31,0.85)', color: '#aabbdd',
            border: '1px solid rgba(170,187,221,0.25)', 'border-radius': '4px',
            padding: '4px 10px', 'font-size': '0.75rem', cursor: 'pointer',
          }}
        >
          Reset view
        </button>
      </Show>
      <Show when={overlayLabel()}>
        {(label) => (
          <div style={{
            position: 'absolute', bottom: '16px', left: '50%', transform: 'translateX(-50%)',
            background: 'rgba(18,18,31,0.85)', color: '#aabbdd',
            padding: '5px 14px', 'border-radius': '4px', 'font-size': '0.8rem',
            'pointer-events': 'none', 'white-space': 'nowrap',
          }}>
            {label()}
          </div>
        )}
      </Show>
    </div>
  )
}
