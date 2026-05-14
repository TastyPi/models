import { initManifold } from './manifold'
import type { Manifold } from 'manifold-3d'
import * as wallHook from './models/wall-hook'
import * as gridfinityBaseplate from './models/gridfinity-baseplate'
import * as cornerRadiusGauge from './models/corner-radius-gauge'
import * as gridfinityBin from './models/gridfinity-bin'
import * as magnetTest from './models/magnet-test'
import type { RawMesh, PieceMesh, GeomResult, PieceGeom } from './types'
import { isPieced, isWrapped } from './types'

const MODELS: Record<string, {
  generate: (p: any) => GeomResult
  flatModel?: boolean
}> = {
  'wall-hook':             { generate: wallHook.generate },
  'gridfinity-baseplate':  { generate: gridfinityBaseplate.generate,  flatModel: gridfinityBaseplate.flatModel },
  'corner-radius-gauge':   { generate: cornerRadiusGauge.generate,    flatModel: cornerRadiusGauge.flatModel },
  'gridfinity-bin':        { generate: gridfinityBin.generate },
  'magnet-test':           { generate: magnetTest.generate, flatModel: magnetTest.flatModel },
}

type InMsg =
  | { type: 'generate'; key: string; slug: string; params: Record<string, unknown> }
  | { type: 'export';   key: string; slug: string; params: Record<string, unknown>; pieceIndex?: number; wantPieces?: boolean; pieceIndices?: number[] }

type OutMsg =
  | { type: 'result'; key: string; mesh: RawMesh; pieces?: PieceMesh[] }
  | { type: 'error';  key: string }


function extractMesh(geom: Manifold): RawMesh {
  const m = geom.getMesh()
  return {
    vertProperties: new Float32Array(m.vertProperties),
    triVerts: new Uint32Array(m.triVerts),
    numProp: m.numProp,
  }
}

const readyPromise = initManifold()

self.onmessage = async (e: MessageEvent<InMsg>) => {
  await readyPromise
  const { type, key, slug, params } = e.data
  const entry = MODELS[slug]
  if (!entry) { self.postMessage({ type: 'error', key } satisfies OutMsg); return }
  try {
    const result = entry.generate(params)
    const pieced = isPieced(result)

    const flatRotate = (g: Manifold): Manifold => entry.flatModel ? g.rotate(-90, 0, 0) : g

    if (type === 'generate') {
      const rawGeom = pieced ? result.merged : (isWrapped(result) ? result.geom : result)
      const geom = flatRotate(rawGeom)
      const mesh = extractMesh(geom)
      const pieces: PieceMesh[] | undefined = pieced
        ? result.pieces.map((p: PieceGeom) => {
            const piece: PieceMesh = { label: p.label, mesh: extractMesh(flatRotate(p.geom)) }
            return piece
          })
        : undefined
      const transferables: Transferable[] = [mesh.vertProperties.buffer as ArrayBuffer, mesh.triVerts.buffer as ArrayBuffer]
      if (pieces) for (const p of pieces) {
        transferables.push(p.mesh.vertProperties.buffer as ArrayBuffer, p.mesh.triVerts.buffer as ArrayBuffer)
      }
      self.postMessage({ type: 'result', key, mesh, pieces } satisfies OutMsg, { transfer: transferables })
    } else {
      const { pieceIndex, wantPieces, pieceIndices } = e.data as Extract<InMsg, { type: 'export' }>
      if ((wantPieces || pieceIndices) && pieced) {
        const applyTransforms = (g: Manifold) => {
          if (result.exportTransform) g = result.exportTransform(g)
          return flatRotate(g)
        }
        const selectedPieces: PieceGeom[] = pieceIndices
          ? result.pieces.filter((_: PieceGeom, i: number) => pieceIndices.includes(i))
          : result.pieces
        const pieceMeshes: PieceMesh[] = selectedPieces.map((p: PieceGeom) => {
          const pieceMesh: PieceMesh = { label: p.label, mesh: extractMesh(applyTransforms(p.geom)), settings: p.settings }
          if (p.primaryGeom && p.secondaryGeom) {
            pieceMesh.subParts = [
              { label: p.primaryLabel ?? 'Part 1', mesh: extractMesh(applyTransforms(p.primaryGeom)), settings: p.primarySettings },
              { label: p.secondaryLabel ?? 'Part 2', mesh: extractMesh(applyTransforms(p.secondaryGeom)), settings: p.secondarySettings },
            ]
          }
          return pieceMesh
        })
        let mergedGeom = result.merged
        if (result.exportTransform) mergedGeom = result.exportTransform(mergedGeom)
        mergedGeom = flatRotate(mergedGeom)
        const mesh = extractMesh(mergedGeom)
        const transferables: Transferable[] = [mesh.vertProperties.buffer as ArrayBuffer, mesh.triVerts.buffer as ArrayBuffer]
        for (const p of pieceMeshes) {
          transferables.push(p.mesh.vertProperties.buffer as ArrayBuffer, p.mesh.triVerts.buffer as ArrayBuffer)
          if (p.subParts) for (const sp of p.subParts) transferables.push(sp.mesh.vertProperties.buffer as ArrayBuffer, sp.mesh.triVerts.buffer as ArrayBuffer)
        }
        self.postMessage({ type: 'result', key, mesh, pieces: pieceMeshes } satisfies OutMsg, { transfer: transferables })
      } else {
        let geom: Manifold
        if (pieced && pieceIndex !== undefined && pieceIndex >= 0) {
          geom = result.pieces[pieceIndex].geom
        } else if (pieced) {
          geom = result.merged
        } else if (isWrapped(result)) {
          geom = result.geom
        } else {
          geom = result
        }
        if (isPieced(result) || isWrapped(result)) {
          if (result.exportTransform) geom = result.exportTransform(geom)
        }
        geom = flatRotate(geom)
        const mesh = extractMesh(geom)
        self.postMessage({ type: 'result', key, mesh } satisfies OutMsg, { transfer: [mesh.vertProperties.buffer as ArrayBuffer, mesh.triVerts.buffer as ArrayBuffer] })
      }
    }
  } catch (err) {
    console.error('Render error:', err)
    self.postMessage({ type: 'error', key } satisfies OutMsg)
  }
}
