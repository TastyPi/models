export type DynNum = number | ((values: Record<string, number | boolean>) => number)

export type NumberParameter = {
  type: 'number'
  default: number
  min?: DynNum
  max?: DynNum
  step?: number
  label?: string
  description?: string
  visible?: (values: Record<string, number | boolean>) => boolean
}

export type BooleanParameter = {
  type: 'boolean'
  default: boolean
  label?: string
  description?: string
  visible?: (values: Record<string, number | boolean>) => boolean
}

export type Parameter = NumberParameter | BooleanParameter

export type ParameterGroup = {
  label: string
  keys: string[]
  defaultOpen?: boolean
}

export type InferParamValues<T extends Record<string, Parameter>> = {
  [K in keyof T]: T[K] extends { type: 'number' } ? number : boolean
}

export type ModelDefinition = {
  name: string
  description?: string
  parameters: Record<string, Parameter>
  groups?: ParameterGroup[]
  generate: (params: Record<string, number | boolean>) => unknown
  exportTransform?: (params: Record<string, number | boolean>, geom: unknown) => unknown
}

export function defineModel<T extends Record<string, Parameter>>(def: {
  name: string
  description?: string
  parameters: T
  groups?: ParameterGroup[]
  generate: (params: InferParamValues<T>) => unknown
  exportTransform?: (params: InferParamValues<T>, geom: unknown) => unknown
}): ModelDefinition {
  return def as unknown as ModelDefinition
}
