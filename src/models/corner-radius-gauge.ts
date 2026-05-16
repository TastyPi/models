import { Font } from 'three/examples/jsm/loaders/FontLoader.js'
import helvetikerBold from 'three/examples/fonts/helvetiker_bold.typeface.json'
import { getManifold, manifoldToBufferGeometry } from '../manifold'
import type { Attribution, ObjGeom, GeomResult } from '../types'

const TILE_W = 15
const TILE_THICK = 3
const COLS = 5
const GAP = 3
const INSET = 10

const EMBOSS = 0.5
const INLAY_D = 1.2
const TEXT_SIZE = 3
const CURVE_SEGS = 6
const N_ARC = 16

const font = new Font(helvetikerBold as any)

function buildTextLabel(label: string, depth: number) {
  const { CrossSection } = getManifold()

  const shapes = font.generateShapes(label, TEXT_SIZE)

  // Collect all contours (outer + holes) and let CrossSection's NonZero fill
  // rule resolve which regions are filled — outer contours are CCW, holes CW.
  const contours: [number, number][][] = []
  for (const shape of shapes) {
    contours.push(shape.getPoints(CURVE_SEGS).map(p => [p.x, p.y] as [number, number]))
    for (const hole of shape.holes) {
      contours.push(hole.getPoints(CURVE_SEGS).map(p => [p.x, p.y] as [number, number]))
    }
  }

  const cs = new CrossSection(contours, 'NonZero')
  const bounds = cs.bounds()
  const w = bounds.max[0] - bounds.min[0]
  return { m: cs.translate([-bounds.min[0], -bounds.min[1]]).extrude(depth), w }
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

export interface Params {
  text_style: string
  text_top: boolean
  text_bottom: boolean
  body_extruder: number | null
  text_extruder: number | null
}

export function generate({ text_style, text_top, text_bottom, body_extruder, text_extruder }: Params): GeomResult {
  const { CrossSection } = getManifold()
  const isMulti = text_style === 'multicolour'

  const arc = (cx: number, cy: number, a0: number, a1: number, r: number): [number, number][] => {
    const pts: [number, number][] = []
    for (let i = 0; i <= N_ARC; i++) {
      const a = a0 + (a1 - a0) * i / N_ARC
      pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)])
    }
    return pts
  }

  const W = TILE_W
  // Centre text vertically in the upper strip (y > INSET) of the tile
  const LY0 = INSET + (W - INSET - TEXT_SIZE) / 2

  const allPieces: ObjGeom[] = []

  for (let i = 0; i < 10; i++) {
    const r = (i + 1) * 0.5
    const col = i % COLS
    const row = Math.floor(i / COLS)
    const tileX = col * (W + GAP)
    const tileY = row * (W + GAP)
    const labelStr = r.toFixed(1)

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
      if (text_top) {
        const { m: text, w } = buildTextLabel(labelStr, EMBOSS)
        const lx = (W - w) / 2
        tile = tile.subtract(text.translate([lx, LY0, TILE_THICK - EMBOSS]))
      }
      if (text_bottom) {
        const { m: text, w } = buildTextLabel(labelStr, EMBOSS)
        const lx = (W - w) / 2
        // Diagonal-symmetric counterpart: 180° rotation around the SW→NE axis
        // maps (x,y,z)→(y,x,TILE_THICK−z), so the label runs along Y with x/y swapped.
        tile = tile.subtract(text.mirror([1, -1, 0]).translate([LY0, lx, 0]))
      }
      allPieces.push({
        label: `${labelStr}mm`,
        parts: [{ label: `${labelStr}mm`, geom: manifoldToBufferGeometry(tile.translate([tileX, tileY, 0])), extruder: body_extruder ?? undefined }],
      })
    } else {
      const buildPart = (forTop: boolean) => {
        const depth = INLAY_D
        const { m: text, w } = buildTextLabel(labelStr, depth)
        const lx = (W - w) / 2
        if (forTop) return text.translate([lx, LY0, TILE_THICK - depth])
        return text.mirror([1, -1, 0]).translate([LY0, lx, 0])
      }
      const lettersTop = text_top ? buildPart(true) : null
      const lettersBot = text_bottom ? buildPart(false) : null
      const letterParts = [lettersTop, lettersBot].filter(Boolean)
      let tileBody = tile
      for (const l of letterParts) tileBody = tileBody.subtract(l)
      const letterUnion = letterParts.length > 0
        ? letterParts.reduce((a: any, b: any) => a.add(b))
        : null
      const parts: ObjGeom['parts'] = [{
        label: 'Body',
        geom: manifoldToBufferGeometry(tileBody.translate([tileX, tileY, 0])),
        extruder: body_extruder ?? undefined,
      }]
      if (letterUnion) parts.push({
        label: 'Text',
        geom: manifoldToBufferGeometry(letterUnion.translate([tileX, tileY, 0])),
        extruder: text_extruder ?? undefined,
      })
      allPieces.push({ label: `${labelStr}mm`, parts })
    }
  }

  return { objects: allPieces }
}
