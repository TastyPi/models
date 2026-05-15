import * as THREE from 'three'

export const VIEW_DIR = new THREE.Vector3(-1.5, -1, 1.2).normalize()

export function addSceneLights(scene: THREE.Scene) {
  scene.add(new THREE.AmbientLight(0xffffff, 0.5))
  const sun = new THREE.DirectionalLight(0xffffff, 1.2)
  sun.position.set(100, -100, 200)
  scene.add(sun)
  const fill = new THREE.DirectionalLight(0x8899ff, 0.4)
  fill.position.set(-100, 100, -50)
  scene.add(fill)
}

export function setupCamera(camera: THREE.PerspectiveCamera) {
  camera.up.set(0, 0, 1)
}
