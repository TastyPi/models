// Wood screw head dimensions follow the common metric standard (DIN 7505-equivalent,
// 90° countersink, head ≈ 2× shaft). Machine screw dimensions per ISO 10642.
const PRESETS: Record<string, { shaft: number; head: number }> = {
  'wood3':   { shaft: 3.0, head: 6.0 },
  'wood3.5': { shaft: 3.5, head: 7.0 },
  'wood4':   { shaft: 4.0, head: 8.0 },
  'wood5':   { shaft: 5.0, head: 10.0 },
  'wood6':   { shaft: 6.0, head: 12.0 },
  'm3':      { shaft: 3.0, head: 6.72 },
  'm4':      { shaft: 4.0, head: 8.96 },
  'm5':      { shaft: 5.0, head: 11.20 },
  'm6':      { shaft: 6.0, head: 13.44 },
}

export const SCREW_OPTIONS = [
  { value: 'wood3',   label: '3mm Wood Screw' },
  { value: 'wood3.5', label: '3.5mm Wood Screw' },
  { value: 'wood4',   label: '4mm Wood Screw' },
  { value: 'wood5',   label: '5mm Wood Screw' },
  { value: 'wood6',   label: '6mm Wood Screw' },
  { value: 'm3',      label: 'M3 Machine Screw' },
  { value: 'm4',      label: 'M4 Machine Screw' },
  { value: 'm5',      label: 'M5 Machine Screw' },
  { value: 'm6',      label: 'M6 Machine Screw' },
  { value: 'custom',  label: 'Custom' },
]

export const DRIVER_OPTIONS = [
  { value: 'ltt',    label: 'LTT Screwdriver (10 mm)' },
  { value: 'custom', label: 'Custom' },
]

export function resolveScrew(screwType: string, screwShaft: number, screwHead: number) {
  if (screwType === 'custom') return { shaft: screwShaft, head: screwHead }
  return PRESETS[screwType] ?? PRESETS['wood4']
}

export function resolveDriverDiameter(driverType: string, driverDiameter: number): number {
  if (driverType === 'ltt') return 10
  return driverDiameter
}
