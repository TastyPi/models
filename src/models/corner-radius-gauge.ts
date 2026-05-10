import { getManifold } from '../manifold'
import type { Attribution } from '../types'

const TILE_W = 15
const TILE_THICK = 3
const COLS = 5
const GAP = 3
const INSET = 10   // SW convex arc is inset this many mm from the tile corner

export const DW = 2
export const DH = 3
const SW = 0.5
const DOT = SW
const CHAR_GAP = 0.4
const EMBOSS = 0.5
const N_ARC = 16

// All labels are "X.Y" format so the total label width is fixed
export const LABEL_W = DW + CHAR_GAP + DOT + CHAR_GAP + DW

const INLAY_D = 1.2   // depth letter shapes are inlaid into the tile top surface

export const SEGS: Record<string, string[]> = {
  '0': ['a', 'b', 'c', 'd', 'e', 'f'],
  '1': ['b', 'c'],
  '2': ['a', 'b', 'd', 'e', 'g'],
  '3': ['a', 'b', 'c', 'd', 'g'],
  '4': ['b', 'c', 'f', 'g'],
  '5': ['a', 'c', 'd', 'f', 'g'],
  '6': ['a', 'c', 'd', 'e', 'f', 'g'],
  '7': ['a', 'b', 'c'],
  '8': ['a', 'b', 'c', 'd', 'e', 'f', 'g'],
  '9': ['a', 'b', 'c', 'd', 'f', 'g'],
}

export function segBox(seg: string): [number, number, number, number] | null {
  switch (seg) {
    case 'a': return [SW,      DH - SW,         DW - SW, DH             ]
    case 'g': return [SW,      DH / 2 - SW / 2, DW - SW, DH / 2 + SW / 2]
    case 'd': return [SW,      0,               DW - SW, SW             ]
    case 'f': return [0,       DH / 2 + SW / 2, SW,      DH - SW        ]
    case 'b': return [DW - SW, DH / 2 + SW / 2, DW,      DH - SW        ]
    case 'e': return [0,       SW,              SW,      DH / 2 - SW / 2]
    case 'c': return [DW - SW, SW,              DW,      DH / 2 - SW / 2]
    default:  return null
  }
}

export const attribution: Attribution[] = [
  {
    name: 'Gridfinity Radius Finder',
    author: 'john zygoulakis',
    url: 'https://www.printables.com/model/796404-gridfinity-radius-finder-measure-corner-size',
    license: 'CC BY 4.0',
  },
  {
    name: 'Gridfinity',
    author: 'Zachary Freedman / Voidstar Lab',
    url: 'https://www.youtube.com/watch?v=ra_9zU-mnl8',
    license: 'MIT',
  },
  {
    name: 'gridfinity-rebuilt-openscad',
    author: 'Kenneth Hodson',
    url: 'https://github.com/kennetek/gridfinity-rebuilt-openscad',
    license: 'MIT',
  },
]

export const flatModel = true

export interface Params {
  text_style: string
  text_top: boolean
  text_bottom: boolean
}

export function generate({ text_style, text_top, text_bottom }: Params) {
    const { Manifold, CrossSection } = getManifold()
    const isMulti = text_style === 'multicolour'
    const showTop = text_top
    const showBottom = text_bottom

    const arc = (cx: number, cy: number, a0: number, a1: number, r: number): [number, number][] => {
      const pts: [number, number][] = []
      for (let i = 0; i <= N_ARC; i++) {
        const a = a0 + (a1 - a0) * i / N_ARC
        pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)])
      }
      return pts
    }

    const buildLabel = (label: string, xOff: number, yOff: number, zBase: number, h = EMBOSS): any => {
      let cx = xOff
      let text: any = null
      for (let j = 0; j < label.length; j++) {
        const ch = label[j]
        const cw = ch === '.' ? DOT : DW
        let glyph: any = null

        if (ch === '.') {
          glyph = Manifold.cube([DOT, DOT, h]).translate([cx, yOff, zBase])
        } else {
          for (const seg of (SEGS[ch] ?? [])) {
            const b = segBox(seg)
            if (!b) continue
            const [bx1, by1, bx2, by2] = b
            const piece = Manifold.cube([bx2 - bx1, by2 - by1, h])
              .translate([cx + bx1, yOff + by1, zBase])
            glyph = glyph ? glyph.add(piece) : piece
          }
        }

        if (glyph) text = text ? text.add(glyph) : glyph
        cx += cw + (j < label.length - 1 ? CHAR_GAP : 0)
      }
      return text
    }

    const W = TILE_W
    // Top label: centred in the full-width upper strip (y > INSET), running along X.
    // Bottom label: diagonal-symmetric counterpart — 180° rotation around the SW→NE axis
    // maps (x,y,z)→(y,x,TILE_THICK−z), so the label runs along Y with x/y swapped.
    const LX0 = (W - LABEL_W) / 2
    const LY0 = INSET + (W - INSET - DH) / 2

    const allPieces: { label: string; geom: any; primaryGeom?: any; secondaryGeom?: any }[] = []

    for (let i = 0; i < 10; i++) {
      const r = (i + 1) * 0.5
      const col = i % COLS
      const row = Math.floor(i / COLS)
      const tileX = col * (W + GAP)
      const tileY = row * (W + GAP)
      const labelStr = r.toFixed(1)

      // Tile outline:
      //   SW: convex (inner) arc inset INSET mm — horizontal + vertical reference walls,
      //       then convex arc at (INSET-r, INSET-r), π/2→0 bulging toward the SW corner
      //   SE: sharp corner at (W, 0)
      //   NE: convex (outer) arc at (W-r, W-r), 0→π/2 rounding the NE corner
      //   NW: sharp corner at (0, W); polygon closes down the West edge to (0, INSET)
      const pts: [number, number][] = [
        [0, INSET],
        ...arc(INSET - r, INSET - r, Math.PI / 2, 0, r),
        [INSET, 0],
        [W, 0],
        ...arc(W - r, W - r, 0, Math.PI / 2, r),
        [0, W],
      ]
      const tileCS = new CrossSection(pts, 'NonZero')
      let tile: any = tileCS.extrude(TILE_THICK)

      if (!isMulti) {
        if (showTop) {
          const text = buildLabel(labelStr, LX0, LY0, TILE_THICK - EMBOSS)
          if (text) tile = tile.subtract(text)
        }
        if (showBottom) {
          const text = buildLabel(labelStr, 0, 0, 0)
          if (text) tile = tile.subtract(text.mirror([1, -1, 0]).translate([LY0, LX0, 0]))
        }
        allPieces.push({ label: `${labelStr}mm`, geom: tile.translate([tileX, tileY, 0]) })
      } else {
        // Multi-colour: letter shapes inlaid flush at top/bottom surfaces.
        // Composed as two separate shells — assign extruder 1 to the tile body
        // and extruder 2 to the text body in the slicer.
        const lettersTop = showTop    ? buildLabel(labelStr, LX0, LY0, TILE_THICK - INLAY_D, INLAY_D) : null
        const lettersBot = showBottom ? buildLabel(labelStr, 0, 0, 0, INLAY_D)?.mirror([1, -1, 0]).translate([LY0, LX0, 0]) : null
        const letterParts = [lettersTop, lettersBot].filter(Boolean)
        let tileBody = tile
        for (const l of letterParts) tileBody = tileBody.subtract(l)
        const letterUnion = letterParts.length > 0
          ? letterParts.reduce((a, b) => a.add(b))
          : null
        const exportGeom = letterUnion
          ? Manifold.compose([tileBody, letterUnion])
          : tileBody
        allPieces.push({
          label: `${labelStr}mm`,
          geom: exportGeom.translate([tileX, tileY, 0]),
          primaryGeom: tileBody.translate([tileX, tileY, 0]),
          secondaryGeom: letterUnion?.translate([tileX, tileY, 0]),
        })
      }
    }

    const merged = allPieces.reduce((a, b) => ({ ...a, geom: a.geom.add(b.geom) })).geom
    return { merged, pieces: allPieces }
}
