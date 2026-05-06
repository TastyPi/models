import { createEffect, onCleanup, onMount } from 'solid-js'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

interface Props {
  geometry: () => unknown
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
    camera.position.set(120, 60, 220)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.target.set(0, 25, 25)
    controls.update()

    scene.add(new THREE.AmbientLight(0xffffff, 0.5))
    const sun = new THREE.DirectionalLight(0xffffff, 1.2)
    sun.position.set(100, 200, 100)
    scene.add(sun)
    const fill = new THREE.DirectionalLight(0x8899ff, 0.4)
    fill.position.set(-100, 50, -100)
    scene.add(fill)

    const grid = new THREE.GridHelper(300, 30, 0x333344, 0x222233)
    scene.add(grid)

    let currentMesh: THREE.Mesh | null = null
    let rafId: number | null = null

    const render = () => {
      controls.update()
      renderer.render(scene, camera)
    }

    const scheduleRender = () => {
      if (rafId === null) {
        rafId = requestAnimationFrame(() => { rafId = null; render() })
      }
    }

    controls.addEventListener('change', scheduleRender)

    const syncSize = () => {
      const w = containerRef.clientWidth
      const h = containerRef.clientHeight
      renderer.setSize(w, h, false)
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      scheduleRender()
    }
    syncSize()

    const ro = new ResizeObserver(syncSize)
    ro.observe(containerRef)

    createEffect(() => {
      const geom = props.geometry()
      if (!geom) return

      if (currentMesh) {
        scene.remove(currentMesh)
        currentMesh.geometry.dispose()
        ;(currentMesh.material as THREE.Material).dispose()
        currentMesh = null
      }

      const m = (geom as any).getMesh()
      const geo = new THREE.BufferGeometry()
      geo.setAttribute('position', new THREE.BufferAttribute(m.vertProperties, m.numProp))
      geo.setIndex(new THREE.BufferAttribute(m.triVerts, 1))

      currentMesh = new THREE.Mesh(
        geo,
        new THREE.MeshStandardMaterial({ color: 0x6688cc, roughness: 0.4, metalness: 0.1, flatShading: true })
      )
      scene.add(currentMesh)
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
