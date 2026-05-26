import styles from './PoleSocketMeasureTooltip.module.css'

export type MeasureKey = 'outer_diameter' | 'root_diameter' | 'pitch' | 'ridge_root' | 'ridge_peak' | 'thread_length'

const H = '#88aaff'
const FILL = '#1e2540'
const STROKE = '#3a4a6a'

// Shaft geometry (SVG units)
const SL = 22, SR = 198       // shaft left / right x
const RT = 38, RB = 87        // root-diameter top / bottom y
const PT = 24, PB = 101       // outer-diameter (peak) top / bottom y

// Top ridges: R1 center x=78, pitch=56 → R2 center x=134
const R1C = 78,  R2C = 134
const R1RL = 64, R1RR = 92    // ridge 1 root left / right x
const R1PL = 70, R1PR = 86    // ridge 1 peak left / right x
const R2RL = 120, R2RR = 148
const R2PL = 126, R2PR = 142

// Bottom ridges: staggered by half pitch (28px) for realistic appearance
const HALF = (R2C - R1C) / 2
const BR1RL = R1RL + HALF, BR1RR = R1RR + HALF
const BR1PL = R1PL + HALF, BR1PR = R1PR + HALF
const BR2RL = R2RL + HALF, BR2RR = R2RR + HALF
const BR2PL = R2PL + HALF, BR2PR = R2PR + HALF

// Annotation rails
const ANN_TOP = 12   // above shaft: pitch, ridge_peak, thread_length
const ANN_BOT = 110  // below shaft: ridge_root

// Dimension line: main line + perpendicular tick at each end
function dim(x1: number, y1: number, x2: number, y2: number) {
  const dx = x2 - x1, dy = y2 - y1
  const len = Math.hypot(dx, dy)
  const nx = -dy / len * 6, ny = dx / len * 6
  return (
    <>
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={H} stroke-width="1.5" stroke-linecap="round"/>
      <line x1={x1 - nx} y1={y1 - ny} x2={x1 + nx} y2={y1 + ny} stroke={H} stroke-width="1.5" stroke-linecap="round"/>
      <line x1={x2 - nx} y1={y2 - ny} x2={x2 + nx} y2={y2 + ny} stroke={H} stroke-width="1.5" stroke-linecap="round"/>
    </>
  )
}

// Dashed vertical leader line
function vl(x: number, y1: number, y2: number) {
  return <line x1={x} y1={y1} x2={x} y2={y2} stroke={H} stroke-width="0.8" stroke-dasharray="2,2"/>
}

function ScrewDiagram(props: { measure: MeasureKey }) {
  const m = props.measure

  // Closed polygon: top profile (L→R) + right edge + bottom profile (R→L) + Z
  const path = [
    `M ${SL},${RT}`,
    `L ${R1RL},${RT}`, `L ${R1PL},${PT}`, `L ${R1PR},${PT}`, `L ${R1RR},${RT}`,
    `L ${R2RL},${RT}`, `L ${R2PL},${PT}`, `L ${R2PR},${PT}`, `L ${R2RR},${RT}`,
    `L ${SR},${RT}`, `L ${SR},${RB}`,
    `L ${BR2RR},${RB}`, `L ${BR2PR},${PB}`, `L ${BR2PL},${PB}`, `L ${BR2RL},${RB}`,
    `L ${BR1RR},${RB}`, `L ${BR1PR},${PB}`, `L ${BR1PL},${PB}`, `L ${BR1RL},${RB}`,
    `L ${SL},${RB}`, 'Z',
  ].join(' ')

  return (
    <svg viewBox="0 0 220 118" width="220" height="118" xmlns="http://www.w3.org/2000/svg" class={styles.svg}>
      <path d={path} fill={FILL} stroke={STROKE} stroke-width="1"/>

      {/* outer_diameter: vertical dim through ridge 1 peak-top to peak-bottom */}
      {m === 'outer_diameter' && dim(R1C, PT, R1C, PB)}

      {/* root_diameter: vertical dim through ridge 1 root-top to root-bottom */}
      {m === 'root_diameter' && dim(R1C, RT, R1C, RB)}

      {/* pitch: leaders up from ridge peak centres, dim above */}
      {m === 'pitch' && <>
        {vl(R1C, PT, ANN_TOP)} {vl(R2C, PT, ANN_TOP)}
        {dim(R1C, ANN_TOP, R2C, ANN_TOP)}
      </>}

      {/* ridge_peak: leaders up from ridge 1 peak edges, dim above */}
      {m === 'ridge_peak' && <>
        {vl(R1PL, PT, ANN_TOP)} {vl(R1PR, PT, ANN_TOP)}
        {dim(R1PL, ANN_TOP, R1PR, ANN_TOP)}
      </>}

      {/* ridge_root: leaders down from bottom ridge 1 root edges, dim below */}
      {m === 'ridge_root' && <>
        {vl(BR1RL, RB, ANN_BOT)} {vl(BR1RR, RB, ANN_BOT)}
        {dim(BR1RL, ANN_BOT, BR1RR, ANN_BOT)}
      </>}

      {/* thread_length: leaders up from shaft ends, dim above */}
      {m === 'thread_length' && <>
        {vl(SL, PT, ANN_TOP)} {vl(SR, PT, ANN_TOP)}
        {dim(SL, ANN_TOP, SR, ANN_TOP)}
      </>}
    </svg>
  )
}

export function PoleSocketMeasureTooltip(props: { measure: MeasureKey }) {
  let tooltipRef!: HTMLDivElement

  function position(e: MouseEvent) {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    tooltipRef.style.left = `${rect.right + 8}px`
    tooltipRef.style.top = `${rect.top + rect.height / 2}px`
  }

  return (
    <div class={styles.wrapper} onMouseEnter={position}>
      <span class={`material-icons ${styles.icon}`}>info_outline</span>
      <div class={styles.tooltip} ref={tooltipRef}>
        <ScrewDiagram measure={props.measure} />
      </div>
    </div>
  )
}
