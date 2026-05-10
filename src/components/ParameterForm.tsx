import { For, Show, createSignal, createEffect, type JSX } from 'solid-js'
import type { DynNum, NumberParameter, Parameter, ParameterGroup, SelectParameter } from '../types'

const evalDyn = (v: DynNum | undefined, vals: Record<string, number | boolean | string>) =>
  typeof v === 'function' ? v(vals) : v

const GS_KEY = 'group-open'
function loadGroupOpen(): Record<string, boolean> {
  try { return JSON.parse(localStorage.getItem(GS_KEY) ?? '{}') } catch { return {} }
}
function saveGroupOpen(label: string, open: boolean) {
  try {
    const stored = loadGroupOpen()
    localStorage.setItem(GS_KEY, JSON.stringify({ ...stored, [label]: open }))
  } catch {}
}

function GroupSection(props: { group: ParameterGroup; children: JSX.Element }) {
  const stored = loadGroupOpen()
  const [isOpen, setIsOpen] = createSignal(
    props.group.label in stored ? stored[props.group.label] : (props.group.defaultOpen ?? true)
  )
  const toggle = () => { const next = !isOpen(); setIsOpen(next); saveGroupOpen(props.group.label, next) }
  return (
    <div style={{ 'border-bottom': '1px solid #222' }}>
      <div
        onClick={toggle}
        style={{
          padding: '8px 0', cursor: 'pointer', 'font-size': '0.75rem',
          'text-transform': 'uppercase', 'letter-spacing': '0.08em',
          color: '#666', display: 'flex', 'justify-content': 'space-between',
          'align-items': 'center', 'user-select': 'none',
        }}
      >
        {props.group.label}
        <span class="material-icons" style={{ 'font-size': '1.1rem', color: '#555' }}>
          {isOpen() ? 'expand_more' : 'chevron_right'}
        </span>
      </div>
      <Show when={isOpen()}>
        <div style={{ display: 'flex', 'flex-direction': 'column', gap: '12px', padding: '4px 0 12px' }}>
          {props.children}
        </div>
      </Show>
    </div>
  )
}

interface Props {
  parameters: Record<string, Parameter>
  values: Record<string, number | boolean | string | null>
  groups?: ParameterGroup[]
  defaults: Record<string, number | boolean | string | null>
  onChange: (key: string, value: number | boolean | string | null) => void
}

function ParamField(props: {
  name: string
  param: Parameter
  value: number | boolean | string | null
  values: Record<string, number | boolean | string | null>
  effectiveDefault: number | boolean | string | null
  onChange: (v: number | boolean | string | null) => void
}) {
  const isOptional = () => props.param.type === 'number' && !!(props.param as NumberParameter).optional
  const isEnabled = () => !isOptional() || props.value !== null

  // Remember last non-null number so re-enabling restores the previous value
  const [lastNumber, setLastNumber] = createSignal<number | null>(
    props.param.type === 'number' && props.value !== null ? props.value as number : null
  )
  createEffect(() => {
    const v = props.value
    if (v !== null && props.param.type === 'number') setLastNumber(v as number)
  })

  const safeVals = () => props.values as Record<string, number | boolean | string>

  const enableParam = () => {
    const lo = evalDyn((props.param as NumberParameter).min, safeVals()) ?? 0
    props.onChange(lastNumber() ?? lo)
  }
  const disableParam = () => props.onChange(null)

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
      <Show
        when={isOptional()}
        fallback={
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
              {!props.param.localStorage && resetBtn}
            </span>
          </label>
        }
      >
        <div style={{ display: 'flex', 'justify-content': 'space-between', 'align-items': 'center', 'margin-bottom': isEnabled() ? '4px' : '0' }}>
          <span style={{ display: 'flex', gap: '6px', 'align-items': 'center' }}>
            <span style={{ 'font-size': '0.8rem', color: '#aaa' }}>
              {props.param.label ?? props.name}
            </span>
            <input
              type="checkbox"
              checked={isEnabled()}
              onChange={(e) => e.currentTarget.checked ? enableParam() : disableParam()}
              style={{ 'accent-color': '#6688cc' }}
            />
          </span>
          <span style={{ display: 'flex', gap: '6px', 'align-items': 'center' }}>
            <Show when={isEnabled()}>
              <span style={{ 'font-size': '0.8rem', color: '#fff' }}>{props.value}</span>
            </Show>
            {!props.param.localStorage && resetBtn}
          </span>
        </div>
      </Show>
      {props.param.type === 'number' && isEnabled() && (
        <input
          type="range"
          min={evalDyn(props.param.min, safeVals())}
          max={evalDyn(props.param.max, safeVals())}
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
        effectiveDefault={param.resetValue ? param.resetValue(props.values as Record<string, number | boolean | string>) : props.defaults[key]}
        onChange={(v) => props.onChange(key, v)}
      />
    )
    if (!param.visible) return field
    return <Show when={param.visible(props.values as Record<string, number | boolean | string>)}>{field}</Show>
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
            <GroupSection group={group}>
              <For each={group.keys}>{renderParam}</For>
            </GroupSection>
          )}
        </For>
      </Show>
    </div>
  )
}
