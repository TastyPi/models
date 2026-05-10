import { Show } from 'solid-js'

interface Props {
  label: string
  value: boolean
  onChange: (v: boolean) => void
  description?: string
}

export function BooleanField(props: Props) {
  return (
    <div>
      <label style={{ display: 'flex', 'justify-content': 'space-between', 'align-items': 'center' }}>
        <span style={{ 'font-size': '0.8rem', color: '#aaa' }}>{props.label}</span>
        <input
          type="checkbox"
          checked={props.value}
          onChange={(e) => props.onChange(e.currentTarget.checked)}
          style={{ 'accent-color': '#6688cc' }}
        />
      </label>
      <Show when={props.description}>
        <p style={{ margin: '3px 0 0', 'font-size': '0.72rem', color: '#555', 'line-height': '1.4' }}>{props.description}</p>
      </Show>
    </div>
  )
}
