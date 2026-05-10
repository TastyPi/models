import { createEffect, createSignal, Show } from 'solid-js'

interface Props {
  label: string
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
  step?: number
  description?: string
}

export function NumberSlider(props: Props) {
  return (
    <div>
      <label style={{ display: 'flex', 'justify-content': 'space-between', 'align-items': 'center', 'margin-bottom': '4px' }}>
        <span style={{ 'font-size': '0.8rem', color: '#aaa' }}>{props.label}</span>
        <span style={{ 'font-size': '0.8rem', color: '#fff' }}>{props.value}</span>
      </label>
      <input
        type="range"
        min={props.min}
        max={props.max}
        step={props.step ?? 1}
        value={props.value}
        onInput={(e) => props.onChange(parseFloat(e.currentTarget.value))}
        style={{ width: '100%', 'accent-color': '#6688cc' }}
      />
      <Show when={props.description}>
        <p style={{ margin: '3px 0 0', 'font-size': '0.72rem', color: '#555', 'line-height': '1.4' }}>{props.description}</p>
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
}

export function OptionalNumberSlider(props: OptionalProps) {
  const [lastValue, setLastValue] = createSignal<number>(props.value ?? props.min ?? 0)
  createEffect(() => { if (props.value !== null) setLastValue(props.value) })

  const enabled = () => props.value !== null
  const enable = () => props.onChange(lastValue())
  const disable = () => props.onChange(null)

  return (
    <div>
      <div style={{ display: 'flex', 'justify-content': 'space-between', 'align-items': 'center', 'margin-bottom': enabled() ? '4px' : '0' }}>
        <label style={{ display: 'flex', 'align-items': 'center', gap: '6px' }}>
          <span style={{ 'font-size': '0.8rem', color: '#aaa' }}>{props.label}</span>
          <input
            type="checkbox"
            checked={enabled()}
            onChange={(e) => e.currentTarget.checked ? enable() : disable()}
            style={{ 'accent-color': '#6688cc' }}
          />
        </label>
        <Show when={enabled()}>
          <span style={{ 'font-size': '0.8rem', color: '#fff' }}>{props.value}</span>
        </Show>
      </div>
      <Show when={enabled()}>
        <input
          type="range"
          min={props.min}
          max={props.max}
          step={props.step ?? 1}
          value={props.value as number}
          onInput={(e) => props.onChange(parseFloat(e.currentTarget.value))}
          style={{ width: '100%', 'accent-color': '#6688cc' }}
        />
      </Show>
      <Show when={props.description}>
        <p style={{ margin: '3px 0 0', 'font-size': '0.72rem', color: '#555', 'line-height': '1.4' }}>{props.description}</p>
      </Show>
    </div>
  )
}
