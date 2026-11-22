export const MODEL_SLUGS = [
  'wall-hook',
  'gridfinity-baseplate',
  'corner-radius-gauge',
  'gridfinity-bin',
  'magnet-test',
  'dymo-letratag',
  'ltt-screwdriver-bin',
  'pole-socket',
  'battery-bin',
  'elmers-glue-bin',
  'battery-tester-bin',
  'stanley-stud-finder-bin',
  'rsc-x2-2-bin',
] as const

export type ModelSlug = typeof MODEL_SLUGS[number]
