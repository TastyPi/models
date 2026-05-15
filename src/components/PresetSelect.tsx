import { createMemo, For, Show } from 'solid-js'
import styles from './PresetSelect.module.css'

interface PresetOption {
  value: string
  label: string
  link?: string
}

interface Props {
  value: string
  onChange: (v: string) => void
  options: PresetOption[]
  dirty: boolean
  onResetAll: () => void
}

function PrintablesIcon() {
  return (
    <svg viewBox="0 0 512 512" width="18" height="18" aria-label="Printables">
      <path d="M77.9 512 256 409.6 77.9 307.2zM256 0 77.9 102.4 256 204.8v204.8l178.1-102.4V102.4z" fill="#e27546"/>
    </svg>
  )
}

export function PresetSelect(props: Props) {
  const activeLink = createMemo(() =>
    props.options.find(o => o.value === props.value)?.link
  )

  return (
    <div>
      <div class={styles.row}>
        <div class={styles.label}>Preset</div>
        <button
          onClick={props.onResetAll}
          classList={{ [styles.resetBtn]: true, [styles.hidden]: !props.dirty }}
        >Reset all</button>
      </div>
      <div class={styles.selectRow}>
        <select value={props.value} onChange={(e) => props.onChange(e.currentTarget.value)} class={styles.select}>
          <option value="none">No preset</option>
          <For each={props.options}>
            {(opt) => <option value={opt.value}>{opt.label}</option>}
          </For>
        </select>
        <Show when={activeLink()}>
          {(link) => (
            <a href={link()} target="_blank" rel="noopener noreferrer" class={styles.printablesLink}>
              <PrintablesIcon />
            </a>
          )}
        </Show>
      </div>
    </div>
  )
}
