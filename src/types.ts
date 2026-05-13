import type { Manifold } from 'manifold-3d'

export type RawMesh = { vertProperties: Float32Array; triVerts: Uint32Array; numProp: number }
export type PieceMesh = { label: string; mesh: RawMesh; secondaryMesh?: RawMesh }
export type Attribution = { name: string; author: string; url: string; license: string }
export type PieceGeom = { label: string; geom: Manifold; primaryGeom?: Manifold; secondaryGeom?: Manifold }
export type WrappedGeom = { geom: Manifold; exportTransform?: (g: Manifold) => Manifold }
export type PiecedGeom = { merged: Manifold; pieces: PieceGeom[]; exportTransform?: (g: Manifold) => Manifold }
export type GeomResult = Manifold | WrappedGeom | PiecedGeom

export function isWrapped(r: GeomResult): r is WrappedGeom {
  return typeof r === 'object' && r !== null && 'geom' in r
}

export function isPieced(r: GeomResult): r is PiecedGeom {
  return typeof r === 'object' && r !== null && 'merged' in r
}
