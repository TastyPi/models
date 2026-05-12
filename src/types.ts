import type { Manifold } from 'manifold-3d'

export type RawMesh = { vertProperties: Float32Array; triVerts: Uint32Array; numProp: number }
export type PieceMesh = { label: string; mesh: RawMesh; secondaryMesh?: RawMesh }
export type Attribution = { name: string; author: string; url: string; license: string }
export type PieceGeom = { label: string; geom: Manifold; primaryGeom?: Manifold; secondaryGeom?: Manifold }
export type GeomResult = Manifold | { merged: Manifold; pieces: PieceGeom[]; downloadRotation: [number, number, number] }

export function isPieced(r: GeomResult): r is { merged: Manifold; pieces: PieceGeom[] } {
  return typeof r === 'object' && r !== null && 'merged' in r
}
