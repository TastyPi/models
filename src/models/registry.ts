import gridfinityBaseplate from './gridfinity-baseplate'
import cornerRadiusGauge from './corner-radius-gauge'
import type { ModelDefinition, ModelEntry, ModelGroup } from '../types'

export type { ModelEntry, ModelGroup }

export const groups: ModelGroup[] = [
  {
    slug: 'gridfinity-baseplate',
    label: 'Gridfinity Baseplate',
    entries: [
      { slug: 'gridfinity-baseplate', model: gridfinityBaseplate },
    ],
  },
  {
    slug: 'corner-radius-gauge',
    label: 'Corner Radius Gauge',
    entries: [
      { slug: 'corner-radius-gauge', model: cornerRadiusGauge },
    ],
  },
]

export const models: ModelEntry[] = groups.flatMap(g => g.entries)

export function findModel(slug: string): ModelEntry | undefined {
  return models.find((e) => e.slug === slug)
}

export function findGroupForModel(model: ModelDefinition): ModelGroup | undefined {
  return groups.find(g => g.entries.some(e => e.model === model))
}
