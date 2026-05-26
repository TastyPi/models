import { createEffect, Show, useContext } from 'solid-js'
import { UrlSyncContext } from '../hooks/urlSync'
import styles from './BooleanField.module.css'

interface Props {
  label: string
  value: boolean
  onChange: (v: boolean) => void
  description?: string
  default?: boolean | null
  urlKey?: string
}

export function BooleanField(props: Props) {
  const setUrl = useContext(UrlSyncContext)

  const checked = () => props.value

  createEffect(() => {
    if (!props.urlKey || !setUrl) return
    const atDefault = props.default != null && props.value === props.default
    setUrl(props.urlKey, atDefault ? null : String(props.value))
  })

  return (
    <div>
      <label class={styles.label}>
        <span class={styles.labelText}>{props.label}</span>
        <span class={styles.right}>
          <input
            type="checkbox"
            checked={checked()}
            onChange={(e) => props.onChange(e.currentTarget.checked)}
            class={styles.checkbox}
          />
          <Show when={props.default != null}>
            <button disabled={props.value === props.default} onClick={() => props.onChange(props.default!)} title="Reset to default" class={styles.resetBtn}>↺</button>
          </Show>
        </span>
      </label>
      <Show when={props.description}>
        <p class={styles.description}>{props.description}</p>
      </Show>
    </div>
  )
}
