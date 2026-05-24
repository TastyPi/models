#!/usr/bin/env node
// Validate that a .bin mesh is a valid closed manifold.
// Exit 0 = pass, exit 1 = fail.
// Usage: node scripts/test-mesh.mjs public/ltt-screwdriver.bin
import { readFileSync } from 'fs'

const path = process.argv[2] ?? 'public/ltt-screwdriver.bin'
const buf = readFileSync(path)
const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength)

const nVerts = dv.getUint32(0, true)
const nTris  = dv.getUint32(4, true)
const verts  = new Float32Array(buf.buffer, buf.byteOffset + 8, nVerts * 3)
const idx    = new Uint32Array(buf.buffer, buf.byteOffset + 8 + nVerts * 12, nTris * 3)

console.log(`Testing ${path}: ${nVerts} verts, ${nTris} tris`)

let pass = true
function fail(msg) { console.error(`  FAIL: ${msg}`); pass = false }
function ok(msg)   { console.log(`  ok:   ${msg}`) }

// ---- 1. Degenerate triangles (two or more identical vertex indices) ------
let degenerate = 0
for (let t = 0; t < nTris; t++) {
  const a=idx[t*3], b=idx[t*3+1], c=idx[t*3+2]
  if (a===b || b===c || a===c) degenerate++
}
if (degenerate > 0) fail(`${degenerate} degenerate triangles`)
else ok(`0 degenerate triangles`)

// ---- 2. Out-of-range indices ---------------------------------------------
let badIdx = 0
for (let i = 0; i < idx.length; i++) if (idx[i] >= nVerts) badIdx++
if (badIdx > 0) fail(`${badIdx} out-of-range vertex indices`)
else ok(`all vertex indices in range`)

// ---- 3. Edge manifold checks --------------------------------------------
const dirCount  = new Map()   // "a,b" -> count
const undirCount = new Map()  // "min,max" -> count

for (let t = 0; t < nTris; t++) {
  for (let e = 0; e < 3; e++) {
    const a = idx[t*3 + e], b = idx[t*3 + (e+1)%3]
    const dk = `${a},${b}`
    dirCount.set(dk, (dirCount.get(dk) ?? 0) + 1)
    const uk = `${Math.min(a,b)},${Math.max(a,b)}`
    undirCount.set(uk, (undirCount.get(uk) ?? 0) + 1)
  }
}

const boundary    = [...undirCount.entries()].filter(([,c]) => c === 1)
const nonManifold = [...undirCount.entries()].filter(([,c]) => c > 2)
const dupDir      = [...dirCount.entries()].filter(([,c]) => c > 1)

if (boundary.length > 0) {
  // Group boundary edges by Z level of first endpoint for context
  const byZ = new Map()
  for (const [uk] of boundary) {
    const [a] = uk.split(',').map(Number)
    const z = verts[a*3+2].toFixed(3)
    byZ.set(z, (byZ.get(z) ?? 0) + 1)
  }
  const summary = [...byZ.entries()].sort((a,b)=>parseFloat(b[0])-parseFloat(a[0]))
    .slice(0,5).map(([z,n])=>`Z≈${z}:${n}`).join(', ')
  fail(`${boundary.length} boundary edges (appear in only 1 tri) — ${summary}`)
} else {
  ok(`0 boundary edges`)
}

if (nonManifold.length > 0) fail(`${nonManifold.length} non-manifold edges (appear in 3+ tris)`)
else ok(`0 non-manifold edges`)

if (dupDir.length > 0) fail(`${dupDir.length} duplicate directed edges`)
else ok(`0 duplicate directed edges`)

// Winding consistency: every manifold edge must have 1 forward + 1 reverse
let windingBad = 0
for (const [uk, cnt] of undirCount) {
  if (cnt !== 2) continue
  const [a, b] = uk.split(',').map(Number)
  if ((dirCount.get(`${a},${b}`)??0) !== 1 || (dirCount.get(`${b},${a}`)??0) !== 1) windingBad++
}
if (windingBad > 0) fail(`${windingBad} edges with inconsistent winding`)
else ok(`all manifold edges have consistent winding`)

// ---- 4. Signed volume (orientation) ------------------------------------
let vol6 = 0
for (let i = 0; i < idx.length; i += 3) {
  const [ax,ay,az] = [verts[idx[i]*3],  verts[idx[i]*3+1],  verts[idx[i]*3+2]]
  const [bx,by,bz] = [verts[idx[i+1]*3],verts[idx[i+1]*3+1],verts[idx[i+1]*3+2]]
  const [cx,cy,cz] = [verts[idx[i+2]*3],verts[idx[i+2]*3+1],verts[idx[i+2]*3+2]]
  vol6 += ax*(by*cz-bz*cy) + ay*(bz*cx-bx*cz) + az*(bx*cy-by*cx)
}
const vol = vol6 / 6
if (vol <= 0) fail(`signed volume ${vol.toFixed(0)} mm³ is not positive (normals may be inverted or mesh is empty)`)
else ok(`signed volume ${vol.toFixed(0)} mm³ (positive = outward normals)`)

// ---- Result -------------------------------------------------------------
console.log(pass ? '\nPASS' : '\nFAIL')
process.exit(pass ? 0 : 1)
