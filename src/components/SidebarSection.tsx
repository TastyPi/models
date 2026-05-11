import { createMemo, createSignal, Show, type JSX } from 'solid-js'

const GS_KEY = 'group-open'

function loadOpen(label: string, defaultOpen: boolean): boolean {
  try { return JSON.parse(localStorage.getItem(GS_KEY) ?? '{}')[label] ?? defaultOpen } catch { return defaultOpen }
}

function saveOpen(label: string, open: boolean) {
  try {
    const stored = JSON.parse(localStorage.getItem(GS_KEY) ?? '{}')
    localStorage.setItem(GS_KEY, JSON.stringify({ ...stored, [label]: open }))
  } catch {}
}

interface Props {
  label: string
  defaultOpen?: boolean
  checked?: () => boolean
  onCheckedChange?: (v: boolean) => void
  children: JSX.Element
}

export function SidebarSection(props: Props) {
  const [isOpen, setIsOpen] = createSignal(loadOpen(props.label, props.defaultOpen ?? true))
  const canExpand = createMemo(() => props.checked === undefined || props.checked())
  const effectiveOpen = createMemo(() => isOpen() && canExpand())

  const toggle = () => {
    if (!canExpand()) return
    const next = !isOpen()
    setIsOpen(next)
    saveOpen(props.label, next)
  }

  return (
    <div style={{ 'border-bottom': '1px solid #222' }}>
      <div
        onClick={toggle}
        style={{
          padding: '8px 0', cursor: canExpand() ? 'pointer' : 'default', 'font-size': '0.75rem',
          'text-transform': 'uppercase', 'letter-spacing': '0.08em',
          color: '#666', display: 'flex', 'justify-content': 'space-between',
          'align-items': 'center', 'user-select': 'none',
        }}
      >
        <div style={{ display: 'flex', 'align-items': 'center', gap: '8px' }}>
          {props.label}
          <Show when={props.checked !== undefined}>
            <input
              type="checkbox"
              checked={props.checked?.()}
              style={{ cursor: 'pointer', margin: '0', 'accent-color': '#6688cc' }}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => props.onCheckedChange?.(e.currentTarget.checked)}
            />
          </Show>
        </div>
        <span class="material-icons" style={{ 'font-size': '1.1rem', color: '#555', visibility: canExpand() ? 'visible' : 'hidden' }}>
          {effectiveOpen() ? 'expand_more' : 'chevron_right'}
        </span>
      </div>
      <Show when={effectiveOpen()}>
        <div style={{ display: 'flex', 'flex-direction': 'column', gap: '12px', padding: '4px 0 12px' }}>
          {props.children}
        </div>
      </Show>
    </div>
  )
}
