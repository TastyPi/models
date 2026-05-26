import { Show } from 'solid-js'
import type { BinHoleSettings } from '../models/gridfinity-bin'
import { BooleanField } from './BooleanField'
import { OptionalNumberSlider } from './NumberSlider'
import { SidebarSection } from './SidebarSection'
import styles from './BinHolesSection.module.css'

interface Props {
  value: BinHoleSettings
  onChange: (v: BinHoleSettings) => void
}

export function BinHolesSection(props: Props) {
  const set = <K extends keyof BinHoleSettings>(key: K, v: BinHoleSettings[K]) =>
    props.onChange({ ...props.value, [key]: v })

  return (
    <SidebarSection label="Base holes" defaultOpen>
      <OptionalNumberSlider label="Magnet diameter (mm)" value={props.value.magnet_size} onChange={v => set('magnet_size', v)} min={6.0} max={6.5} step={0.1} default={6.1} />
      <Show when={props.value.magnet_size !== null}>
        <p class={styles.magnetNote}>
          6.1 mm gives a good press-fit in testing. Try the{' '}
          <a href="../magnet-test/" class={styles.testerLink}>magnet tester</a>
          {' '}to find your ideal size.
        </p>
        <BooleanField label="Supportless" value={props.value.supportless} onChange={v => set('supportless', v)} default={true} />
      </Show>
      <BooleanField label="Screw holes (M3)" value={props.value.screw_holes} onChange={v => set('screw_holes', v)} default={false} />
      <Show when={props.value.magnet_size !== null || props.value.screw_holes}>
        <BooleanField label="Corners only" value={props.value.corner_magnets} onChange={v => set('corner_magnets', v)} default={false} />
      </Show>
    </SidebarSection>
  )
}
