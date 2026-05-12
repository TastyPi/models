import { createEffect, For, Show, useContext, type JSX } from 'solid-js'
import { UrlSyncContext } from '../hooks/urlSync'
import styles from './SelectField.module.css'

interface Props {
  label?: string
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
  description?: string
  default?: string | null
  urlKey?: string
  labelAction?: JSX.Element
}

export function SelectField(props: Props) {
  const setUrl = useContext(UrlSyncContext)
  createEffect(() => {
    if (!props.urlKey || !setUrl) return
    const atDefault = props.default != null && props.value === props.default
    setUrl(props.urlKey, atDefault ? null : props.value)
  })

  return (
    <div>
      <Show when={props.label}>
        <div class={styles.labelRow}>
          <label class={styles.labelText}>{props.label}</label>
          <div class={styles.labelRight}>
            {props.labelAction}
            <Show when={props.default != null}>
              <button disabled={props.value === props.default} onClick={() => props.onChange(props.default!)} title="Reset to default" class={styles.resetBtn}>↺</button>
            </Show>
          </div>
        </div>
      </Show>
      <select value={props.value} onChange={(e) => props.onChange(e.currentTarget.value)} class={styles.select}>
        <For each={props.options}>
          {(opt) => <option value={opt.value}>{opt.label}</option>}
        </For>
      </select>
      <Show when={props.description}>
        <p class={styles.description}>{props.description}</p>
      </Show>
    </div>
  )
}
