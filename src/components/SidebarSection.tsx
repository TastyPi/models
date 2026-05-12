import { createMemo, createSignal, Show, type JSX } from 'solid-js'
import styles from './SidebarSection.module.css'

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
    <div class={styles.section}>
      <div onClick={toggle} classList={{ [styles.header]: true, [styles.headerClickable]: canExpand() }}>
        <div class={styles.headerLabel}>
          {props.label}
          <Show when={props.checked !== undefined}>
            <input
              type="checkbox"
              checked={props.checked?.()}
              class={styles.checkbox}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => props.onCheckedChange?.(e.currentTarget.checked)}
            />
          </Show>
        </div>
        <Show when={canExpand()}>
          <span class={`material-icons ${styles.chevron}`}>
            {effectiveOpen() ? 'expand_more' : 'chevron_right'}
          </span>
        </Show>
      </div>
      <Show when={effectiveOpen()}>
        <div class={styles.body}>{props.children}</div>
      </Show>
    </div>
  )
}
