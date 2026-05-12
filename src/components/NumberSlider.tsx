import { createEffect, createSignal, Show, useContext } from 'solid-js'
import { UrlSyncContext } from '../hooks/urlSync'
import styles from './NumberSlider.module.css'

interface Props {
  label: string
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
  step?: number
  description?: string
  default?: number | null
  urlKey?: string
}

export function NumberSlider(props: Props) {
  const setUrl = useContext(UrlSyncContext)
  createEffect(() => {
    if (!props.urlKey || !setUrl) return
    const atDefault = props.default != null && props.value === props.default
    setUrl(props.urlKey, atDefault ? null : String(props.value))
  })

  return (
    <div>
      <label class={styles.label}>
        <span class={styles.labelText}>{props.label}</span>
        <span class={styles.labelRight}>
          <span class={styles.value}>{props.value}</span>
          <Show when={props.default != null}>
            <button disabled={props.value === props.default} onClick={() => props.onChange(props.default!)} title="Reset to default" class={styles.resetBtn}>↺</button>
          </Show>
        </span>
      </label>
      <input
        type="range"
        min={props.min}
        max={props.max}
        step={props.step ?? 1}
        value={props.value}
        onInput={(e) => props.onChange(parseFloat(e.currentTarget.value))}
        class={styles.slider}
      />
      <Show when={props.description}>
        <p class={styles.description}>{props.description}</p>
      </Show>
    </div>
  )
}

interface OptionalProps {
  label: string
  value: number | null
  onChange: (v: number | null) => void
  min?: number
  max?: number
  step?: number
  description?: string
  default?: number | null
  urlKey?: string
}

export function OptionalNumberSlider(props: OptionalProps) {
  const setUrl = useContext(UrlSyncContext)
  createEffect(() => {
    if (!props.urlKey || !setUrl) return
    const atDefault = props.default !== undefined && props.value === props.default
    setUrl(props.urlKey, atDefault ? null : (props.value === null ? 'null' : String(props.value)))
  })

  const [lastValue, setLastValue] = createSignal<number>(props.value ?? props.min ?? 0)
  createEffect(() => { if (props.value !== null) setLastValue(props.value) })

  const enabled = () => props.value !== null
  const enable = () => props.onChange(lastValue())
  const disable = () => props.onChange(null)
  const isDefault = () => props.default === undefined || props.value === props.default

  return (
    <div>
      <div classList={{ [styles.optHeader]: true, [styles.optHeaderEnabled]: enabled() }}>
        <label class={styles.optLabel}>
          <span class={styles.labelText}>{props.label}</span>
          <input
            type="checkbox"
            checked={enabled()}
            onChange={(e) => e.currentTarget.checked ? enable() : disable()}
            class={styles.checkbox}
          />
        </label>
        <span class={styles.labelRight}>
          <Show when={enabled()}>
            <span class={styles.value}>{props.value}</span>
          </Show>
          <Show when={props.default !== undefined}>
            <button disabled={isDefault()} onClick={() => props.onChange(props.default as number | null)} title="Reset to default" class={styles.resetBtn}>↺</button>
          </Show>
        </span>
      </div>
      <Show when={enabled()}>
        <input
          type="range"
          min={props.min}
          max={props.max}
          step={props.step ?? 1}
          value={props.value as number}
          onInput={(e) => props.onChange(parseFloat(e.currentTarget.value))}
          class={styles.slider}
        />
      </Show>
      <Show when={props.description}>
        <p class={styles.description}>{props.description}</p>
      </Show>
    </div>
  )
}
