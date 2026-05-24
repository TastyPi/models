#!/usr/bin/env node
// Diagnose manifold issues in a .bin mesh file.
// Reports: boundary edges, non-manifold edges, inconsistent winding.
import { readFileSync } from 'fs'

const path = process.argv[2] ?? 'public/ltt-screwdriver.bin'
const buf = readFileSync(path)
const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength)

const nVerts = dv.getUint32(0, true)
const nTris  = dv.getUint32(4, true)
console.log(`${path}: ${nVerts} verts, ${nTris} tris`)

const verts = new Float32Array(buf.buffer, buf.byteOffset + 8, nVerts * 3)
const idx   = new Uint32Array(buf.buffer, buf.byteOffset + 8 + nVerts * 12, nTris * 3)

// Count directed edges and undirected edges
const dirCount  = new Map()   // "a,b" -> count
const undirCount = new Map()  // "min,max" -> count
const undirFirstDir = new Map() // "min,max" -> first directed [a,b]

for (let t = 0; t < nTris; t++) {
  for (let e = 0; e < 3; e++) {
    const a = idx[t*3 + e]
    const b = idx[t*3 + (e+1)%3]
    const dk = `${a},${b}`
    dirCount.set(dk, (dirCount.get(dk) ?? 0) + 1)
    const uk = `${Math.min(a,b)},${Math.max(a,b)}`
    const prev = undirCount.get(uk) ?? 0
    undirCount.set(uk, prev + 1)
    if (prev === 0) undirFirstDir.set(uk, [a, b])
  }
}

const boundary    = [...undirCount.entries()].filter(([,c]) => c === 1)
const nonManifold = [...undirCount.entries()].filter(([,c]) => c > 2)
const dupDir      = [...dirCount.entries()].filter(([,c]) => c > 1)

console.log(`Boundary edges (appear in 1 tri):     ${boundary.length}`)
console.log(`Non-manifold edges (appear in 3+ tris): ${nonManifold.length}`)
console.log(`Duplicate directed edges:               ${dupDir.length}`)

if (boundary.length > 0 && boundary.length <= 20) {
  console.log('\nBoundary edge samples:')
  for (const [uk] of boundary.slice(0, 10)) {
    const [a, b] = uk.split(',').map(Number)
    const ax=verts[a*3], ay=verts[a*3+1], az=verts[a*3+2]
    const bx=verts[b*3], by=verts[b*3+1], bz=verts[b*3+2]
    const [da, db] = undirFirstDir.get(uk)
    console.log(`  ${uk}: (${ax.toFixed(3)},${ay.toFixed(3)},${az.toFixed(3)}) — (${bx.toFixed(3)},${by.toFixed(3)},${bz.toFixed(3)})  dir=${da}→${db}`)
  }
} else if (boundary.length > 0) {
  // Sample by Z level
  const zBuckets = new Map()
  for (const [uk] of boundary) {
    const [a, b] = uk.split(',').map(Number)
    const az = verts[a*3+2], bz = verts[b*3+2]
    const z = Math.min(az, bz).toFixed(3)
    zBuckets.set(z, (zBuckets.get(z) ?? 0) + 1)
  }
  console.log('\nBoundary edges by Z level (min vertex Z):')
  for (const [z, cnt] of [...zBuckets.entries()].sort((a,b)=>parseFloat(b[0])-parseFloat(a[0])).slice(0, 15))
    console.log(`  Z≈${z}: ${cnt} boundary edges`)
}

// Check winding consistency: for each undirected edge that appears exactly twice,
// the two triangles should use it in opposite directions.
let windingOk = 0, windingBad = 0
for (const [uk, cnt] of undirCount) {
  if (cnt !== 2) continue
  const [a, b] = uk.split(',').map(Number)
  const fwd = (dirCount.get(`${a},${b}`) ?? 0)
  const rev = (dirCount.get(`${b},${a}`) ?? 0)
  if (fwd === 1 && rev === 1) windingOk++
  else windingBad++
}
console.log(`\nManifold edges winding: ${windingOk} OK, ${windingBad} inconsistent`)
