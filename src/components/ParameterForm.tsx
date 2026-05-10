import { For, Show, type JSX } from 'solid-js'
import type { DynNum, Parameter, ParameterGroup, SelectParameter } from '../types'

const evalDyn = (v: DynNum | undefined, vals: Record<string, number | boolean | string>) =>
  typeof v === 'function' ? v(vals) : v

interface Props {
  parameters: Record<string, Parameter>
  values: Record<string, number | boolean | string>
  groups?: ParameterGroup[]
  defaults: Record<string, number | boolean | string>
  onChange: (key: string, value: number | boolean | string) => void
}

function ParamField(props: {
  name: string
  param: Parameter
  value: number | boolean | string
  values: Record<string, number | boolean | string>
  effectiveDefault: number | boolean | string
  onChange: (v: number | boolean | string) => void
}) {
  const isDefault = () => props.value === props.effectiveDefault
  const resetBtn = (
    <button
      onClick={() => props.onChange(props.effectiveDefault)}
      disabled={isDefault()}
      title="Reset to default"
      style={{
        background: 'none', border: 'none', padding: '0',
        cursor: isDefault() ? 'default' : 'pointer',
        color: isDefault() ? '#444' : '#6688cc',
        'font-size': '0.75rem', 'line-height': '1',
      }}
    >↺</button>
  )

  return (
    <div>
      <label style={{ display: 'flex', 'justify-content': 'space-between', 'align-items': 'center', 'margin-bottom': props.param.type === 'boolean' ? '0' : '4px' }}>
        <span style={{ 'font-size': '0.8rem', color: '#aaa' }}>{props.param.label ?? props.name}</span>
        <span style={{ display: 'flex', gap: '6px', 'align-items': 'center' }}>
          {props.param.type === 'number' && (
            <span style={{ 'font-size': '0.8rem', color: '#fff' }}>{props.value}</span>
          )}
          {props.param.type === 'boolean' && (
            <input
              type="checkbox"
              checked={props.value as boolean}
              onChange={(e) => props.onChange(e.currentTarget.checked)}
              style={{ 'accent-color': '#6688cc' }}
            />
          )}
          {resetBtn}
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
      {props.param.type === 'select' && (
        <select
          value={props.value as string}
          onChange={(e) => props.onChange(e.currentTarget.value)}
          style={{
            width: '100%', background: '#1a1a2e', color: '#e0e0e0',
            border: '1px solid #333', 'border-radius': '4px',
            padding: '5px 8px', 'font-size': '0.8rem', cursor: 'pointer',
          }}
        >
          <For each={(props.param as SelectParameter).options}>
            {(opt) => <option value={opt.value}>{opt.label}</option>}
          </For>
        </select>
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
  const renderParam = (key: string): JSX.Element => {
    const param = props.parameters[key]
    if (!param) return null
    const field = (
      <ParamField
        name={key}
        param={param}
        value={props.values[key]}
        values={props.values}
        effectiveDefault={param.resetValue ? param.resetValue(props.values) : props.defaults[key]}
        onChange={(v) => props.onChange(key, v)}
      />
    )
    if (!param.visible) return field
    return <Show when={param.visible(props.values)}>{field}</Show>
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
