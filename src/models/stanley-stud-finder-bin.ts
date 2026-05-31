import { getManifold, manifoldToBufferGeometry } from '../manifold'
import type { Attribution, GeomResult } from '../types'
import {
  BASE_H, FLOOR_THICK, HEIGHT_UNIT, STACKING_LIP_H,
  GRIDFINITY_BIN_SETTINGS,
  attribution as gridfinityAttribution,
  type BinHoleSettings,
  buildBinManifold, buildBinFillManifold,
} from './gridfinity-bin'

export const CELLS_X = 2
export const CELLS_Y = 4
const STANDALONE_HEIGHT_UNITS = 2
const STACKABLE_HEIGHT_UNITS  = 6

// STHT77403 cavity shape — finalised from physical measurement.
export const CAVITY_W       = 60
export const CAVITY_D       = 137.5
export const CAVITY_SAG_X   = 5.5
export const CAVITY_SAG_Y   = 3.5
export const CAVITY_NOTCH_W = 8
export const CAVITY_NOTCH_D = 4

// 3D void geometry
const N_ARC   = 32   // segments per 2D arc
const N_CH    = 10   // rings per fillet zone (one per 0.2 mm print layer)
const DRAFT_R = 1.0  // bottom fillet radius (floor → main body); main body is this wider than floor
const TOP_R   = 2.0  // top fillet radius (main body → opening)

// ─── 2D arc helpers ──────────────────────────────────────────────────────────

function arcFromThreePoints(
  p1: [number,number], pm: [number,number], p2: [number,number], n: number,
): [number,number][] {
  const [ax,ay]=p1, [bx,by]=pm, [cx,cy]=p2
  const D2  = 2*(ax*(by-cy)+bx*(cy-ay)+cx*(ay-by))
  const ocx = ((ax*ax+ay*ay)*(by-cy)+(bx*bx+by*by)*(cy-ay)+(cx*cx+cy*cy)*(ay-by))/D2
  const ocy = ((ax*ax+ay*ay)*(cx-bx)+(bx*bx+by*by)*(ax-cx)+(cx*cx+cy*cy)*(bx-ax))/D2
  const R   = Math.sqrt((ax-ocx)**2+(ay-ocy)**2)
  const a1  = Math.atan2(ay-ocy,ax-ocx)
  const am  = Math.atan2(by-ocy,bx-ocx)
  const a2  = Math.atan2(cy-ocy,cx-ocx)
  let da=a2-a1; while(da> Math.PI)da-=2*Math.PI; while(da<-Math.PI)da+=2*Math.PI
  let dam=am-a1; while(dam>Math.PI)dam-=2*Math.PI; while(dam<-Math.PI)dam+=2*Math.PI
  if(Math.sign(da)!==Math.sign(dam)) da-=Math.sign(da)*2*Math.PI
  return Array.from({length:n+1},(_,i):[number,number]=>{const a=a1+(i/n)*da;return[ocx+R*Math.cos(a),ocy+R*Math.sin(a)]})
}

function arcSeg(p1:[number,number], pm:[number,number], p2:[number,number]): [number,number][] {
  const dx=pm[0]-(p1[0]+p2[0])/2, dy=pm[1]-(p1[1]+p2[1])/2
  if(Math.sqrt(dx*dx+dy*dy)<1e-6)
    return Array.from({length:N_ARC+1},(_,i):[number,number]=>{const t=i/N_ARC;return[p1[0]+t*(p2[0]-p1[0]),p1[1]+t*(p2[1]-p1[1])]})
  return arcFromThreePoints(p1,pm,p2,N_ARC)
}

// Arc from p1 through pm to p2 with a triangular notch at the midpoint extreme.
// Works for both top (x decreasing) and bottom (x increasing) arcs.
function arcWithNotch(
  p1:[number,number], pm:[number,number], p2:[number,number],
  notchW:number, notchD:number,
): [number,number][] {
  if(notchW<=0||notchD<=0) return arcSeg(p1,pm,p2)
  const nh=notchW/2
  const [ax,ay]=p1,[bx,by]=pm,[ex,ey]=p2
  const D2=2*(ax*(by-ey)+bx*(ey-ay)+ex*(ay-by))
  const ocx=((ax*ax+ay*ay)*(by-ey)+(bx*bx+by*by)*(ey-ay)+(ex*ex+ey*ey)*(ay-by))/D2
  const ocy=((ax*ax+ay*ay)*(ex-bx)+(bx*bx+by*by)*(ax-ex)+(ex*ex+ey*ey)*(bx-ax))/D2
  const R=Math.sqrt((ax-ocx)**2+(ay-ocy)**2)
  if(nh>=R) return arcSeg(p1,pm,p2)
  const yEntry=ocy+(by>ocy?1:-1)*Math.sqrt(R*R-nh*nh)
  const rightEntry:[number,number]=[ nh,yEntry]
  const leftEntry: [number,number]=[-nh,yEntry]
  const tip:       [number,number]=[0,by+(by<0?notchD:-notchD)]
  const full=arcFromThreePoints(p1,pm,p2,N_ARC*4)
  const xInc=p2[0]>p1[0]
  let iA=-1,iB=-1
  if(xInc){
    for(let i=0;i<full.length-1;i++){
      if(full[i][0]<-nh&&full[i+1][0]>=-nh&&iA<0) iA=i+1
      if(full[i][0]< nh&&full[i+1][0]>= nh&&iB<0){iB=i;break}
    }
    if(iA<0||iB<0) return arcSeg(p1,pm,p2)
    return[...full.slice(0,iA),leftEntry,tip,rightEntry,...full.slice(iB+1)]
  } else {
    for(let i=0;i<full.length-1;i++){
      if(full[i][0]>= nh&&full[i+1][0]< nh&&iA<0) iA=i
      if(full[i][0]>=-nh&&full[i+1][0]<-nh&&iB<0){iB=i+1;break}
    }
    if(iA<0||iB<0) return arcSeg(p1,pm,p2)
    return[...full.slice(0,iA+1),rightEntry,tip,leftEntry,...full.slice(iB)]
  }
}

// Builds the 2D cavity polygon. Both top (+D/2) and bottom (−D/2) arcs have notches.
export function buildCavityShape(
  W:number,D:number,sagX:number,sagY:number,notchW:number,notchD:number,
): [number,number][] {
  const hw=W/2,hd=D/2,cx=hw-sagX,cy=hd-sagY
  const bottom=arcSeg      ([-cx,-cy],[0,-hd],[ cx,-cy])
  const right =arcSeg      ([ cx,-cy],[hw, 0],[ cx, cy])
  const top   =arcWithNotch([ cx, cy],[0, hd],[-cx, cy],notchW,notchD)
  const left  =arcSeg      ([-cx, cy],[-hw,0],[-cx,-cy])
  return[...bottom.slice(0,-1),...right.slice(0,-1),...top.slice(0,-1),...left.slice(0,-1)]
}

// ─── 3D loft mesh ─────────────────────────────────────────────────────────────

// Outward vertex normals for a CCW polygon (right-hand normal = outward).
function outwardNormals(pts:[number,number][]): [number,number][] {
  const M=pts.length
  return pts.map((_,i)=>{
    const p=pts[(i-1+M)%M],v=pts[i],n=pts[(i+1)%M]
    const e1x=v[0]-p[0],e1y=v[1]-p[1],l1=Math.sqrt(e1x*e1x+e1y*e1y)||1
    const e2x=n[0]-v[0],e2y=n[1]-v[1],l2=Math.sqrt(e2x*e2x+e2y*e2y)||1
    const nx=(e1y/l1)+(e2y/l2), ny=(-e1x/l1)+(-e2x/l2)
    const nl=Math.sqrt(nx*nx+ny*ny)||1
    return[nx/nl,ny/nl] as [number,number]
  })
}

// Lofted cavity void. Floor is exact profile (smallest). Void expands going up:
//   floor → main body via sin curve, then flares at the opening via sin curve.
// Each ring is the same polygon offset along vertex normals → consistent M,
// enabling clean quad-strip triangulation between rings.
function buildCavityVoid(pts:[number,number][], floorZ:number, topZ:number): any {
  const {Manifold,Mesh}=getManifold()
  const nrm=outwardNormals(pts)
  const M=pts.length

  // Two quarter-circle orientations:
  //   qcA: centre at (0,R) — slow start, fast end  — used for top (smooth main-body join, flares at rim)
  //   qcB: centre at (R,0) — fast start, slow end  — used for bottom (expands immediately at floor, smooth main-body join)
  const qcA=(R:number,t:number)=>R*(1-Math.sqrt(Math.max(0,1-t*t)))
  const qcB=(R:number,t:number)=>R*Math.sqrt(Math.max(0,2*t-t*t))
  const lvls:[number,number][]=[]
  for(let i=0;i<=N_CH;i++){
    const t=i/N_CH
    lvls.push([floorZ+t*DRAFT_R, qcB(DRAFT_R,t)])
  }
  lvls.push([topZ-TOP_R, DRAFT_R])
  for(let i=0;i<=N_CH;i++){
    const t=i/N_CH
    lvls.push([topZ-TOP_R+t*TOP_R, DRAFT_R+qcA(TOP_R,t)])
  }
  // Deduplicate consecutive duplicate z values
  const ls:[number,number][]=[lvls[0]]
  for(const l of lvls.slice(1)) if(Math.abs(l[0]-ls[ls.length-1][0])>1e-4) ls.push(l)
  const NL=ls.length

  // Vertices: NL rings of M verts + 2 cap centres
  const verts=new Float32Array((NL*M+2)*3)
  for(let i=0;i<NL;i++){
    const[z,r]=ls[i]
    for(let j=0;j<M;j++){
      const vi=(i*M+j)*3
      verts[vi  ]=pts[j][0]+r*nrm[j][0]
      verts[vi+1]=pts[j][1]+r*nrm[j][1]
      verts[vi+2]=z
    }
  }
  // Cap centres at (0,0) — centroid of symmetric cavity ≈ origin
  const botC=NL*M, topC=botC+1
  verts[botC*3+2]=floorZ
  verts[topC*3+2]=topZ

  const tris:number[]=[]

  // Side quad-strip: two triangles per quad between adjacent rings
  for(let i=0;i<NL-1;i++){
    for(let j=0;j<M;j++){
      const j1=(j+1)%M
      const a=i*M+j, b=i*M+j1, c=(i+1)*M+j, d=(i+1)*M+j1
      tris.push(a,b,d, a,d,c)
    }
  }

  // Bottom cap: fan from botC — CW from +Z so normal faces −Z (outward)
  for(let j=0;j<M;j++) tris.push(botC,(j+1)%M,j)

  // Top cap: fan from topC — CCW from +Z so normal faces +Z (outward)
  const tr=(NL-1)*M
  for(let j=0;j<M;j++) tris.push(topC,tr+j,tr+(j+1)%M)

  const mesh=new Mesh({numProp:3,vertProperties:verts,triVerts:new Uint32Array(tris)})
  return new Manifold(mesh)
}

// ─── Model ────────────────────────────────────────────────────────────────────

export const attribution: Attribution[] = [...gridfinityAttribution]

export function info(stackable:boolean): string {
  const w=CELLS_X*42-2*0.25, d=CELLS_Y*42-2*0.25
  const height_units=stackable?STACKABLE_HEIGHT_UNITS:STANDALONE_HEIGHT_UNITS
  const h=height_units*HEIGHT_UNIT+(stackable?STACKING_LIP_H:0)
  return`${CELLS_X}×${CELLS_Y}, ${height_units}u — ${w} × ${d} × ${h} mm`
}

export function generate(p:{stackable:boolean;holes:BinHoleSettings}): GeomResult {
  const height_units=p.stackable?STACKABLE_HEIGHT_UNITS:STANDALONE_HEIGHT_UNITS
  const binParams={
    cells_x:CELLS_X,cells_y:CELLS_Y,height_units,
    stacking_lip:p.stackable,holes:p.holes,
    base_style:'flat' as const,dividers_x:0,dividers_y:0,label_style:'none' as const,
  }
  const binShell=buildBinManifold(binParams)
  const fill    =buildBinFillManifold(binParams)
  const pts     =buildCavityShape(CAVITY_W,CAVITY_D,CAVITY_SAG_X,CAVITY_SAG_Y,CAVITY_NOTCH_W,CAVITY_NOTCH_D)
  const floorZ  =BASE_H+FLOOR_THICK
  const topZ    =height_units*HEIGHT_UNIT
  const cavityVoid=buildCavityVoid(pts,floorZ,topZ)
  const bin=fill?binShell.add(fill.subtract(cavityVoid)):binShell
  const label='Stanley Stud Finder Bin'
  return{objects:[{label,parts:[{label,geom:manifoldToBufferGeometry(bin)}],settings:GRIDFINITY_BIN_SETTINGS}]}
}
