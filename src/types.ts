import type { BufferGeometry } from 'three'

export type RawMesh = { vertProperties: Float32Array; triVerts: Uint32Array; numProp: number }
export type PreviewMesh = { label: string; meshes: Array<{ mesh: RawMesh; extruder: number }> }
export type Attribution = { name: string; author: string; url: string; license: string }

export type PartGeom = {
  label: string
  geom: BufferGeometry
  extruder?: number
  settings?: Record<string, string>
}

export type ObjGeom = {
  label: string
  parts: PartGeom[]
  settings?: Record<string, string>
}

export const SOLID_INFILL: Record<string, string> = { fill_density: '10%', fill_pattern: 'rectilinear' }
export const HONEYCOMB_INFILL: Record<string, string> = { fill_density: '10%', fill_pattern: 'honeycomb' }

export type GeomResult = {
  objects: ObjGeom[]
  exportTransform?: (g: BufferGeometry) => BufferGeometry
}
