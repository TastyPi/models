import type { NumberParameter, SelectParameter } from './types'

export const driverParams = {
  driver_type: {
    type: 'select',
    label: 'Driver Diameter',
    options: [
      { value: 'ltt',    label: 'LTT Screwdriver (10 mm)' },
      { value: 'custom', label: 'Custom' },
    ],
  } satisfies SelectParameter,
  driver_diameter: {
    type: 'number',
    label: 'Driver Diameter (mm)',
    min: 5,
    max: 16,
    step: 0.5,
    visible: (v) => v.driver_type === 'custom',
    description: 'Bore diameter through side (c). Must be at least the screw head diameter.',
  } satisfies NumberParameter,
}

export function resolveDriverDiameter(v: Record<string, number | boolean | string>): number {
  if (v.driver_type === 'ltt') return 10
  return v.driver_diameter as number
}

export const screwParams = {
  screw_type: {
    type: 'select',
    label: 'Screw Type',
    options: [
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
    ],
  } satisfies SelectParameter,
  screw_shaft: {
    type: 'number',
    label: 'Shaft Diameter (mm)',
    min: 2,
    max: 12,
    step: 0.5,
    visible: (v) => v.screw_type === 'custom',
  } satisfies NumberParameter,
  screw_head: {
    type: 'number',
    label: 'Head Diameter (mm)',
    min: 4,
    max: 24,
    step: 0.5,
    visible: (v) => v.screw_type === 'custom',
  } satisfies NumberParameter,
}

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

export function resolveScrew(screwType: string, screwShaft: number, screwHead: number) {
  if (screwType === 'custom') return { shaft: screwShaft, head: screwHead }
  return PRESETS[screwType] ?? PRESETS['wood4']
}
