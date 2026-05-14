import { createEffect, createMemo, createSignal, Show } from 'solid-js'
import { render } from 'solid-js/web'
import '../index.css'
import { PageLayout } from '../components/PageLayout'
import { BooleanField } from '../components/BooleanField'
import { NumberSlider } from '../components/NumberSlider'
import { SelectField } from '../components/SelectField'
import { SidebarSection } from '../components/SidebarSection'
import { useGeometry } from '../hooks/useGeometry'
import { resolveScrew, resolveDriverDiameter, SCREW_OPTIONS, DRIVER_OPTIONS } from '../screws'

const PRESET = {
  wall_side_height: 20, depth: 10, width: 50,
  lip_height: 25, lip_thickness: 5, lip_edge_radius: 2.5,
  screw_holes: 2, screw_spacing: 20, screw_type: 'wood4', screw_shaft: 4, screw_head: 8,
  driver_type: 'ltt', driver_diameter: 10, countersunk: true,
}

function readParam<T extends string | number | boolean>(sp: URLSearchParams, key: string, def: T): T {
  const raw = sp.get(key)
  if (raw === null) return def
  if (typeof def === 'boolean') return (raw === 'true') as T
  if (typeof def === 'number') return parseFloat(raw) as T
  return raw as T
}

function WallHookPage() {
  const sp = new URLSearchParams(window.location.search)
  const [wallHeight, setWallHeight] = createSignal(readParam(sp, 'wall_side_height', PRESET.wall_side_height))
  const [depth, setDepth] = createSignal(readParam(sp, 'depth', PRESET.depth))
  const [width, setWidth] = createSignal(readParam(sp, 'width', PRESET.width))
  const [lipHeight, setLipHeight] = createSignal(readParam(sp, 'lip_height', PRESET.lip_height))
  const [lipThickness, setLipThickness] = createSignal(readParam(sp, 'lip_thickness', PRESET.lip_thickness))
  const [lipEdgeRadius, setLipEdgeRadius] = createSignal(readParam(sp, 'lip_edge_radius', PRESET.lip_edge_radius))
  const [screwHoles, setScrewHoles] = createSignal(readParam(sp, 'screw_holes', PRESET.screw_holes))
  const [screwSpacing, setScrewSpacing] = createSignal(readParam(sp, 'screw_spacing', PRESET.screw_spacing))
  const [screwType, setScrewType] = createSignal(readParam(sp, 'screw_type', PRESET.screw_type))
  const [screwShaft, setScrewShaft] = createSignal(readParam(sp, 'screw_shaft', PRESET.screw_shaft))
  const [screwHead, setScrewHead] = createSignal(readParam(sp, 'screw_head', PRESET.screw_head))
  const [driverType, setDriverType] = createSignal(readParam(sp, 'driver_type', PRESET.driver_type))
  const [driverDiameter, setDriverDiameter] = createSignal(readParam(sp, 'driver_diameter', PRESET.driver_diameter))
  const [countersunk, setCountersunk] = createSignal(readParam(sp, 'countersunk', PRESET.countersunk))

  const resolved = createMemo(() => resolveScrew(screwType(), screwShaft(), screwHead()))
  const resolvedDriver = createMemo(() => resolveDriverDiameter(driverType(), driverDiameter()))
  const boreDiameter = createMemo(() => Math.max(resolved().head, resolvedDriver()))
  const maxEdgeRadius = createMemo(() => Math.floor(Math.min(lipThickness(), lipHeight()) / 2 / 0.5) * 0.5)
  const minScrewSpacing = createMemo(() => boreDiameter())
  const maxScrewSpacing = createMemo(() => {
    const hi = Math.floor((width() - boreDiameter()) / Math.max(screwHoles() - 1, 1))
    return Math.max(hi, boreDiameter())
  })

  // Clamp edge radius when thickness/height change
  createEffect(() => {
    const max = maxEdgeRadius()
    if (lipEdgeRadius() > max) setLipEdgeRadius(max)
  })

  // Clamp screw spacing when bore size or width changes
  createEffect(() => {
    if (screwHoles() < 2) return
    const lo = minScrewSpacing(), hi = maxScrewSpacing()
    const clamped = Math.min(Math.max(screwSpacing(), lo), hi)
    if (clamped !== screwSpacing()) setScrewSpacing(clamped)
  })

  const params = createMemo(() => ({
    wall_side_height: wallHeight(), depth: depth(), width: width(),
    lip_height: lipHeight(), lip_thickness: lipThickness(), lip_edge_radius: lipEdgeRadius(),
    screw_holes: screwHoles(), screw_spacing: screwSpacing(),
    screw_type: screwType(), screw_shaft: screwShaft(), screw_head: screwHead(),
    driver_type: driverType(), driver_diameter: driverDiameter(), countersunk: countersunk(),
  }))

  const { geometry, rendering, download } = useGeometry('wall-hook', params)

  createEffect(() => {
    const p = params()
    const urlParams = new URLSearchParams()
    for (const [k, v] of Object.entries(p)) {
      if (v !== (PRESET as Record<string, unknown>)[k]) urlParams.set(k, String(v))
    }
    const qs = urlParams.toString()
    history.replaceState(null, '', qs ? '?' + qs : window.location.pathname)
  })

  const applyPreset = () => {
    setWallHeight(PRESET.wall_side_height); setDepth(PRESET.depth); setWidth(PRESET.width)
    setLipHeight(PRESET.lip_height); setLipThickness(PRESET.lip_thickness); setLipEdgeRadius(PRESET.lip_edge_radius)
    setScrewHoles(PRESET.screw_holes); setScrewSpacing(PRESET.screw_spacing)
    setScrewType(PRESET.screw_type); setScrewShaft(PRESET.screw_shaft); setScrewHead(PRESET.screw_head)
    setDriverType(PRESET.driver_type); setDriverDiameter(PRESET.driver_diameter); setCountersunk(PRESET.countersunk)
  }

  return (
    <PageLayout
      title="Wall Hook"
      description="Triangular prism hook. Print flat on the hypotenuse face — no supports needed."
      geometry={geometry}
      rendering={rendering}
      footer={
        <>
          <button onClick={() => download()} style={btnStyle}>Download STL</button>
          <button onClick={() => download(undefined, '3mf')} style={btnStyleOutline}>Download 3MF</button>
        </>
      }
      header={
        <div style={{ 'margin-bottom': '8px' }}>
          <div style={{ 'font-size': '0.6rem', color: '#555', 'text-transform': 'uppercase', 'letter-spacing': '0.08em', 'margin-bottom': '4px' }}>Preset</div>
          <button
            onClick={applyPreset}
            style={{
              width: '100%', background: '#1e1e30', color: '#fff',
              border: '1px solid #2a2a40', 'border-radius': '6px',
              padding: '6px 8px', 'font-size': '0.875rem', cursor: 'pointer', 'text-align': 'left',
            }}
          >Joseph Joseph Tota lid</button>
        </div>
      }
    >
      <SidebarSection label="Shape" defaultOpen>
        <NumberSlider label="Wall Side Height (mm)" value={wallHeight()} onChange={setWallHeight} min={20} max={150} default={PRESET.wall_side_height} />
        <NumberSlider label="Depth (mm)" value={depth()} onChange={setDepth} min={5} max={150} default={PRESET.depth} />
        <NumberSlider label="Width (mm)" value={width()} onChange={setWidth} min={10} max={100} default={PRESET.width} />
      </SidebarSection>
      <SidebarSection label="Lip" defaultOpen>
        <NumberSlider label="Lip Height (mm)" value={lipHeight()} onChange={setLipHeight} min={5} max={50} default={PRESET.lip_height} />
        <NumberSlider label="Lip Thickness (mm)" value={lipThickness()} onChange={setLipThickness} min={2} max={20} step={0.5} default={PRESET.lip_thickness} />
        <NumberSlider label="Lip Edge Radius (mm)" value={lipEdgeRadius()} onChange={setLipEdgeRadius} min={0} max={maxEdgeRadius()} step={0.5} default={PRESET.lip_edge_radius} />
      </SidebarSection>
      <SidebarSection label="Screws" defaultOpen>
        <NumberSlider label="Screw Holes" value={screwHoles()} onChange={setScrewHoles} min={0} max={6} default={PRESET.screw_holes} />
        <Show when={screwHoles() >= 2}>
          <NumberSlider label="Hole Spacing (mm)" value={screwSpacing()} onChange={setScrewSpacing} min={minScrewSpacing()} max={maxScrewSpacing()} default={PRESET.screw_spacing} />
        </Show>
        <Show when={screwHoles() > 0}>
          <SelectField label="Screw Type" value={screwType()} onChange={setScrewType} default={PRESET.screw_type} options={SCREW_OPTIONS} />
          <Show when={screwType() === 'custom'}>
            <NumberSlider label="Shaft Diameter (mm)" value={screwShaft()} onChange={setScrewShaft} min={2} max={12} step={0.5} default={PRESET.screw_shaft} />
            <NumberSlider label="Head Diameter (mm)" value={screwHead()} onChange={setScrewHead} min={4} max={24} step={0.5} default={PRESET.screw_head} />
          </Show>
          <SelectField label="Driver Diameter" value={driverType()} onChange={setDriverType} default={PRESET.driver_type} options={DRIVER_OPTIONS} />
          <Show when={driverType() === 'custom'}>
            <NumberSlider label="Driver Diameter (mm)" value={driverDiameter()} onChange={setDriverDiameter} min={5} max={16} step={0.5} default={PRESET.driver_diameter} description="Bore diameter through side (c). Must be at least the screw head diameter." />
          </Show>
          <BooleanField label="Countersunk" value={countersunk()} onChange={setCountersunk} default={PRESET.countersunk} />
        </Show>
      </SidebarSection>
    </PageLayout>
  )
}

const btnStyle = { padding: '10px', background: '#6688cc', color: '#fff', border: 'none', 'border-radius': '6px', cursor: 'pointer', 'font-size': '0.875rem', width: '100%' } as const
const btnStyleOutline = { padding: '8px', background: 'none', color: '#6688cc', border: '1px solid #6688cc', 'border-radius': '6px', cursor: 'pointer', 'font-size': '0.8rem', width: '100%' } as const

render(() => <WallHookPage />, document.getElementById('root')!)
