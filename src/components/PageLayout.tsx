import { Show, For, type JSX } from 'solid-js'
import { ModelViewer } from './ModelViewer'
import type { RawMesh, PieceMesh, Attribution } from '../types'
import styles from './PageLayout.module.css'

interface Props {
  title: string
  description?: string
  attribution?: Attribution[]
  header?: JSX.Element
  footer?: JSX.Element
  geometry: () => RawMesh | null
  pieces?: () => PieceMesh[] | null
  selectedPiece?: () => number
  onPieceClick?: (idx: number) => void
  rendering?: () => boolean
  children: JSX.Element
}

export function PageLayout(props: Props) {
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
          <Show when={props.footer}>
            {props.footer}
          </Show>
          <div classList={{ [styles.attribution]: true, [styles.attributionDivider]: !!props.footer }}>
            <div>
              {'© 2026 Graham Rogers · '}
              <a href="https://github.com/TastyPi/models" target="_blank" rel="noopener noreferrer" class={styles.attrLink}>GitHub</a>
            </div>
            <div>
              <a href="https://opensource.org/licenses/MIT" target="_blank" rel="noopener noreferrer" title="MIT licence (source code)" class={styles.attrLink}>MIT</a>
              {' (code) · '}
              <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer" title="CC BY 4.0 (generated designs)" class={styles.attrLink}>CC BY 4.0</a>
              {' (designs)'}
            </div>
            <Show when={props.attribution && props.attribution!.length > 0}>
              <div style={{ 'margin-top': '2px' }}>
                {'Based on '}
                <For each={props.attribution}>
                  {(credit, i) => (
                    <>
                      {i() > 0 && ' · '}
                      <a href={credit.url} target="_blank" rel="noopener noreferrer"
                        title={`${credit.name} by ${credit.author} (${credit.license})`}
                        classList={{ [styles.attrLink]: true, [styles.attrLinkNowrap]: true }}
                      >{credit.name}</a>
                    </>
                  )}
                </For>
              </div>
            </Show>
          </div>
        </div>
      </aside>

      <main class={styles.main}>
        <ModelViewer
          geometry={props.geometry}
          pieces={props.pieces}
          selectedPiece={props.selectedPiece}
          onPieceClick={props.onPieceClick}
        />
        <Show when={props.rendering?.()}>
          <div class={styles.rendering}>Rendering…</div>
        </Show>
      </main>
    </div>
  )
}
