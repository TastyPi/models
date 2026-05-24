#!/usr/bin/env node
// Validate that a .bin mesh is accepted by Manifold as a valid solid.
// Exit 0 = pass, exit 1 = fail.
// Usage: yarn node scripts/test-manifold.mjs public/ltt-screwdriver.bin
import ManifoldModule from 'manifold-3d'
import { readFileSync } from 'fs'

const path = process.argv[2] ?? 'public/ltt-screwdriver.bin'
const buf = readFileSync(path)
const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength)
const nVerts = dv.getUint32(0, true)
const nTris  = dv.getUint32(4, true)

const rawMesh = {
  numProp: 3,
  vertProperties: new Float32Array(buf.buffer, buf.byteOffset + 8, nVerts * 3),
  triVerts: new Uint32Array(buf.buffer, buf.byteOffset + 8 + nVerts * 12, nTris * 3),
}

const wasm = await ManifoldModule()
wasm.setup()
const { Manifold, Mesh } = wasm

console.log(`Testing ${path}: ${nVerts} verts, ${nTris} tris`)
const manifold = new Manifold(new Mesh(rawMesh))
const status = manifold.status()
console.log(`  status: ${status}`)
console.log(`  volume: ${manifold.volume().toFixed(0)} mm³`)
console.log(`  surfaceArea: ${manifold.surfaceArea().toFixed(0)} mm²`)
const ok = status === 'NoError' || status === 0
console.log(ok ? '\nPASS' : '\nFAIL')
process.exit(ok ? 0 : 1)
