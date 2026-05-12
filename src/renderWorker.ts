import { initManifold } from './manifold'
import type { Manifold } from 'manifold-3d'
import * as wallHook from './models/wall-hook'
import * as gridfinityBaseplate from './models/gridfinity-baseplate'
import * as cornerRadiusGauge from './models/corner-radius-gauge'
import * as gridfinityBin from './models/gridfinity-bin'
import * as magnetTest from './models/magnet-test'
import type { RawMesh, PieceMesh, GeomResult, PieceGeom } from './types'
import { isPieced } from './types'

const MODELS: Record<string, {
  generate: (p: any) => GeomResult
  flatModel?: boolean
  exportTransform?: (p: any, g: Manifold) => Manifold
}> = {
  'wall-hook':             { generate: wallHook.generate,             exportTransform: wallHook.exportTransform },
  'gridfinity-baseplate':  { generate: gridfinityBaseplate.generate,  flatModel: gridfinityBaseplate.flatModel },
  'corner-radius-gauge':   { generate: cornerRadiusGauge.generate,    flatModel: cornerRadiusGauge.flatModel },
  'gridfinity-bin':        { generate: gridfinityBin.generate },
  'magnet-test':           { generate: magnetTest.generate, flatModel: magnetTest.flatModel },
}

type InMsg =
  | { type: 'generate'; key: string; slug: string; params: Record<string, unknown> }
  | { type: 'export';   key: string; slug: string; params: Record<string, unknown>; pieceIndex?: number }

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
      const geom = flatRotate(pieced ? result.merged : result)
      const mesh = extractMesh(geom)
      const pieces: PieceMesh[] | undefined = pieced
        ? result.pieces.map((p: PieceGeom) => {
            const displayGeom = flatRotate(p.primaryGeom ?? p.geom)
            const piece: PieceMesh = { label: p.label, mesh: extractMesh(displayGeom) }
            if (p.secondaryGeom) piece.secondaryMesh = extractMesh(flatRotate(p.secondaryGeom))
            return piece
          })
        : undefined
      const transferables: Transferable[] = [mesh.vertProperties.buffer as ArrayBuffer, mesh.triVerts.buffer as ArrayBuffer]
      if (pieces) for (const p of pieces) {
        transferables.push(p.mesh.vertProperties.buffer as ArrayBuffer, p.mesh.triVerts.buffer as ArrayBuffer)
        if (p.secondaryMesh) transferables.push(p.secondaryMesh.vertProperties.buffer as ArrayBuffer, p.secondaryMesh.triVerts.buffer as ArrayBuffer)
      }
      self.postMessage({ type: 'result', key, mesh, pieces } satisfies OutMsg, { transfer: transferables })
    } else {
      const { pieceIndex } = e.data as Extract<InMsg, { type: 'export' }>
      let geom: Manifold
      if (pieced && pieceIndex !== undefined && pieceIndex >= 0) {
        geom = flatRotate(result.pieces[pieceIndex].geom)
      } else {
        geom = flatRotate(pieced ? result.merged : result)
      }
      if (pieced) geom = geom.rotate(result.downloadRotation)
      if (entry.exportTransform) geom = entry.exportTransform(params, geom)
      const mesh = extractMesh(geom)
      self.postMessage({ type: 'result', key, mesh } satisfies OutMsg, { transfer: [mesh.vertProperties.buffer as ArrayBuffer, mesh.triVerts.buffer as ArrayBuffer] })
    }
  } catch (err) {
    console.error('Render error:', err)
    self.postMessage({ type: 'error', key } satisfies OutMsg)
  }
}
