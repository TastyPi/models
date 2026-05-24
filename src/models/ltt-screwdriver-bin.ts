import { getManifold, manifoldToBufferGeometry } from '../manifold'
import { SOLID_INFILL } from '../types'
import type { Attribution, GeomResult, RawMesh } from '../types'
import {
  BASE_H, FLOOR_THICK, HEIGHT_UNIT,
  attribution as gridfinityAttribution, type BinHoleSettings,
  buildBinManifold, buildBinFillManifold,
} from './gridfinity-bin'
import {
  BIT_DEPTH, BIT_R, BIT_PITCH_LONG, BIT_PITCH_SHORT,
  buildShaftExtensionGrooves, buildPenGroove,
  type BitHoleGeom, type BitZoneSettings,
} from './ltt-groove'
export type { BitZoneSettings } from './ltt-groove'

export const attribution: Attribution[] = gridfinityAttribution

// Standard screwdriver: 6×1 cells
const STANDARD_CELLS_X = 6
const STANDARD_CELLS_Y = 1

// Stubby screwdriver: 3×1 cells (Y finger scoops extend outside the bin footprint)
const STUBBY_CELLS_X = 3
const STUBBY_CELLS_Y = 1

// Height: minimum to fit each cavity flush with the bin top
const STANDARD_HEIGHT_UNITS = 4
const STUBBY_HEIGHT_UNITS    = 4

// Cavity positions in STL space.
// Standard: handle end (max-X = 221.502) flush against inner −X wall (6×1 = 124.55 mm). Rotated 180°.
const STANDARD_CAVITY_DX = -(221.502 - 124.55)  // = −96.952
const STANDARD_CAVITY_CY = 35.447               // centred in Y
// Stubby: handle end (min-X = 11.872) flush against inner −X wall (3×2 = 61.55 mm). No rotation.
const STUBBY_CAVITY_DX = -(11.872 + 61.55)      // = −73.422
const STUBBY_CAVITY_CY = 83.751                  // centred in Y

// Cavity Z extents in STL space
const STANDARD_CAVITY_MIN_Z = 1.792
const STANDARD_CAVITY_MAX_Z = 22.392
const STUBBY_CAVITY_MIN_Z   = 0.690
// Use the Z of the full-width cross-section (flange level), not the dome tip at 22.704
const STUBBY_CAVITY_MAX_Z   = 22.3


// Zone geometry (bin coordinates, standard after 180° Z rotation: tip at +X)
// Shaft occupies Y ±4.875mm; at X=10 the cavity is still narrow (≈6.6mm), safe for 3.4mm gap
const SHAFT_TIP_X  =  87.0
const SHAFT_BASE_X =  10.0
const SHAFT_HALF_Y =   4.875
const OUTER_HALF_X = 125.75   // 6×42/2 − 0.25 (BIN_GAP)
const FILL_HALF_Y  =  19.55   // inner wall face in Y
const FILL_HALF_X  = 124.55   // inner wall face in X (OUTER_HALF_X − 1.2mm wall)

const STANDARD_BIT_GEOM: BitHoleGeom = { fillHalfX: FILL_HALF_X, outerHalfX: OUTER_HALF_X, fillHalfY: FILL_HALF_Y, shaftTipX: SHAFT_TIP_X, shaftBaseX: SHAFT_BASE_X, shaftHalfY: SHAFT_HALF_Y }
// Stubby bit zone geometry in bin coords (handle at −61.55, tip at ≈+40.3, 3×1 cells)
// Narrow shaft (cavity half-Y ≈ 5 mm) begins at bin x ≈ 25 mm
const STUBBY_BIT_GEOM: BitHoleGeom = { fillHalfX: 61.55, outerHalfX: 62.75, fillHalfY: 19.55, shaftTipX: 33.1, shaftBaseX: 26.0, shaftHalfY: 5.0, phaseShift: 0, sideExtend: 1, endXOffset: BIT_PITCH_SHORT }

// col 0 is the column nearest the far (+X) wall; col increases toward the screwdriver.
// row 0 sits near bin centre-Y; positive rows toward +Y wall, negative toward -Y.
export type GridPos = readonly [col: number, row: number]

export type GridAnchor = {
  x0:        number    // x centre of col 0
  yAnchor:   number    // y baseline (added before stagger offset and row index)
  col0Phase: 0 | 1     // stagger phase of col 0: 0 means +BIT_PITCH_LONG/2 offset, 1 means no offset
}

export function computeGridAnchor(geom: BitHoleGeom): GridAnchor {
  return {
    x0:        geom.fillHalfX - BIT_R,
    yAnchor:   5 * BIT_PITCH_LONG / 4,
    col0Phase: 0,
  }
}

export function gridToXY([col, row]: GridPos, anchor: GridAnchor): [number, number] {
  const cx   = anchor.x0 - col * BIT_PITCH_SHORT
  const yOff = (anchor.col0Phase + col) % 2 === 0 ? BIT_PITCH_LONG / 2 : 0
  return [cx, anchor.yAnchor - row * BIT_PITCH_LONG + yOff]
}

type ZoneOpt = 'none' | 'extension' | 'pen'

type RightNode   = { holes: GridPos[] }
type LeftNode    = { holes: GridPos[]; right: Record<ZoneOpt, RightNode> }
type ModelNode   = { holes: GridPos[]; left:  Record<ZoneOpt, LeftNode>  }
type BitHoleTree = Record<'standard' | 'stubby', ModelNode>

function emptyRight(): RightNode { return { holes: [] } }
function emptyLeft():  LeftNode  { return { holes: [], right: { none: emptyRight(), extension: emptyRight(), pen: emptyRight() } } }
function emptyModel(): ModelNode { return { holes: [], left:  { none: emptyLeft(),  extension: emptyLeft(),  pen: emptyLeft()  } } }

const BIT_HOLE_TREE: BitHoleTree = {
  standard: {
    holes: [],
    left: {
      none: {
        holes: [],
        right: {
          none: { holes: [
            [0,0],[0,1],[0,2],[0,3],
            [1,0],[1,1],[1,2],[1,3],
            [2,0],[2,1],[2,2],[2,3],
            [3,0],[3,1],[3,2],[3,3],
            [4,0],[4,3],
            [5,0],[5,3],
            [6,0],[6,3],
            [7,0],[7,3],
            [8,0],[8,3],
            [9,0],[9,3],
            [10,0],[10,3],
            [11,0],[11,3],
            [12,0],[12,3],
            [13,0],[13,3],
            [14,0],
          ] },
          extension: { holes: [
            [0,0],[0,1],[0,2],
            [1,0],[1,1],
            [2,0],[2,1],[2,2],
            [3,0],[3,1],
            [4,0],
            [5,0],
            [6,0],
            [7,0],
            [8,0],
            [9,0],
            [10,0],
            [11,0],
            [12,0],
            [13,0],
            [14,0],
          ] },
          pen: { holes: [
            [0,0],[0,1],[0,2],[0,3],
            [1,0],[1,1],[1,2],[1,3],
            [2,0],[2,1],[2,2],
            [3,0],[3,1],
            [4,0],[4,1],[4,2],
            [5,0],[5,1],
            [6,0],[6,1],[6,2],
            [7,0],[7,1],
            [8,0],[8,1],[8,2],
            [9,0],
            [10,0],[11,0],[12,0],[13,0],[14,0],[15,0],[16,0],[17,0],[18,0],[19,0],
          ] },
        },
      },
      extension: {
        holes: [],
        right: {
          none: { holes: [
            [0,2],[0,3],
            [1,1],[1,2],[1,3],
            [2,2],[2,3],
            [3,1],[3,2],[3,3],
            [4,3],[5,3],[6,3],[7,3],[8,3],[9,3],[10,3],[11,3],[12,3],[13,3],
          ] },
          extension: { holes: [
            [0,2],
            [1,1],
            [2,2],
            [3,1],
          ] },
          pen:       { holes: [
            [0,0],[0,1],[0,2],[0,3],
            [1,0],[1,1],[1,2],[1,3],
            [2,0],[2,1],[2,2],
            [3,0],[3,1],
            [4,0],[4,1],[4,2],
            [5,1],
            [6,2],
            [7,1],
            [8,2],
          ] },
        },
      },
      pen: {
        holes: [],
        right: {
          none: { holes: [
            [0,0],[0,1],[0,2],[0,3],
            [1,0],[1,1],[1,2],[1,3],
            [2,2],[2,3],
            [3,1],[3,2],[3,3],
            [4,2],[4,3],
            [5,1],[5,2],[5,3],
            [6,2],[6,3],
            [7,1],[7,2],[7,3],
            [8,2],[8,3],
            [9,3],[10,3],[11,3],[12,3],[13,3],[14,3],[15,3],[16,3],[17,3],[18,3],[19,3],
          ] },
          extension: { holes: [
            [0,0],[0,1],[0,2],[0,3],
            [1,0],[1,1],[1,2],[1,3],
            [2,2],[2,3],
            [3,1],[3,2],[3,3],
            [4,2],[4,3],
            [5,1],
            [6,2],
            [7,1],
            [8,2],
          ] },
          pen:       { holes: [
            [0,0],[0,1],[0,2],[0,3],
            [1,0],[1,1],[1,2],[1,3],
            [2,2],
            [3,1],
            [4,2],
            [5,1],
            [6,2],
            [7,1],
            [8,2],
          ] },
        },
      },
    },
  },
  stubby: {
    holes: [],
    left: {
      none: {
        holes: [],
        right: {
          none: { holes: [
            [0,0],[0,1],[0,2],[0,3],
            [1,0],[1,1],[1,2],[1,3],
            [2,0],[2,3],
            [3,0],[3,3],
            [4,0],
          ] },
          extension: { holes: [
            [0,0],[0,1],[0,2],
            [1,0],[1,1],
            [2,0],[2,1],[2,2],
            [3,0],[3,1],
            [4,0],[4,1],[4,2],
            [5,0],[5,1],
            [6,0],[6,1],[6,2],
            [7,0],[7,1],
            [8,0],[8,1],[8,2],
            [9,0],[9,1],
            [10,0],[10,1],[10,2],
            [11,0],[11,1],
            [12,0],[12,1],[12,2],
            [13,0],
            [14,0],
          ] },
          pen:       { holes: [
            [0,0],[0,1],[0,2],[0,3],
            [1,0],[1,1],[1,2],[1,3],
            [2,0],[2,1],[2,2],
            [3,0],[3,1],
            [4,0],[4,1],[4,2],
            [5,0],[5,1],
            [6,0],[6,1],[6,2],
            [7,0],[7,1],
            [8,0],[8,1],[8,2],
            [9,0],[9,1],
            [10,0],[10,1],[10,2],
            [11,0],[11,1],
            [12,0],[12,1],[12,2],
            [13,0],[13,1],
            [14,0],[14,1],[14,2],
            [15,0],[15,1],
            [16,0],[16,1],[16,2],
            [17,0],[17,1],
            [18,0],[19,0],[20,0],
          ] },
        },
      },
      extension: {
        holes: [],
        right: {
          none: { holes: [
            [0,2],[0,3],
            [1,1],[1,2],[1,3],
            [2,2],[2,3],
            [3,1],[3,2],[3,3],
            [4,2],[4,3],
            [5,1],[5,2],[5,3],
            [6,2],[6,3],
            [7,1],[7,2],[7,3],
            [8,2],[8,3],
            [9,1],[9,2],[9,3],
            [10,2],[10,3],
            [11,1],[11,2],[11,3],
            [12,2],[12,3],
            [13,3],
            [14,3],
          ] },
          extension: { holes: [
            [0,2],
            [1,1],
            [2,2],
            [3,1],
            [4,2],
            [5,1],
            [6,2],
            [7,1],
            [8,2],
            [9,1],
            [10,2],
            [11,1],
            [12,2],
          ] },
          pen:       { holes: [
            [0,0],[0,1],[0,2],[0,3],
            [1,0],[1,1],[1,2],[1,3],
            [2,0],[2,1],[2,2],
            [3,0],[3,1],
            [4,0],[4,1],[4,2],
            [5,0],[5,1],
            [6,2],
            [7,1],[8,2],[9,1],[10,2],[11,1],[12,2],[13,1],[14,2],[15,1],[16,2],[17,1],
          ] },
        },
      },
      pen: {
        holes: [],
        right: {
          none: { holes: [
            [0,0],[0,1],[0,2],[0,3],
            [1,0],[1,1],[1,2],[1,3],
            [2,2],[2,3],
            [3,1],[3,2],[3,3],
            [4,2],[4,3],
            [5,1],[5,2],[5,3],
            [6,2],[6,3],
            [7,1],[7,2],[7,3],
            [8,2],[8,3],
            [9,1],[9,2],[9,3],
            [10,2],[10,3],
            [11,1],[11,2],[11,3],
            [12,2],[12,3],
            [13,1],[13,2],[13,3],
            [14,2],[14,3],
            [15,1],[15,2],[15,3],
            [16,2],[16,3],
            [17,1],[17,2],[17,3],
            [18,3],
            [19,3],
          ] },
          extension: { holes: [
            [0,0],[0,1],[0,2],[0,3],
            [1,0],[1,1],[1,2],[1,3],
            [2,2],[2,3],
            [3,1],[3,2],[3,3],
            [4,2],[4,3],
            [5,1],[5,2],[5,3],
            [6,2],[7,1],[8,2],[9,1],[10,2],[11,1],[12,2],[13,1],[14,2],[15,1],[16,2],[17,1],
          ] },
          pen:       { holes: [
            [0,0],[0,1],[0,2],[0,3],
            [1,0],[1,1],[1,2],[1,3],
            [2,2],
            [3,1],[4,2],[5,1],[6,2],[7,1],[8,2],[9,1],[10,2],[11,1],[12,2],[13,1],[14,2],[15,1],[16,2],[17,1],
          ] },
        },
      },
    },
  },
}

export function collectBitHoles(
  model: 'standard' | 'stubby',
  left:  ZoneOpt,
  right: ZoneOpt,
): GridPos[] {
  const m = BIT_HOLE_TREE[model]
  const l = m.left[left]
  return [...m.holes, ...l.holes, ...l.right[right].holes]
}

function buildBitHoles(positions: GridPos[], anchor: GridAnchor, binTopZ: number): any | null {
  if (positions.length === 0) return null
  const { Manifold, CrossSection } = getManifold()
  const hexFlat = new CrossSection([
    Array.from({ length: 6 }, (_, k): [number, number] => {
      const a = k * (Math.PI / 3)
      return [BIT_R * Math.cos(a), BIT_R * Math.sin(a)]
    }),
  ], 'NonZero').extrude(BIT_DEPTH)
  const holeZ = binTopZ - BIT_DEPTH
  return Manifold.union(positions.map(pos => {
    const [cx, cy] = gridToXY(pos, anchor)
    return hexFlat.translate([cx, cy, holeZ])
  }))
}


function parseMesh(buf: ArrayBuffer): RawMesh {
  const dv = new DataView(buf)
  const nVerts = dv.getUint32(0, true)
  const nTris  = dv.getUint32(4, true)
  return {
    numProp: 3,
    vertProperties: new Float32Array(buf, 8, nVerts * 3),
    triVerts:       new Uint32Array(buf, 8 + nVerts * 12, nTris * 3),
  }
}

const meshCache = new Map<string, RawMesh>()

async function loadMesh(filename: string): Promise<RawMesh> {
  if (meshCache.has(filename)) return meshCache.get(filename)!
  const url = `${import.meta.env.BASE_URL}${filename}`
  const buf = await fetch(url).then(r => r.arrayBuffer())
  const mesh = parseMesh(buf)
  meshCache.set(filename, mesh)
  return mesh
}

export function info(type: 'standard' | 'stubby', zones?: BitZoneSettings): string {
  const hasPenSide   = zones?.left === 'pen'       || zones?.right === 'pen'
  const hasExtension = zones?.left === 'extension'  || zones?.right === 'extension'
  const cx = type === 'standard'
    ? (hasPenSide ? 7 : STANDARD_CELLS_X)
    : (hasPenSide ? 6 : hasExtension ? 5 : STUBBY_CELLS_X)
  const cy = type === 'standard' ? STANDARD_CELLS_Y : STUBBY_CELLS_Y
  const hu = type === 'standard' ? STANDARD_HEIGHT_UNITS : STUBBY_HEIGHT_UNITS
  const w = cx * 42 - 2 * 0.25
  const d = cy * 42 - 2 * 0.25
  const h = hu * HEIGHT_UNIT
  return `${cx}×${cy}, ${hu}u — ${w} × ${d} × ${h} mm`
}

export async function generate(p: {
  type: 'standard' | 'stubby'
  holes: BinHoleSettings
  zones?: BitZoneSettings
  bitHoles?: boolean
}): Promise<GeomResult> {
  const { Manifold, Mesh } = getManifold()

  const isStubby = p.type === 'stubby'
  const hasPenSide   = p.zones?.left === 'pen'       || p.zones?.right === 'pen'
  const hasExtension = p.zones?.left === 'extension'  || p.zones?.right === 'extension'
  const cells_x = isStubby
    ? (hasPenSide ? 6 : hasExtension ? 5 : STUBBY_CELLS_X)
    : (hasPenSide ? 7 : STANDARD_CELLS_X)
  const cells_y = isStubby ? STUBBY_CELLS_Y : STANDARD_CELLS_Y
  const height_units = isStubby ? STUBBY_HEIGHT_UNITS : STANDARD_HEIGHT_UNITS

  const rawMesh = await loadMesh(isStubby ? 'ltt-stubby.bin' : 'ltt-screwdriver.bin')
  const cavity = new Manifold(new Mesh(rawMesh))

  const outerHalfX = cells_x * 42 / 2 - 0.25
  const fillHalfX  = outerHalfX - 1.2
  // Standard is rotated 180° around Z so tip points toward +X; stubby is not rotated (handle already at min-X).
  const dx = isStubby ? -(11.872 + fillHalfX) : 221.502 - fillHalfX
  const dy = isStubby ? -STUBBY_CAVITY_CY : STANDARD_CAVITY_CY
  const cavityMinZ = isStubby ? STUBBY_CAVITY_MIN_Z : STANDARD_CAVITY_MIN_Z
  const cavityMaxZ = isStubby ? STUBBY_CAVITY_MAX_Z : STANDARD_CAVITY_MAX_Z
  const binTop = height_units * HEIGHT_UNIT
  // Align cavity top with bin top, but clamp so cavity bottom never dips below
  // the fill floor — Manifold subtract fails silently if the operand extends below.
  const dz = Math.max(binTop - cavityMaxZ, BASE_H + FLOOR_THICK - cavityMinZ)
  const fillTopZ = binTop

  const binShell = buildBinManifold({
    cells_x, cells_y, height_units, stacking_lip: false, holes: p.holes,
    base_style: 'flat', dividers_x: 0, dividers_y: 0, label_style: 'none',
  })
  const fill = buildBinFillManifold({ cells_x, cells_y, height_units, stacking_lip: false, holes: p.holes }, fillTopZ)
  const positionedCavity = isStubby
    ? cavity.translate([dx, dy, dz])
    : cavity.rotate([0, 0, 180]).translate([dx, dy, dz])
  const baseGeom   = isStubby ? STUBBY_BIT_GEOM : STANDARD_BIT_GEOM
  // When the bin is extended for a pen groove, the cavity shifts toward −X by `delta`.
  // Shift shaft positions by the same amount so bit-hole zones track the cavity.
  const delta = fillHalfX - baseGeom.fillHalfX
  const zoneGeom: BitHoleGeom = {
    ...baseGeom,
    fillHalfX,
    outerHalfX,
    shaftTipX:  baseGeom.shaftTipX  - delta,
    shaftBaseX: baseGeom.shaftBaseX - delta,
  }
  const gridAnchor    = computeGridAnchor(zoneGeom)
  const holePositions = (p.bitHoles && p.zones)
    ? collectBitHoles(isStubby ? 'stubby' : 'standard', p.zones.left, p.zones.right)
    : []
  const bitHoles      = buildBitHoles(holePositions, gridAnchor, binTop)
  const extensions = p.zones ? buildShaftExtensionGrooves(p.zones, binTop, zoneGeom, true) : null
  const penGroove  = p.zones ? buildPenGroove(p.zones, binTop, zoneGeom, true) : null
  let filledWithCuts = fill ? fill.subtract(positionedCavity) : null
  if (filledWithCuts && bitHoles)   filledWithCuts = filledWithCuts.subtract(bitHoles)
  if (filledWithCuts && extensions) filledWithCuts = filledWithCuts.subtract(extensions)
  if (filledWithCuts && penGroove)  filledWithCuts = filledWithCuts.subtract(penGroove)
  const bin = filledWithCuts ? binShell.add(filledWithCuts) : binShell

  const label = isStubby ? 'LTT Stubby Bin' : 'LTT Screwdriver Bin'
  return {
    objects: [{
      label,
      parts: [{ label, geom: manifoldToBufferGeometry(bin), settings: SOLID_INFILL }],
    }],
  }
}
