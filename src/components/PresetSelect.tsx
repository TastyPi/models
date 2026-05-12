import { For } from 'solid-js'
import styles from './PresetSelect.module.css'

interface Props {
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
  dirty: boolean
  onResetAll: () => void
}

export function PresetSelect(props: Props) {
  return (
    <div>
      <div class={styles.row}>
        <div class={styles.label}>Preset</div>
        <button
          onClick={props.onResetAll}
          classList={{ [styles.resetBtn]: true, [styles.hidden]: !props.dirty }}
        >Reset all</button>
      </div>
      <select value={props.value} onChange={(e) => props.onChange(e.currentTarget.value)} class={styles.select}>
        <option value="none">No preset</option>
        <For each={props.options}>
          {(opt) => <option value={opt.value}>{opt.label}</option>}
        </For>
      </select>
    </div>
  )
}
