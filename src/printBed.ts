const BED_SIZES: Record<string, { x: number; y: number }> = {
  prusa_core_one:   { x: 250, y: 220 },
  prusa_core_one_l: { x: 300, y: 300 },
  prusa_mk4:      { x: 250, y: 210 },
  prusa_mk3s:     { x: 250, y: 210 },
  bambu_p1:       { x: 256, y: 256 },
  bambu_a1:       { x: 256, y: 256 },
  bambu_a1_mini:  { x: 180, y: 180 },
  ender3:         { x: 220, y: 220 },
}

export const BED_OPTIONS = [
  { value: 'prusa_core_one',   label: 'Prusa Core One' },
  { value: 'prusa_core_one_l', label: 'Prusa Core One L' },
  { value: 'prusa_mk4',      label: 'Prusa MK4' },
  { value: 'prusa_mk3s',     label: 'Prusa MK3S+' },
  { value: 'bambu_p1',       label: 'Bambu P1S / X1C' },
  { value: 'bambu_a1',       label: 'Bambu A1' },
  { value: 'bambu_a1_mini',  label: 'Bambu A1 Mini' },
  { value: 'ender3',         label: 'Creality Ender 3' },
  { value: 'custom',         label: 'Custom' },
]

export function resolveBed(bedType: string, bedX: number, bedY: number): { x: number; y: number } {
  if (bedType === 'custom') return { x: bedX, y: bedY }
  return BED_SIZES[bedType] ?? { x: 220, y: 220 }
}

// Split n cells into k pieces as evenly as possible (larger pieces first).
// e.g. splitSizes(13, 5) → [5, 4, 4]
export function splitSizes(n: number, maxPer: number): number[] {
  const k = Math.ceil(n / Math.max(1, maxPer))
  const base = Math.floor(n / k)
  const rem = n % k
  return Array.from({ length: k }, (_, i) => i < rem ? base + 1 : base)
}

// Split n cells maximising interior piece size (maxInterior), leaving edge pieces
// (which carry one wall each) to fill with whatever remains.
// bothMax = max cells when a single piece carries both walls (used for the 1-piece case).
export function splitMaxInterior(
  n: number, maxInterior: number,
  leftMax: number, rightMax: number, bothMax: number,
): number[] {
  if (n <= bothMax) return [n]

  const k = Math.max(0, Math.ceil((n - leftMax - rightMax) / maxInterior))
  const edgeCells = n - k * maxInterior

  if (edgeCells < 2) return splitSizes(n, Math.max(1, bothMax))

  const half = Math.ceil(edgeCells / 2)
  const lc = Math.max(edgeCells - rightMax, Math.min(leftMax, half))
  const rc = edgeCells - lc
  return [lc, ...Array(k).fill(maxInterior), rc]
}
