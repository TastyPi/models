import wallHook from './wall-hook'
import type { ModelDefinition } from '../types'

export type ModelEntry = { slug: string; model: ModelDefinition }

export const models: ModelEntry[] = [
  { slug: 'wall-hook', model: wallHook },
]

export function findModel(slug: string): ModelEntry | undefined {
  return models.find((e) => e.slug === slug)
}
