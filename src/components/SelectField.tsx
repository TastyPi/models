import { For, Show } from 'solid-js'

interface Props {
  label?: string
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
  description?: string
}

export function SelectField(props: Props) {
  return (
    <div>
      <Show when={props.label}>
        <label style={{ display: 'block', 'font-size': '0.8rem', color: '#aaa', 'margin-bottom': '4px' }}>{props.label}</label>
      </Show>
      <select
        value={props.value}
        onChange={(e) => props.onChange(e.currentTarget.value)}
        style={{
          width: '100%', background: '#1a1a2e', color: '#e0e0e0',
          border: '1px solid #333', 'border-radius': '4px',
          padding: '5px 8px', 'font-size': '0.8rem', cursor: 'pointer',
        }}
      >
        <For each={props.options}>
          {(opt) => <option value={opt.value}>{opt.label}</option>}
        </For>
      </select>
      <Show when={props.description}>
        <p style={{ margin: '3px 0 0', 'font-size': '0.72rem', color: '#555', 'line-height': '1.4' }}>{props.description}</p>
      </Show>
    </div>
  )
}
