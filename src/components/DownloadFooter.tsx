import { Show, type JSX } from 'solid-js'
import styles from './DownloadFooter.module.css'

interface Props {
  label: string
  onStl?: () => void
  on3mf: () => void
  note?: string
}

export function DownloadFooter(props: Props): JSX.Element {
  return (
    <div>
      <p class={styles.label}>{props.label}</p>
      <div class={styles.row}>
        <Show when={props.onStl !== undefined}>
          <button onClick={props.onStl} class={styles.btn}>STL</button>
        </Show>
        <button onClick={props.on3mf} class={styles.btn}>3MF</button>
      </div>
      <Show when={props.note}>
        <p class={styles.note}>{props.note}</p>
      </Show>
    </div>
  )
}
