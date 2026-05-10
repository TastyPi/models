import { initManifold } from './manifold'
import { models } from './models/registry'
import type { RawMesh } from './types'

type PieceMesh = { label: string; mesh: RawMesh; secondaryMesh?: RawMesh }

type InMsg =
  | { type: 'generate'; key: string; modelName: string; params: Record<string, number | boolean | string> }
  | { type: 'export';   key: string; modelName: string; params: Record<string, number | boolean | string>; pieceIndex?: number }

type OutMsg =
  | { type: 'result'; key: string; mesh: RawMesh; pieces?: PieceMesh[] }
  | { type: 'error';  key: string }

function isPieced(r: unknown): r is { merged: unknown; pieces: { label: string; geom: unknown }[] } {
  return r !== null && typeof r === 'object' && 'pieces' in (r as object)
}

function extractMesh(geom: unknown): RawMesh {
  const m = (geom as any).getMesh()
  return {
    vertProperties: new Float32Array(m.vertProperties),
    triVerts: new Uint32Array(m.triVerts),
    numProp: m.numProp,
  }
}

const readyPromise = initManifold()

self.onmessage = async (e: MessageEvent<InMsg>) => {
  await readyPromise
  const { type, key, modelName, params } = e.data
  const entry = models.find(m => m.model.name === modelName)
  if (!entry) { self.postMessage({ type: 'error', key } satisfies OutMsg); return }
  try {
    const result: any = entry.model.generate(params)
    const pieced = isPieced(result)

    const flatRotate = (g: any) => entry.model.flatModel ? g.rotate([-90, 0, 0]) : g

    if (type === 'generate') {
      const geom = flatRotate(pieced ? result.merged : result)
      const mesh = extractMesh(geom)
      const pieces: PieceMesh[] | undefined = pieced
        ? result.pieces.map((p: any) => {
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
      let geom: any
      if (pieced && pieceIndex !== undefined && pieceIndex >= 0) {
        geom = flatRotate(result.pieces[pieceIndex].geom)
      } else {
        geom = flatRotate(pieced ? result.merged : result)
      }
      if (entry.model.exportTransform) geom = entry.model.exportTransform(params, geom)
      const mesh = extractMesh(geom)
      self.postMessage({ type: 'result', key, mesh } satisfies OutMsg, { transfer: [mesh.vertProperties.buffer as ArrayBuffer, mesh.triVerts.buffer as ArrayBuffer] })
    }
  } catch (err) {
    console.error('Render error:', err)
    self.postMessage({ type: 'error', key } satisfies OutMsg)
  }
}
