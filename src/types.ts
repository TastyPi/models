import type { BufferGeometry } from 'three'

export type RawMesh = { vertProperties: Float32Array; triVerts: Uint32Array; numProp: number }
export type PreviewMesh = { label: string; mesh: RawMesh }
export type Attribution = { name: string; author: string; url: string; license: string }

export type PartGeom = {
  label: string
  geom: BufferGeometry
  settings?: Record<string, string>
}

export type ObjGeom = {
  label: string
  parts: PartGeom[]
  settings?: Record<string, string>
}

export type GeomResult = {
  objects: ObjGeom[]
  exportTransform?: (g: BufferGeometry) => BufferGeometry
}
