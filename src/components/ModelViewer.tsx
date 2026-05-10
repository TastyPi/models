import { createEffect, onCleanup, onMount } from 'solid-js'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import type { RawMesh } from '../types'

interface Props {
  geometry: () => RawMesh | null
  highlight?: () => RawMesh | null
}

const MAT_PRIMARY   = { color: 0x6688cc, roughness: 0.4, metalness: 0.1, flatShading: true }
const MAT_DIMMED    = { color: 0x2a3a5a, roughness: 0.7, metalness: 0.0, flatShading: true, transparent: true, opacity: 0.35 }
const MAT_HIGHLIGHT = { color: 0x99bbff, roughness: 0.3, metalness: 0.15, flatShading: true }

function buildMesh(raw: RawMesh, matParams: object): THREE.Mesh {
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(raw.vertProperties, raw.numProp))
  geo.setIndex(new THREE.BufferAttribute(raw.triVerts, 1))
  geo.computeBoundingSphere()
  return new THREE.Mesh(geo, new THREE.MeshStandardMaterial(matParams))
}

export function ModelViewer(props: Props) {
  let containerRef!: HTMLDivElement
  let canvasRef!: HTMLCanvasElement

  onMount(() => {
    const renderer = new THREE.WebGLRenderer({ canvas: canvasRef, antialias: true })
    renderer.setPixelRatio(window.devicePixelRatio)

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x1a1a2e)

    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 2000)
    camera.position.set(150, 180, 250)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.target.set(0, 10, 0)
    controls.update()

    scene.add(new THREE.AmbientLight(0xffffff, 0.5))
    const sun = new THREE.DirectionalLight(0xffffff, 1.2)
    sun.position.set(100, 200, 100)
    scene.add(sun)
    const fill = new THREE.DirectionalLight(0x8899ff, 0.4)
    fill.position.set(-100, 50, -100)
    scene.add(fill)

    let mainMesh: THREE.Mesh | null = null
    let hlMesh: THREE.Mesh | null = null
    let rafId: number | null = null
    let lastRaw: RawMesh | null = null

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

    const disposeMesh = (m: THREE.Mesh) => {
      scene.remove(m)
      m.geometry.dispose()
      ;(m.material as THREE.Material).dispose()
    }

    createEffect(() => {
      const raw  = props.geometry()
      const hlRaw = props.highlight?.() ?? null
      const geomChanged = raw !== lastRaw
      lastRaw = raw

      if (mainMesh) { disposeMesh(mainMesh); mainMesh = null }
      if (hlMesh)   { disposeMesh(hlMesh);   hlMesh   = null }

      if (raw) {
        mainMesh = buildMesh(raw, hlRaw ? MAT_DIMMED : MAT_PRIMARY)
        scene.add(mainMesh)
      }
      if (hlRaw) {
        hlMesh = buildMesh(hlRaw, MAT_HIGHLIGHT)
        scene.add(hlMesh)
      }

      if (raw && geomChanged) {
        const sphere = (mainMesh!.geometry as THREE.BufferGeometry).boundingSphere!
        const dist = (sphere.radius / Math.sin((45 / 2) * (Math.PI / 180))) * 1.2
        controls.target.copy(sphere.center)
        camera.position.copy(sphere.center).addScaledVector(new THREE.Vector3(1.2, 0.9, 2).normalize(), dist)
        camera.near = dist * 0.01
        camera.far = dist * 10
        camera.updateProjectionMatrix()
        controls.update()
      }

      scheduleRender()
    })

    onCleanup(() => {
      if (rafId !== null) cancelAnimationFrame(rafId)
      controls.removeEventListener('change', scheduleRender)
      ro.disconnect()
      renderer.dispose()
    })
  })

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%', height: '100%' }}>
      <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%' }} />
    </div>
  )
}
