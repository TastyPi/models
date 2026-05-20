export const MODEL_SLUGS = [
  'wall-hook',
  'gridfinity-baseplate',
  'corner-radius-gauge',
  'gridfinity-bin',
  'magnet-test',
  'dymo-letratag',
] as const

export type ModelSlug = typeof MODEL_SLUGS[number]
