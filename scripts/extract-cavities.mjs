#!/usr/bin/env node
// Extract closed cavity meshes from STL.
// All coordinates are exact float32 binary values throughout — no rounding,
// no text serialization of floats.
//
// Profile binary format (public/ltt-cavity-profiles.bin):
//   float32  loopZ
//   uint32   nLoops (2)
//   per loop:  uint32 nVerts | float32 x0 y0 x1 y1 ... (nVerts pairs)
//
// Mesh .bin format: uint32 nVerts | uint32 nTris | float32 xyz... | uint32 indices...
import { readFileSync, writeFileSync } from 'fs'

const STL = '/var/home/graham/Downloads/LTT Standard and Stubby Screwdriver Case including pen and extension - Mod More Bits - Bottom.stl'

// ---- Parse STL ----------------------------------------------------------
const stlBuf = readFileSync(STL)
const dv = new DataView(stlBuf.buffer, stlBuf.byteOffset, stlBuf.byteLength)
const nTris = dv.getUint32(80, true)
console.log(`STL: ${nTris} triangles`)

const triVerts = new Float32Array(nTris * 9)
for (let i = 0; i < nTris; i++) {
  const b = 84 + i * 50 + 12
  for (let j = 0; j < 9; j++) triVerts[i*9+j] = dv.getFloat32(b + j*4, true)
}

function pk(x, y, z) { return `${x},${y},${z}` }

const vtMap = new Map()
for (let i = 0; i < nTris; i++) {
  for (let j = 0; j < 3; j++) {
    const x=triVerts[i*9+j*3], y=triVerts[i*9+j*3+1], z=triVerts[i*9+j*3+2]
    const k=pk(x,y,z); let a=vtMap.get(k); if(!a){a=[];vtMap.set(k,a)} a.push(i)
  }
}

// ---- Find the dominant flat-Z plane -------------------------------------
const zCount = new Map()
for (let i = 0; i < nTris; i++) {
  const z0=triVerts[i*9+2], z1=triVerts[i*9+5], z2=triVerts[i*9+8]
  if (z0===z1 && z1===z2) zCount.set(z0, (zCount.get(z0)??0)+1)
}
const LOOP_Z = [...zCount.entries()].sort((a,b)=>b[1]-a[1])[0][0]
console.log(`Opening plane Z = ${LOOP_Z} (exact float32), ${zCount.get(LOOP_Z)} flat tris`)

// ---- Extract boundary loops at LOOP_Z ----------------------------------
// Count UNDIRECTED edges among flat triangles.  An undirected edge appearing
// in exactly one flat triangle is a boundary edge.  Track the directed form
// (as seen in its one triangle) for loop traversal.
//
// Canonical (undirected) key: sort the two XY pairs lexicographically.
function undirKey(ax, ay, bx, by) {
  return (ax < bx || (ax === bx && ay <= by))
    ? `${ax},${ay}|${bx},${by}`
    : `${bx},${by}|${ax},${ay}`
}

const undirCount  = new Map() // undirKey -> count
const undirToDir  = new Map() // undirKey -> [ax,ay,bx,by] (direction from triangle)

for (let i = 0; i < nTris; i++) {
  const z0=triVerts[i*9+2], z1=triVerts[i*9+5], z2=triVerts[i*9+8]
  if (z0!==LOOP_Z || z1!==LOOP_Z || z2!==LOOP_Z) continue
  for (let e = 0; e < 3; e++) {
    const ax=triVerts[i*9+e*3],     ay=triVerts[i*9+e*3+1]
    const bx=triVerts[i*9+((e+1)%3)*3], by=triVerts[i*9+((e+1)%3)*3+1]
    const uk = undirKey(ax, ay, bx, by)
    const prev = undirCount.get(uk) ?? 0
    undirCount.set(uk, prev + 1)
    if (prev === 0) undirToDir.set(uk, [ax, ay, bx, by]) // save directed form
  }
}

// Build from-vertex -> [toX, toY] adjacency for boundary edges only
const nextEdge = new Map()
for (const [uk, cnt] of undirCount) {
  if (cnt !== 1) continue
  const [ax, ay, bx, by] = undirToDir.get(uk)
  const fk = `${ax},${ay}`
  let a = nextEdge.get(fk); if (!a) { a = []; nextEdge.set(fk, a) }
  a.push([bx, by])
}

// Trace boundary loops (edge-consumption traversal)
const usedEdge = new Set()
const loops = []
for (const [fromKey, tos] of nextEdge) {
  for (const firstTo of tos) {
    const [ax, ay] = fromKey.split(',').map(Number)
    const [bx, by] = firstTo
    const ek = `${ax},${ay},${bx},${by}`
    if (usedEdge.has(ek)) continue

    const loop = []
    let cx = ax, cy = ay, nx = bx, ny = by
    let limit = nextEdge.size + 10
    while (limit-- > 0) {
      loop.push([cx, cy])
      usedEdge.add(`${cx},${cy},${nx},${ny}`)
      const nexts = nextEdge.get(`${nx},${ny}`) ?? []
      const nxt = nexts.find(([tx, ty]) => !usedEdge.has(`${nx},${ny},${tx},${ty}`))
      if (!nxt) break
      cx = nx; cy = ny; nx = nxt[0]; ny = nxt[1]
      if (cx === ax && cy === ay) break
    }
    if (loop.length >= 3) loops.push(loop)
  }
}

function signedArea(loop) {
  let a = 0
  for (let i = 0; i < loop.length; i++) {
    const [x0,y0]=loop[i], [x1,y1]=loop[(i+1)%loop.length]
    a += x0*y1 - x1*y0
  }
  return a / 2
}

loops.sort((a, b) => signedArea(a) - signedArea(b)) // ascending: most-negative first
const openLoops = loops.filter(l => signedArea(l) < 0)
console.log(`${loops.length} loops, ${openLoops.length} openings; keeping 2 largest`)
openLoops.slice(0, 2).forEach((l, i) => {
  const a = signedArea(l)
  const xs = l.map(p=>p[0]), ys = l.map(p=>p[1])
  console.log(`  loop[${i}]: ${l.length} verts  area=${a.toFixed(2)}  ${(Math.max(...xs)-Math.min(...xs)).toFixed(6)} x ${(Math.max(...ys)-Math.min(...ys)).toFixed(6)} mm`)
})
const mainLoops = openLoops.slice(0, 2)

// ---- Save profile as binary (exact float32, no text conversion) ---------
{
  const nLoops = mainLoops.length
  const totalVerts = mainLoops.reduce((s, l) => s + l.length, 0)
  const buf = Buffer.alloc(4 + 4 + nLoops*4 + totalVerts*8)
  let o = 0
  buf.writeFloatLE(LOOP_Z, o); o += 4
  buf.writeUInt32LE(nLoops, o); o += 4
  for (const loop of mainLoops) {
    buf.writeUInt32LE(loop.length, o); o += 4
    for (const [x, y] of loop) { buf.writeFloatLE(x, o); o += 4; buf.writeFloatLE(y, o); o += 4 }
  }
  writeFileSync('public/ltt-cavity-profiles.bin', buf)
  console.log(`Wrote public/ltt-cavity-profiles.bin (${buf.length} bytes, exact float32)`)
}

// ---- Flood fill cavity walls -------------------------------------------
// Strict: skip any triangle that has a vertex strictly above loopZ.
// This avoids including "spanning" triangles (one vertex below, one above) that
// produce boundary edges above loopZ with no roof counterpart.
function floodFill(loopXY, loopZ) {
  const known = new Set(), q = []
  for (const [x, y] of loopXY) {
    const k = pk(x, y, loopZ)
    if (vtMap.has(k) && !known.has(k)) { known.add(k); q.push(k) }
  }
  console.log(`  Seeds: ${known.size}/${loopXY.length}`)
  const found = new Set(); let qi = 0
  while (qi < q.length) {
    const vk = q[qi++]
    for (const ti of (vtMap.get(vk) || [])) {
      if (found.has(ti)) continue
      // Skip triangles where all vertices are at or above loopZ (flat + above)
      if (triVerts[ti*9+2] >= loopZ && triVerts[ti*9+5] >= loopZ && triVerts[ti*9+8] >= loopZ) continue
      found.add(ti)
      for (let j = 0; j < 3; j++) {
        const x=triVerts[ti*9+j*3], y=triVerts[ti*9+j*3+1], z=triVerts[ti*9+j*3+2]
        const k=pk(x,y,z); if(!known.has(k)){known.add(k);q.push(k)}
      }
    }
  }
  return found
}

// Filter loop to keep only vertices that appear in wall triangles at loopZ.
// STL geometry inconsistencies (~0.01mm gaps) can leave some loop vertices
// connected only to flat or above triangles with no wall below — those vertices
// have no wall edge to pair with the roof, causing boundary edges.
function filterLoop(loopXY, wallIdx, loopZ) {
  const wallVertAtZ = new Set()
  for (const ti of wallIdx) {
    for (let j = 0; j < 3; j++) {
      if (triVerts[ti*9+j*3+2] === loopZ) {
        wallVertAtZ.add(`${triVerts[ti*9+j*3]},${triVerts[ti*9+j*3+1]}`)
      }
    }
  }
  const good = loopXY.filter(([x, y]) => wallVertAtZ.has(`${x},${y}`))
  // Remove consecutive duplicates
  const out = []
  for (const v of good) {
    if (!out.length || v[0] !== out[out.length-1][0] || v[1] !== out[out.length-1][1]) out.push(v)
  }
  return out
}

// ---- Point in polygon ---------------------------------------------------
function pip(px, py, poly) {
  let inside = false
  for (let i = 0, j = poly.length-1; i < poly.length; j = i++) {
    const [xi,yi]=poly[i], [xj,yj]=poly[j]
    if ((yi>py) !== (yj>py) && px < (xj-xi)*(py-yi)/(yj-yi)+xi) inside = !inside
  }
  return inside
}

// ---- Ear-clipping -------------------------------------------------------
function cleanPoly(poly) {
  const EPS=1e-6, out=[], n=poly.length
  for (let i = 0; i < n; i++) {
    const A=poly[(i-1+n)%n], B=poly[i], C=poly[(i+1)%n]
    if (Math.abs(B[0]-A[0])<EPS && Math.abs(B[1]-A[1])<EPS) continue
    if (Math.abs((B[0]-A[0])*(C[1]-A[1])-(B[1]-A[1])*(C[0]-A[0])) < 1e-10) continue
    out.push(B)
  }
  return out
}
function earClip(poly2d) {
  const p = cleanPoly(poly2d); if (p.length < 3) return []; if (p.length === 3) return [[p[0],p[1],p[2]]]
  let a2 = 0; for (let i=0; i<p.length; i++) { const j=(i+1)%p.length; a2+=p[i][0]*p[j][1]-p[j][0]*p[i][1] }
  let verts = a2>0 ? [...p] : [...p].reverse(); const wasCW=a2<=0, tris=[]
  const c2 = (O,A,B) => (A[0]-O[0])*(B[1]-O[1])-(A[1]-O[1])*(B[0]-O[0])
  const inT = (P,A,B,C) => c2(A,B,P)>=-1e-9 && c2(B,C,P)>=-1e-9 && c2(C,A,P)>=-1e-9
  let patience = verts.length**2 + 10
  while (verts.length > 3 && patience-- > 0) {
    const n=verts.length; let found=false
    for (let i=0; i<n; i++) {
      const A=verts[(i-1+n)%n], B=verts[i], C=verts[(i+1)%n]
      if (c2(A,B,C) <= 1e-9) continue
      let ok=true; for (let j=0; j<n&&ok; j++) { if (j===(i-1+n)%n||j===i||j===(i+1)%n) continue; if (inT(verts[j],A,B,C)) ok=false }
      if (ok) { tris.push([A,B,C]); verts.splice(i,1); found=true; break }
    }
    if (!found) {
      const n2=verts.length; let forced=false
      for (let i=0; i<n2; i++) { const A=verts[(i-1+n2)%n2],B=verts[i],C=verts[(i+1)%n2]; if (c2(A,B,C)>0){tris.push([A,B,C]);verts.splice(i,1);forced=true;break} }
      if (!forced) break
    }
  }
  if (verts.length===3) tris.push([verts[0],verts[1],verts[2]])
  return wasCW ? tris.map(([A,B,C])=>[A,C,B]) : tris
}

// ---- Roof ---------------------------------------------------------------
// earClip on the full loop guarantees every loop boundary edge appears in
// exactly one roof triangle. But cleanPoly (inside earClip) removes collinear
// boundary vertices, breaking the wall-roof junction for those sub-edges.
// Fix: run earClip on the cleaned polygon, then fan-split each triangle whose
// edge spans a "super-edge" (a run of collinear removed vertices) so every
// original loop edge is a boundary edge of exactly one roof triangle.
function buildRoof(loopXY, Z, quiet = false) {
  const n = loopXY.length
  const EPS = 1e-6

  // Determine which vertices cleanPoly would remove
  const keepMask = new Array(n).fill(true)
  for (let i = 0; i < n; i++) {
    const A = loopXY[(i - 1 + n) % n], B = loopXY[i], C = loopXY[(i + 1) % n]
    if (Math.abs(B[0] - A[0]) < EPS && Math.abs(B[1] - A[1]) < EPS) { keepMask[i] = false; continue }
    if (Math.abs((B[0] - A[0]) * (C[1] - A[1]) - (B[1] - A[1]) * (C[0] - A[0])) < 1e-10) keepMask[i] = false
  }

  const cleanedVerts = [], cleanedIdx = []
  for (let i = 0; i < n; i++) if (keepMask[i]) { cleanedVerts.push(loopXY[i]); cleanedIdx.push(i) }

  // Find super-edges: runs of removed vertices between consecutive kept vertices
  const nc = cleanedVerts.length
  const superEdges = []
  for (let ci = 0; ci < nc; ci++) {
    const origFrom = cleanedIdx[ci]
    const origTo   = cleanedIdx[(ci + 1) % nc]
    const intermediates = []
    for (let j = (origFrom + 1) % n; j !== origTo; j = (j + 1) % n) intermediates.push(loopXY[j])
    if (intermediates.length > 0) superEdges.push({ from: loopXY[origFrom], to: loopXY[origTo], intermediates })
  }

  // Run earClip on cleaned polygon (uses same object references as loopXY)
  const tris2d = earClip(cleanedVerts)

  // For each super-edge, find the containing triangle (by reference equality)
  // and fan-split it to restore intermediate boundary vertices
  for (const { from: A, to: B, intermediates } of superEdges) {
    let triIdx = -1, edgePos = -1
    for (let t = 0; t < tris2d.length && triIdx === -1; t++) {
      const tri = tris2d[t]
      for (let e = 0; e < 3; e++) {
        if (tri[e] === A && tri[(e + 1) % 3] === B) { triIdx = t; edgePos = e; break }
      }
    }
    if (triIdx === -1) continue
    const X = tris2d[triIdx][(edgePos + 2) % 3]
    const pts = [A, ...intermediates, B]
    const fanTris = []
    for (let k = 0; k < pts.length - 1; k++) fanTris.push([pts[k], pts[k + 1], X])
    tris2d.splice(triIdx, 1, ...fanTris)
  }

  if (!quiet) console.log(`  Roof: ${tris2d.length} tris (${nc} cleaned, ${superEdges.length} super-edges split)`)
  return tris2d.map(t => t.map(([x, y]) => [x, y, Z]))
}

// ---- Patch remaining boundary-edge holes --------------------------------
// After combining walls + roof there may be internal platform tops (e.g. bit
// holders) whose boundary edges form closed loops.  Find each loop and fill it
// with earClip triangles so the final mesh has no boundary edges.
function patchHoles(allTrisXYZ) {
  // Use UNDIRECTED edge counts — boundary = appears in exactly 1 triangle
  const undirCount = new Map()
  const undirToDir = new Map()  // undirKey → [A,B] in the direction it was first seen
  for (const tri of allTrisXYZ) {
    for (let e = 0; e < 3; e++) {
      const A = tri[e], B = tri[(e+1)%3]
      const aStr = `${A[0]},${A[1]},${A[2]}`, bStr = `${B[0]},${B[1]},${B[2]}`
      const uk = aStr < bStr ? `${aStr}|${bStr}` : `${bStr}|${aStr}`
      const prev = undirCount.get(uk) ?? 0
      undirCount.set(uk, prev + 1)
      if (prev === 0) undirToDir.set(uk, [A, B])
    }
  }
  const fromMap = new Map()
  for (const [uk, cnt] of undirCount) {
    if (cnt !== 1) continue
    const [A, B] = undirToDir.get(uk)
    const aStr = `${A[0]},${A[1]},${A[2]}`
    let arr = fromMap.get(aStr); if (!arr) { arr=[]; fromMap.set(aStr,arr) }
    arr.push([A, B])
  }
  if (!fromMap.size) return []

  const used = new Set(), patches = []
  for (const edges of fromMap.values()) {
    for (const [firstA, firstB] of edges) {
      const ek = `${firstA[0]},${firstA[1]},${firstA[2]}|${firstB[0]},${firstB[1]},${firstB[2]}`
      if (used.has(ek)) continue
      const loop3d = [firstA]
      let prev = firstA, cur = firstB
      for (let i = 0; i < fromMap.size + 5; i++) {
        used.add(`${prev[0]},${prev[1]},${prev[2]}|${cur[0]},${cur[1]},${cur[2]}`)
        if (cur[0]===firstA[0] && cur[1]===firstA[1] && cur[2]===firstA[2]) break
        loop3d.push(cur)
        const ck = `${cur[0]},${cur[1]},${cur[2]}`
        const nexts = fromMap.get(ck) ?? []
        const nxt = nexts.find(([,C]) => !used.has(`${cur[0]},${cur[1]},${cur[2]}|${C[0]},${C[1]},${C[2]}`))
        if (!nxt) break
        prev = cur; cur = nxt[1]
      }
      if (loop3d.length < 3) continue
      const xyTo3d = new Map(loop3d.map(v => [`${v[0]},${v[1]}`, v]))
      // Reverse for CCW patch winding (boundary loop is CW, patch needs to be CCW)
      const loop2d = [...loop3d].reverse().map(v => [v[0], v[1]])
      for (const tri2d of buildRoof(loop2d, 0, true)) {
        patches.push(tri2d.map(([x,y]) => xyTo3d.get(`${x},${y}`) ?? [x, y, loop3d[0][2]]))
      }
    }
  }
  if (patches.length) console.log(`  Patched ${patches.length} hole triangles`)
  return patches
}

// ---- Build indexed mesh + write .bin ------------------------------------
function buildIndexed(trisXYZ) {
  const vMap=new Map(), verts=[], idx=[]
  for (const tri of trisXYZ) for (const v of tri) {
    const k=`${v[0]},${v[1]},${v[2]}`
    if (!vMap.has(k)) { vMap.set(k,verts.length); verts.push(v) } idx.push(vMap.get(k))
  }
  return { verts, idx }
}
function signedVol({verts,idx}) {
  let v=0; for (let i=0; i<idx.length; i+=3) {
    const [ax,ay,az]=verts[idx[i]],[bx,by,bz]=verts[idx[i+1]],[cx,cy,cz]=verts[idx[i+2]]
    v+=ax*(by*cz-bz*cy)+ay*(bz*cx-bx*cz)+az*(bx*cy-by*cx)
  }
  return v/6
}
function flipTris(m) { for (let i=0;i<m.idx.length;i+=3) { const t=m.idx[i+1];m.idx[i+1]=m.idx[i+2];m.idx[i+2]=t } }
function writeBin(path, {verts,idx}) {
  const nV=verts.length, nT=idx.length/3, buf=Buffer.alloc(8+nV*12+nT*12); let o=0
  buf.writeUInt32LE(nV,o);o+=4; buf.writeUInt32LE(nT,o);o+=4
  for (const [x,y,z] of verts) { buf.writeFloatLE(x,o);o+=4;buf.writeFloatLE(y,o);o+=4;buf.writeFloatLE(z,o);o+=4 }
  for (const i of idx) { buf.writeUInt32LE(i,o);o+=4 }
  writeFileSync(path,buf); console.log(`  → ${path}: ${nV} verts, ${nT} tris`)
}

// ---- Main ---------------------------------------------------------------
const NAMES = ['ltt-screwdriver','ltt-stubby']
for (let li = 0; li < 2; li++) {
  const loopXY = mainLoops[li], name = NAMES[li]
  console.log(`\n=== ${name} (${loopXY.length} loop verts) ===`)

  const wallIdx = floodFill(loopXY, LOOP_Z)
  console.log(`  Wall triangles: ${wallIdx.size}`)
  const wallTris = [...wallIdx].map(i => [
    [triVerts[i*9],   triVerts[i*9+1], triVerts[i*9+2]],
    [triVerts[i*9+3], triVerts[i*9+4], triVerts[i*9+5]],
    [triVerts[i*9+6], triVerts[i*9+7], triVerts[i*9+8]],
  ])
  writeBin(`public/${name}-walls.bin`, buildIndexed(wallTris))

  const filteredLoop = filterLoop(loopXY, wallIdx, LOOP_Z)
  console.log(`  Filtered loop: ${filteredLoop.length} verts (was ${loopXY.length})`)
  const roofTris = buildRoof(filteredLoop, LOOP_Z)
  const patchTris = patchHoles([...wallTris, ...roofTris])
  const mesh = buildIndexed([...wallTris, ...roofTris, ...patchTris])
  const vol = signedVol(mesh)
  console.log(`  Signed volume: ${vol.toFixed(0)} mm³`)
  if (vol < 0) { flipTris(mesh); console.log('  (normals flipped)') }
  writeBin(`public/${name}.bin`, mesh)
}
console.log('\nDone.')
