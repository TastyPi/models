import styles from './PageLayout.module.css'

export function ModelInfo(props: { children: string }) {
  return <p class={styles.modelInfo}>{props.children}</p>
}
