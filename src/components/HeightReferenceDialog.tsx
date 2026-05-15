import { For } from 'solid-js'
import styles from './HeightReferenceDialog.module.css'
import { HEIGHT_UNIT, STACKING_LIP_H } from '../models/gridfinity-bin'

interface DrawerSpec {
  label: string
  heightMm: number
}

const HALFORDS_DRAWERS: DrawerSpec[] = [
  { label: 'Top / Middle', heightMm: 51 },
  { label: 'Bottom', heightMm: 74 },
]

function maxUnits(drawerMm: number, lip: boolean): number {
  return Math.floor((drawerMm - (lip ? STACKING_LIP_H : 0)) / HEIGHT_UNIT)
}

function binH(units: number, lip: boolean): number {
  return units * HEIGHT_UNIT + (lip ? STACKING_LIP_H : 0)
}

function fmt(units: number, lip: boolean): string {
  return `${units} u (${binH(units, lip)} mm)`
}

export function HeightReferenceDialog() {
  let dialogRef!: HTMLDialogElement

  return (
    <>
      <button class={styles.trigger} onClick={() => dialogRef.showModal()} title="Drawer height reference">
        <span class={`material-icons ${styles.icon}`}>info_outline</span>
      </button>
      <dialog ref={dialogRef} class={styles.dialog} closedby="any">
          <div class={styles.header}>
            <span class={styles.title}>Halfords 3 Drawer Middle Chest</span>
            <button class={styles.close} onClick={() => dialogRef.close()}>✕</button>
          </div>
          <table class={styles.table}>
            <thead>
              <tr>
                <th>Drawer</th>
                <th>Height</th>
                <th>No lip</th>
                <th>With lip</th>
              </tr>
            </thead>
            <tbody>
              <For each={HALFORDS_DRAWERS}>{(row) => (
                <tr>
                  <td>{row.label}</td>
                  <td>{row.heightMm} mm</td>
                  <td>{fmt(maxUnits(row.heightMm, false), false)}</td>
                  <td>{fmt(maxUnits(row.heightMm, true), true)}</td>
                </tr>
              )}</For>
            </tbody>
          </table>
      </dialog>
    </>
  )
}
