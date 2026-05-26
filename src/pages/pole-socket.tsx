import { createEffect, createMemo, createSignal } from 'solid-js'
import { render } from 'solid-js/web'
import '../index.css'
import { PageLayout } from '../components/PageLayout'
import { DownloadFooter } from '../components/DownloadFooter'
import { NumberSlider } from '../components/NumberSlider'
import { SidebarSection } from '../components/SidebarSection'
import { useGeometry } from '../hooks/useGeometry'
import { PoleSocketMeasureTooltip } from '../components/PoleSocketMeasureTooltip'

const DEFAULTS = {
  thread_diameter: 30,
  thread_root_diameter: 26,
  thread_pitch: 5,
  thread_ridge_root: 2.5,
  thread_ridge_peak: 2.5,
  thread_length: 30,
  tolerance: 0.4,
  wall_thickness: 5,
  floor_thickness: 3,
}

const sp = new URLSearchParams(window.location.search)
function urlNum(key: string, def: number) {
  const v = sp.get(key)
  return v !== null ? parseFloat(v) : def
}

function PoleSocketPage() {
  const [threadDiameter, setThreadDiameter] = createSignal(urlNum('thread_diameter', DEFAULTS.thread_diameter))
  const [threadRootDiameter, setThreadRootDiameter] = createSignal(urlNum('thread_root_diameter', DEFAULTS.thread_root_diameter))
  const [threadPitch, setThreadPitch]       = createSignal(urlNum('thread_pitch', DEFAULTS.thread_pitch))
  const [threadRidgeRoot, setThreadRidgeRoot] = createSignal(urlNum('thread_ridge_root', DEFAULTS.thread_ridge_root))
  const [threadRidgePeak, setThreadRidgePeak] = createSignal(urlNum('thread_ridge_peak', DEFAULTS.thread_ridge_peak))
  const [threadLength, setThreadLength]     = createSignal(urlNum('thread_length', DEFAULTS.thread_length))
  const [tolerance, setTolerance]           = createSignal(urlNum('tolerance', DEFAULTS.tolerance))
  const [wallThickness, setWallThickness]   = createSignal(urlNum('wall_thickness', DEFAULTS.wall_thickness))
  const [floorThickness, setFloorThickness] = createSignal(urlNum('floor_thickness', DEFAULTS.floor_thickness))

  const maxRidgeWidth = createMemo(() =>
    Math.max(0.5, Math.floor((threadPitch() - 0.5) / 0.5) * 0.5)
  )

  createEffect(() => {
    const max = maxRidgeWidth()
    if (threadRidgeRoot() > max) setThreadRidgeRoot(max)
    if (threadRidgePeak() > max) setThreadRidgePeak(max)
  })

  const maxRootDiameter = createMemo(() => threadDiameter() - 1)

  const params = createMemo(() => ({
    thread_diameter:      threadDiameter(),
    thread_root_diameter: Math.min(threadRootDiameter(), maxRootDiameter()),
    thread_pitch:         threadPitch(),
    thread_ridge_root:    threadRidgeRoot(),
    thread_ridge_peak: threadRidgePeak(),
    thread_length:     threadLength(),
    tolerance:         tolerance(),
    wall_thickness:    wallThickness(),
    floor_thickness:   floorThickness(),
  }))

  const { objects, rendering, selectedObject, toggleObject, download } = useGeometry('pole-socket', params)

  createEffect(() => {
    const p = params()
    const url = new URLSearchParams()
    for (const [k, v] of Object.entries(p)) {
      if (v !== (DEFAULTS as Record<string, number>)[k]) url.set(k, String(v))
    }
    window.history.replaceState(null, '', url.toString() ? '?' + url.toString() : window.location.pathname)
  })

  return (
    <PageLayout
      title="Pole Socket"
      description="Female threaded socket for large pole fittings. Measure the thread on your pole and dial in all dimensions."
      objects={objects}
      selectedObject={selectedObject}
      onObjectClick={toggleObject}
      rendering={rendering}
      footer={<DownloadFooter label="Download" onStl={() => download()} on3mf={() => download('3mf')} />}
    >
      <SidebarSection label="Thread" defaultOpen>
        <NumberSlider label="Outer Diameter (mm)" value={threadDiameter()} onChange={setThreadDiameter} min={10} max={120} default={DEFAULTS.thread_diameter} labelAddon={<PoleSocketMeasureTooltip measure="outer_diameter" />} description="Measure across the thread peaks" />
        <NumberSlider label="Root Diameter (mm)" value={threadRootDiameter()} onChange={setThreadRootDiameter} min={5} max={maxRootDiameter()} step={0.5} default={DEFAULTS.thread_root_diameter} labelAddon={<PoleSocketMeasureTooltip measure="root_diameter" />} description="Measure across the thread valleys" />
        <NumberSlider label="Pitch (mm)" value={threadPitch()} onChange={setThreadPitch} min={1} max={30} step={0.5} default={DEFAULTS.thread_pitch} labelAddon={<PoleSocketMeasureTooltip measure="pitch" />} description="Distance between adjacent thread crests" />
        <NumberSlider label="Ridge Width at Root (mm)" value={threadRidgeRoot()} onChange={setThreadRidgeRoot} min={0.5} max={maxRidgeWidth()} step={0.5} default={DEFAULTS.thread_ridge_root} labelAddon={<PoleSocketMeasureTooltip measure="ridge_root" />} description="Axial width of the male ridge at its base — wider end for trapezoid threads" />
        <NumberSlider label="Ridge Width at Peak (mm)" value={threadRidgePeak()} onChange={setThreadRidgePeak} min={0.5} max={maxRidgeWidth()} step={0.5} default={DEFAULTS.thread_ridge_peak} labelAddon={<PoleSocketMeasureTooltip measure="ridge_peak" />} description="Axial width of the male ridge at its tip — same as root for square threads" />
        <NumberSlider label="Engagement Length (mm)" value={threadLength()} onChange={setThreadLength} min={5} max={100} default={DEFAULTS.thread_length} labelAddon={<PoleSocketMeasureTooltip measure="thread_length" />} description="Length of the threaded section on the male pole" />
      </SidebarSection>
      <SidebarSection label="Socket" defaultOpen>
        <NumberSlider label="Tolerance (mm)" value={tolerance()} onChange={setTolerance} min={0.1} max={1.0} step={0.1} default={DEFAULTS.tolerance} description="Clearance for fit — increase if too tight after printing" />
        <NumberSlider label="Wall Thickness (mm)" value={wallThickness()} onChange={setWallThickness} min={2} max={20} step={0.5} default={DEFAULTS.wall_thickness} />
        <NumberSlider label="Floor Thickness (mm)" value={floorThickness()} onChange={setFloorThickness} min={0} max={20} step={0.5} default={DEFAULTS.floor_thickness} description="Set to 0 for an open through-hole" />
      </SidebarSection>
    </PageLayout>
  )
}

render(() => <PoleSocketPage />, document.getElementById('root')!)
