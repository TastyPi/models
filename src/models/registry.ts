export const MODEL_SLUGS = [
  'wall-hook',
  'gridfinity-baseplate',
  'corner-radius-gauge',
  'gridfinity-bin',
  'magnet-test',
  'dymo-letratag',
  'ltt-screwdriver-bin',
  'pole-socket',
  'aa-battery-bin',
  'elmers-glue-bin',
] as const

export type ModelSlug = typeof MODEL_SLUGS[number]
