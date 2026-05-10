import { Show, For, type JSX } from 'solid-js'
import { ModelViewer } from './ModelViewer'
import type { RawMesh, PieceMesh, Attribution } from '../types'

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
    <div style={{ display: 'flex', height: '100vh', 'font-family': 'system-ui, sans-serif', color: '#e0e0e0' }}>
      <aside style={{ width: '260px', 'flex-shrink': '0', background: '#12121f', display: 'flex', 'flex-direction': 'column', overflow: 'hidden' }}>
        <div style={{ 'padding-top': '20px', 'padding-left': '20px', 'padding-right': '20px', 'padding-bottom': '16px', 'flex-shrink': '0' }}>
          <a href="../" style={{ 'font-size': '0.75rem', color: '#555', 'text-decoration': 'none', display: 'inline-block', 'margin-bottom': '12px' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#6688cc')}
            onMouseLeave={(e) => (e.currentTarget.style.color = '#555')}
          >← All models</a>
          <h2 style={{ margin: '0 0 4px', 'font-size': '1.1rem', color: '#fff' }}>{props.title}</h2>
          <Show when={props.description}>
            <p style={{ margin: '0 0 8px', 'font-size': '0.8rem', color: '#777' }}>{props.description}</p>
          </Show>
          <Show when={props.header}>
            {props.header}
          </Show>
        </div>

        <div style={{ flex: '1', 'overflow-y': 'auto', padding: '12px 20px', 'border-top': '1px solid #2a2a3a' }}>
          {props.children}
        </div>

        <div style={{ padding: '12px 20px 20px', 'flex-shrink': '0', display: 'flex', 'flex-direction': 'column', gap: '8px', 'border-top': '1px solid #2a2a3a' }}>
          <Show when={props.footer}>
            {props.footer}
          </Show>
          <div style={{
            'border-top': props.footer ? '1px solid #2a2a3a' : 'none',
            'padding-top': props.footer ? '12px' : '0',
            'font-size': '0.68rem', color: '#666', 'line-height': '1.5',
          }}>
            <div>
              {'© 2026 Graham Rogers · '}
              <a href="https://github.com/TastyPi/models" target="_blank" rel="noopener noreferrer"
                style={{ color: '#778', 'text-decoration': 'none' }}
                onMouseEnter={(e) => (e.currentTarget.style.color = '#aabbdd')}
                onMouseLeave={(e) => (e.currentTarget.style.color = '#778')}
              >GitHub</a>
            </div>
            <div>
              <a href="https://opensource.org/licenses/MIT" target="_blank" rel="noopener noreferrer" title="MIT licence (source code)"
                style={{ color: '#778', 'text-decoration': 'none' }}
                onMouseEnter={(e) => (e.currentTarget.style.color = '#aabbdd')}
                onMouseLeave={(e) => (e.currentTarget.style.color = '#778')}
              >MIT</a>
              {' (code) · '}
              <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer" title="CC BY 4.0 (generated designs)"
                style={{ color: '#778', 'text-decoration': 'none' }}
                onMouseEnter={(e) => (e.currentTarget.style.color = '#aabbdd')}
                onMouseLeave={(e) => (e.currentTarget.style.color = '#778')}
              >CC BY 4.0</a>
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
                        style={{ color: '#778', 'text-decoration': 'none', 'white-space': 'nowrap' }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = '#aabbdd')}
                        onMouseLeave={(e) => (e.currentTarget.style.color = '#778')}
                      >{credit.name}</a>
                    </>
                  )}
                </For>
              </div>
            </Show>
          </div>
        </div>
      </aside>

      <main style={{ flex: '1', position: 'relative' }}>
        <ModelViewer
          geometry={props.geometry}
          pieces={props.pieces}
          selectedPiece={props.selectedPiece}
          onPieceClick={props.onPieceClick}
        />
        <Show when={props.rendering?.()}>
          <div style={{
            position: 'absolute', bottom: '16px', right: '16px',
            background: 'rgba(18,18,31,0.85)', color: '#666',
            padding: '5px 12px', 'border-radius': '4px', 'font-size': '0.75rem',
          }}>Rendering…</div>
        </Show>
      </main>
    </div>
  )
}
