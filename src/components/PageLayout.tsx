import { createMemo, Show, For, type JSX } from 'solid-js'
import { ModelViewer } from './ModelViewer'
import { DownloadFooter } from './DownloadFooter'
import type { PreviewMesh, Attribution } from '../types'
import styles from './PageLayout.module.css'

interface Props {
  title: string
  description?: string
  attribution?: Attribution[]
  designLicense?: { label: string; url: string }
  header?: JSX.Element
  footer?: JSX.Element
  objects?: () => PreviewMesh[] | null
  selectedObject?: () => ReadonlySet<number>
  onObjectClick?: (idx: number) => void
  download?: (format?: 'stl' | '3mf', objectIndices?: number[]) => void
  downloadNote?: string
  rendering?: () => boolean
  children: JSX.Element
}

export function PageLayout(props: Props) {
  const selIndices = createMemo(() => props.selectedObject ? [...props.selectedObject()] : [])

  const downloadLabel = createMemo(() => {
    const sel = selIndices()
    if (sel.length === 0) return 'Download'
    if (sel.length === 1) return `Download ${props.objects?.()?.[sel[0]]?.label ?? 'selected'}`
    return `Download selected (${sel.length})`
  })

  return (
    <div class={styles.layout}>
      <aside class={styles.sidebar}>
        <div class={styles.sidebarHeader}>
          <a href="../" class={styles.backLink}>← All models</a>
          <h2 class={styles.title}>{props.title}</h2>
          <Show when={props.description}>
            <p class={styles.description}>{props.description}</p>
          </Show>
          <Show when={props.header}>
            {props.header}
          </Show>
        </div>

        <div class={styles.sidebarBody}>
          {props.children}
        </div>

        <div class={styles.sidebarFooter}>
          <Show when={props.download !== undefined}>
            <DownloadFooter
              label={downloadLabel()}
              onStl={() => { const sel = selIndices(); props.download!('stl', sel.length > 0 ? sel : undefined) }}
              on3mf={() => { const sel = selIndices(); props.download!('3mf', sel.length > 0 ? sel : undefined) }}
              note={props.downloadNote}
            />
          </Show>
          <Show when={props.footer}>
            {props.footer}
          </Show>
          <div classList={{ [styles.attribution]: true, [styles.attributionDivider]: !!(props.footer || props.download) }}>
            <div>
              {'© 2026 Graham Rogers · '}
              <a href="https://github.com/TastyPi/models" target="_blank" rel="noopener noreferrer" class={styles.attrLink}>GitHub</a>
            </div>
            <div>
              <a href="https://opensource.org/licenses/MIT" target="_blank" rel="noopener noreferrer" title="MIT licence (source code)" class={styles.attrLink}>MIT</a>
              {' (code) · '}
              <a href={props.designLicense?.url ?? 'https://creativecommons.org/licenses/by/4.0/'} target="_blank" rel="noopener noreferrer" title={`${props.designLicense?.label ?? 'CC BY 4.0'} (generated designs)`} class={styles.attrLink}>{props.designLicense?.label ?? 'CC BY 4.0'}</a>
              {' (designs)'}
            </div>
            <Show when={props.attribution && props.attribution!.length > 0}>
              <div>{'Based on:'}</div>
              <ul class={styles.attributionList}>
                <For each={props.attribution}>
                  {(credit) => (
                    <li>
                      <a href={credit.url} target="_blank" rel="noopener noreferrer"
                        title={`${credit.name} by ${credit.author} (${credit.license})`}
                        class={styles.attrLink}
                      >{credit.name}</a>{` by ${credit.author}`}
                    </li>
                  )}
                </For>
              </ul>
            </Show>
          </div>
        </div>
      </aside>

      <main class={styles.main}>
        <ModelViewer
          objects={props.objects}
          selectedObject={props.selectedObject}
          onObjectClick={props.onObjectClick}
        />
        <Show when={props.rendering?.()}>
          <div class={styles.rendering}>Rendering…</div>
        </Show>
      </main>
    </div>
  )
}
