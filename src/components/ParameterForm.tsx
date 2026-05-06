import { For, Show, createEffect } from 'solid-js'
import type { DynNum, Parameter, ParameterGroup } from '../types'

const evalDyn = (v: DynNum | undefined, vals: Record<string, number | boolean>) =>
  typeof v === 'function' ? v(vals) : v

interface Props {
  parameters: Record<string, Parameter>
  values: Record<string, number | boolean>
  groups?: ParameterGroup[]
  onChange: (key: string, value: number | boolean) => void
}

function ParamField(props: {
  name: string
  param: Parameter
  value: number | boolean
  values: Record<string, number | boolean>
  onChange: (v: number | boolean) => void
}) {
  const isDefault = () => props.value === props.param.default
  return (
    <div>
      <label style={{ display: 'flex', 'justify-content': 'space-between', 'align-items': 'baseline', 'margin-bottom': '4px' }}>
        <span style={{ 'font-size': '0.8rem', color: '#aaa' }}>{props.param.label ?? props.name}</span>
        <span style={{ display: 'flex', gap: '6px', 'align-items': 'center' }}>
          {props.param.type === 'number' && (
            <span style={{ 'font-size': '0.8rem', color: '#fff' }}>{props.value}</span>
          )}
          <button
            onClick={() => props.onChange(props.param.default)}
            disabled={isDefault()}
            title="Reset to default"
            style={{
              background: 'none', border: 'none', padding: '0',
              cursor: isDefault() ? 'default' : 'pointer',
              color: isDefault() ? '#444' : '#6688cc',
              'font-size': '0.75rem', 'line-height': '1',
            }}
          >↺</button>
        </span>
      </label>
      {props.param.type === 'number' && (
        <input
          type="range"
          min={evalDyn(props.param.min, props.values)}
          max={evalDyn(props.param.max, props.values)}
          step={props.param.step ?? 1}
          value={props.value as number}
          onInput={(e) => props.onChange(parseFloat(e.currentTarget.value))}
          style={{ width: '100%', 'accent-color': '#6688cc' }}
        />
      )}
      {props.param.type === 'boolean' && (
        <input
          type="checkbox"
          checked={props.value as boolean}
          onChange={(e) => props.onChange(e.currentTarget.checked)}
          style={{ 'accent-color': '#6688cc' }}
        />
      )}
      {props.param.description && (
        <p style={{ margin: '3px 0 0', 'font-size': '0.72rem', color: '#555', 'line-height': '1.4' }}>
          {props.param.description}
        </p>
      )}
    </div>
  )
}

export function ParameterForm(props: Props) {
  createEffect(() => {
    for (const [key, param] of Object.entries(props.parameters)) {
      if (param.type !== 'number') continue
      const val = props.values[key] as number
      const lo = evalDyn(param.min, props.values) ?? -Infinity
      const hi = evalDyn(param.max, props.values) ?? Infinity
      const clamped = Math.min(Math.max(val, lo), hi)
      if (clamped !== val) props.onChange(key, clamped)
    }
  })

  const renderParam = (key: string) => {
    const param = props.parameters[key]
    if (!param) return null
    if (param.visible && !param.visible(props.values)) return null
    return (
      <ParamField
        name={key}
        param={param}
        value={props.values[key]}
        values={props.values}
        onChange={(v) => props.onChange(key, v)}
      />
    )
  }

  return (
    <div style={{ display: 'flex', 'flex-direction': 'column', gap: '4px' }}>
      <Show
        when={props.groups}
        fallback={
          <div style={{ display: 'flex', 'flex-direction': 'column', gap: '12px' }}>
            <For each={Object.keys(props.parameters)}>{renderParam}</For>
          </div>
        }
      >
        <For each={props.groups}>
          {(group) => (
            <details open={group.defaultOpen ?? true} style={{ 'border-bottom': '1px solid #222' }}>
              <summary style={{
                padding: '8px 0', cursor: 'pointer', 'font-size': '0.75rem',
                'text-transform': 'uppercase', 'letter-spacing': '0.08em',
                color: '#666', 'list-style': 'none', display: 'flex',
                'justify-content': 'space-between', 'align-items': 'center',
                'user-select': 'none',
              }}>
                {group.label}
                <span style={{ 'font-size': '0.6rem' }}>▾</span>
              </summary>
              <div style={{ display: 'flex', 'flex-direction': 'column', gap: '12px', padding: '4px 0 12px' }}>
                <For each={group.keys}>{renderParam}</For>
              </div>
            </details>
          )}
        </For>
      </Show>
    </div>
  )
}
