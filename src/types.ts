export type RawMesh = { vertProperties: Float32Array; triVerts: Uint32Array; numProp: number }

export type DynNum = number | ((values: Record<string, number | boolean | string>) => number)

export type NumberParameter = {
  type: 'number'
  min?: DynNum
  max?: DynNum
  step?: number
  label?: string
  description?: string
  visible?: (values: Record<string, number | boolean | string>) => boolean
  resetValue?: (values: Record<string, number | boolean | string>) => number
  localStorage?: boolean
}

export type BooleanParameter = {
  type: 'boolean'
  label?: string
  description?: string
  visible?: (values: Record<string, number | boolean | string>) => boolean
  resetValue?: (values: Record<string, number | boolean | string>) => boolean
  localStorage?: boolean
}

export type SelectParameter = {
  type: 'select'
  options: { value: string; label: string }[]
  label?: string
  description?: string
  visible?: (values: Record<string, number | boolean | string>) => boolean
  resetValue?: (values: Record<string, number | boolean | string>) => string
  localStorage?: boolean
}

export type Parameter = NumberParameter | BooleanParameter | SelectParameter

export type ParameterGroup = {
  label: string
  keys: string[]
  defaultOpen?: boolean
}

export type InferParamValues<T extends Record<string, Parameter>> = {
  [K in keyof T]: T[K] extends { type: 'number' } ? number : T[K] extends { type: 'boolean' } ? boolean : string
}

export type Preset = {
  label: string
  values: Record<string, number | boolean | string>
}

// A list of named presets (shows a selector) or a single set of default values (no selector).
export type Presets = Preset[] | Record<string, number | boolean | string>

export type Attribution = {
  name: string
  author: string
  url: string
  license: string
}

export type ModelEntry = {
  slug: string
  model: ModelDefinition
  label?: string
}

export type ModelGroup = {
  slug: string
  label: string
  description?: string
  entries: ModelEntry[]
}

export type ModelDefinition = {
  name: string
  description?: string
  attribution?: Attribution[]
  parameters: Record<string, Parameter>
  groups?: ParameterGroup[]
  presets: Presets
  info?: (params: Record<string, number | boolean | string>) => string
  generate: (params: Record<string, number | boolean | string>) => unknown
  exportTransform?: (params: Record<string, number | boolean | string>, geom: unknown) => unknown
}

export function defineModel<T extends Record<string, Parameter>>(def: {
  name: string
  description?: string
  attribution?: Attribution[]
  parameters: T
  groups?: ParameterGroup[]
  presets: Presets
  info?: (params: InferParamValues<T>) => string
  generate: (params: InferParamValues<T>) => unknown
  exportTransform?: (params: InferParamValues<T>, geom: unknown) => unknown
}): ModelDefinition {
  return def as unknown as ModelDefinition
}
