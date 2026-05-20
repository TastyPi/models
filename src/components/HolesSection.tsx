import { Show } from 'solid-js'
import { BooleanField } from './BooleanField'
import { OptionalNumberSlider } from './NumberSlider'
import { SidebarSection } from './SidebarSection'
import styles from './HolesSection.module.css'

interface Props {
  magnetSize: number | null
  onMagnetSize: (v: number | null) => void
  screwHoles: boolean
  onScrewHoles: (v: boolean) => void
  supportless: boolean
  onSupportless: (v: boolean) => void
  cornerMagnets: boolean
  onCornerMagnets: (v: boolean) => void
}

export function HolesSection(props: Props) {
  const hasAnyHoles = () => props.magnetSize !== null || props.screwHoles

  return (
    <SidebarSection label="Holes" defaultOpen>
      <OptionalNumberSlider label="Magnet diameter (mm)" value={props.magnetSize} onChange={props.onMagnetSize} min={6.0} max={6.5} step={0.1} default={6.2} />
      <Show when={props.magnetSize !== null}>
        <p class={styles.magnetNote}>
          6.2 mm gives a good press-fit in testing. Try the{' '}
          <a href="../magnet-test/" class={styles.testerLink}>magnet tester</a>
          {' '}to find your ideal size.
        </p>
        <BooleanField label="Supportless" value={props.supportless} onChange={props.onSupportless} />
      </Show>
      <BooleanField label="Screw holes (M3)" value={props.screwHoles} onChange={props.onScrewHoles} />
      <Show when={hasAnyHoles()}>
        <BooleanField label="Corners only" value={props.cornerMagnets} onChange={props.onCornerMagnets} />
      </Show>
    </SidebarSection>
  )
}
