'use client'

// ─────────────────────────────────────────────────────────────────────────────
// "The Living Property" — an architectural miniature of a contemporary riad
// (three dorms + three private rooms) whose beds change status as the visitor
// scrolls through one day — morning, golden hour, night — before the camera
// rises to a top-down view that matches the app's bed map.
//
// Fully procedural (no textures, fonts, HDRs or GLTFs are fetched — the site
// CSP only allows 'self'). Lazy-loaded via next/dynamic and mounted only on
// capable desktop devices. Scroll progress is read from a MotionValue inside
// useFrame — never through React state.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { MotionValue } from 'framer-motion'
import { STATUS_COLORS, STORY_BOOKED_BED, STORY_CLEANED_BED, DEMO_ROOMS, type BedStatus } from './lp-data'

// ── Palette (warm limestone + plaster + oak) ───────────────────────────────
const C = {
  plinth: '#E3D3BC',
  floor: '#EBDFCD',
  court: '#F3EBDD',
  wall: '#EED9C0',
  wallInner: '#F2E3CF',
  arcade: '#F4E6D2',
  oak: '#B88C62',
  linenFree: '#FBF8F2',
  pillow: '#FFFFFF',
  water: '#7FB3AE',
  leaf: '#A3A985',
  trunk: '#8C7158',
  coral: '#0F6E56',
  lamp: '#FFC47A',
  cedar: '#7A4A2A',
  path: '#DCC8AA',
  zelligeA: '#8CC2AF',
  zelligeB: '#F6F0E6',
  zelligeC: '#E2D2BA',
  lantern: '#E8D9C4',
  poolGlow: '#2BC9A2',
}

const BED_COLOR: Record<BedStatus, string> = { ...STATUS_COLORS, free: C.linenFree }

// ── Geometry helpers ───────────────────────────────────────────────────────
type Opening = { x: number; w: number; spring: number; apex: number; y?: number }

function archTo(path: THREE.Path, x0: number, x1: number, spring: number, apex: number) {
  const cx = (x0 + x1) / 2
  const w = x1 - x0
  const rise = apex - spring
  path.lineTo(x0, spring)
  path.bezierCurveTo(x0, spring + rise * 0.62, cx - w * 0.14, apex - rise * 0.12, cx, apex)
  path.bezierCurveTo(cx + w * 0.14, apex - rise * 0.12, x1, spring + rise * 0.62, x1, spring)
}

/** A wall in the XY plane (centred on x, base at y=0) extruded along Z. */
function wallGeometry(length: number, height: number, thickness: number, doors: Opening[] = [], windows: Opening[] = []) {
  const half = length / 2
  const shape = new THREE.Shape()
  shape.moveTo(-half, 0)
  for (const d of [...doors].sort((a, b) => a.x - b.x)) {
    const x0 = d.x - d.w / 2
    const x1 = d.x + d.w / 2
    shape.lineTo(x0, 0)
    archTo(shape, x0, x1, d.spring, d.apex)
    shape.lineTo(x1, 0)
  }
  shape.lineTo(half, 0)
  shape.lineTo(half, height)
  shape.lineTo(-half, height)
  shape.closePath()
  for (const w of windows) {
    const hole = new THREE.Path()
    const x0 = w.x - w.w / 2
    const x1 = w.x + w.w / 2
    const y0 = w.y ?? 0.4
    hole.moveTo(x1, y0)
    hole.lineTo(x0, y0)
    archTo(hole, x0, x1, w.spring, w.apex)
    hole.lineTo(x1, y0)
    shape.holes.push(hole)
  }
  const geo = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false, curveSegments: 10 })
  geo.translate(0, 0, -thickness / 2)
  return geo
}

function evenly(n: number, span: number) {
  return Array.from({ length: n }, (_, i) => -span / 2 + (span / n) * (i + 0.5))
}

// ── Bed layout (matches DEMO_ROOMS) ────────────────────────────────────────
type BedPlacement = { name: string; pos: [number, number]; rotY: number; double?: boolean; bunk?: 'top' | 'bottom' }

/** Height of the top bunk's base above the floor. */
const BUNK_TOP = 0.5

// West wing: three private rooms, centred on these z positions
const PRIVATE_Z = [-1.73, 0, 1.73]

function bedPlacements(): BedPlacement[] {
  const out: BedPlacement[] = []
  // Dortoir A — north wing, three bunk beds (odd = top bunk, even = bottom)
  evenly(3, 4.8).forEach((x, i) => {
    out.push({ name: `A${i * 2 + 1}`, pos: [x, -3.78], rotY: 0, bunk: 'top' })
    out.push({ name: `A${i * 2 + 2}`, pos: [x, -3.78], rotY: 0, bunk: 'bottom' })
  })
  // Dortoir B — east wing
  evenly(6, 4.6).forEach((z, i) => out.push({ name: `B${i + 1}`, pos: [3.78, z], rotY: Math.PI / 2 }))
  // Dortoir C — south-east wing
  ;[1.55, 2.3, 3.05, 3.8].forEach((x, i) => out.push({ name: `C${i + 1}`, pos: [x, 3.78], rotY: 0 }))
  // Private rooms — west wing, one double bed per room
  PRIVATE_Z.forEach((z, i) => out.push({ name: `P${i + 1}`, pos: [-3.66, z], rotY: Math.PI / 2, double: true }))
  return out
}

const FINAL_STATUS: Record<string, BedStatus> = Object.fromEntries(
  DEMO_ROOMS.flatMap((r) => r.beds.map((b) => [b.name, b.status] as const)),
)

// ── Camera choreography ────────────────────────────────────────────────────
type Key = { t: number; pos: [number, number, number]; look: [number, number, number]; fov: number; off: number }

const KEYS: Key[] = [
  { t: 0.0, pos: [14.2, 11.2, 16.3], look: [0, -0.2, 0], fov: 26, off: 1.15 },
  { t: 0.14, pos: [13.4, 10.5, 15.3], look: [0, -0.2, 0], fov: 26, off: 1.15 },
  // Dortoir A (north wing) — high enough to see over the inner wall
  { t: 0.3, pos: [2.2, 10.5, 2.6], look: [0.3, 0, -3.2], fov: 34, off: 0.9 },
  { t: 0.42, pos: [1.8, 10.2, 2.2], look: [0.3, 0, -3.3], fov: 34, off: 0.9 },
  // Dortoir B (east wing)
  { t: 0.54, pos: [-1.6, 10.4, 2.4], look: [3.5, 0, 0.1], fov: 34, off: 0.9 },
  { t: 0.62, pos: [-1.4, 10.0, 2.0], look: [3.5, 0, 0.1], fov: 34, off: 0.9 },
  { t: 0.76, pos: [11.5, 13.5, 12.0], look: [0, -0.3, 0], fov: 27, off: 0.9 },
  { t: 0.92, pos: [0.0, 22, 0.9], look: [0, 0, 0.1], fov: 30, off: 0 },
  { t: 1.0, pos: [0.0, 22, 0.9], look: [0, 0, 0.1], fov: 30, off: 0 },
]

const smooth = (x: number) => x * x * (3 - 2 * x)

function sampleKeys(p: number) {
  let i = 0
  while (i < KEYS.length - 2 && p > KEYS[i + 1].t) i++
  const a = KEYS[i]
  const b = KEYS[i + 1]
  const k = smooth(THREE.MathUtils.clamp((p - a.t) / (b.t - a.t || 1), 0, 1))
  const lerp3 = (u: number[], v: number[]) => u.map((x, j) => x + (v[j] - x) * k) as [number, number, number]
  return { pos: lerp3(a.pos, b.pos), look: lerp3(a.look, b.look), fov: a.fov + (b.fov - a.fov) * k, off: a.off + (b.off - a.off) * k }
}

/** 0→1 over [a,b], smoothed. */
const ramp = (p: number, a: number, b: number) => smooth(THREE.MathUtils.clamp((p - a) / (b - a), 0, 1))

// ── Crenellations — every merlon merged into one geometry ─────────────────
function merlonGeometry() {
  const parts: THREE.BufferGeometry[] = []
  const add = (x: number, y: number, z: number, alongX: boolean, w = 0.22) => {
    const g = new THREE.BoxGeometry(alongX ? w : 0.2, 0.16, alongX ? 0.2 : w)
    g.translate(x, y, z)
    parts.push(g)
  }
  const top = 1.25 + 0.08
  for (const t of evenly(20, 8.98)) {
    add(t, top, -4.4, true)
    if (Math.abs(t) > 0.85) add(t, top, 4.4, true) // the gate portal rises above the south wall
    add(4.4, top, t, false)
    add(-4.4, top, t, false)
  }
  // Tower top (centre -3.45, -3.45; 1.86 wide; 2.35 tall)
  for (const t of evenly(4, 1.86)) {
    add(-3.45 + t, 2.43, -3.45 - 0.87, true, 0.24)
    add(-3.45 + t, 2.43, -3.45 + 0.87, true, 0.24)
    add(-3.45 - 0.87, 2.43, -3.45 + t, false, 0.24)
    add(-3.45 + 0.87, 2.43, -3.45 + t, false, 0.24)
  }
  // Gate portal (south, 1.5 wide, 1.62 tall)
  for (const t of evenly(4, 1.5)) add(t, 1.62 + 0.08, 4.56, true, 0.2)
  const merged = mergeGeometries(parts)
  parts.forEach((g) => g.dispose())
  return merged
}

// ── Zellige — courtyard tiles drawn on a canvas, no image fetched ─────────
function zelligeTexture() {
  const size = 256
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (ctx) {
    const cell = size / 4
    ctx.fillStyle = C.zelligeB
    ctx.fillRect(0, 0, size, size)
    const square = (cx: number, cy: number, r: number, rot: number) => {
      ctx.beginPath()
      for (let k = 0; k < 4; k++) {
        const a = rot + (k * Math.PI) / 2 + Math.PI / 4
        const x = cx + Math.cos(a) * r
        const y = cy + Math.sin(a) * r
        if (k === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.closePath()
      ctx.fill()
    }
    for (let i = 0; i <= 4; i++) {
      for (let j = 0; j <= 4; j++) {
        const cx = i * cell
        const cy = j * cell
        // Eight-point star: two overlapping squares, a small inner star in cream
        ctx.fillStyle = C.zelligeA
        square(cx, cy, cell * 0.3, 0)
        square(cx, cy, cell * 0.3, Math.PI / 4)
        ctx.fillStyle = C.zelligeB
        square(cx, cy, cell * 0.15, 0)
        square(cx, cy, cell * 0.15, Math.PI / 4)
        // Sand diamonds between the stars
        ctx.fillStyle = C.zelligeC
        square(cx + cell / 2, cy + cell / 2, cell * 0.11, Math.PI / 4)
      }
    }
  }
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(3.5, 3.5)
  tex.anisotropy = 8
  return tex
}

// ── People — small stylised figures that act out the story ────────────────
type FigureProps = { color: string; skin?: string; suitcase?: boolean; cart?: boolean }

function Figure({ color, skin = '#C99D78', suitcase, cart, ...props }: FigureProps & React.ComponentProps<'group'>) {
  return (
    <group {...props}>
      <mesh position={[0, 0.3, 0]} castShadow>
        <capsuleGeometry args={[0.1, 0.36, 4, 12]} />
        <meshStandardMaterial color={color} roughness={0.85} />
      </mesh>
      <mesh position={[0, 0.69, 0]} castShadow>
        <sphereGeometry args={[0.085, 16, 12]} />
        <meshStandardMaterial color={skin} roughness={0.8} />
      </mesh>
      {suitcase && (
        <mesh position={[0.17, 0.12, 0.02]} castShadow>
          <boxGeometry args={[0.1, 0.2, 0.15]} />
          <meshStandardMaterial color="#1F3A4A" roughness={0.6} />
        </mesh>
      )}
      {cart && (
        <group position={[0, 0, 0.36]}>
          <mesh position={[0, 0.17, 0]} castShadow>
            <boxGeometry args={[0.2, 0.26, 0.3]} />
            <meshStandardMaterial color="#F4F6F7" roughness={0.7} />
          </mesh>
          <mesh position={[0, 0.31, 0]}>
            <boxGeometry args={[0.21, 0.03, 0.31]} />
            <meshStandardMaterial color={C.coral} roughness={0.6} />
          </mesh>
        </group>
      )}
    </group>
  )
}

/** Scale-in / scale-out window for a figure, 0→1→0 over [a, b, c, d]. */
const presence = (p: number, a: number, b: number, c: number, d: number) => ramp(p, a, b) * (1 - ramp(p, c, d))

// ── Day cycle — the scroll story runs from morning to night ────────────────
type SkyKey = {
  t: number
  sun: [number, number, number]
  sunColor: string
  sun_i: number
  sky: string
  ground: string
  hemi: number
  env: number
  shadow: number
}

const SKY: SkyKey[] = [
  { t: 0.0, sun: [9, 6.5, 7], sunColor: '#FFE6CC', sun_i: 2.4, sky: '#FFF4E6', ground: '#C2AE95', hemi: 0.85, env: 0.42, shadow: 0.14 },
  { t: 0.3, sun: [4, 13, 5], sunColor: '#FFF7EE', sun_i: 2.7, sky: '#FFF8F0', ground: '#C9B59C', hemi: 0.9, env: 0.45, shadow: 0.16 },
  { t: 0.5, sun: [-5, 10, 6], sunColor: '#FFE9D2', sun_i: 2.5, sky: '#FFF1E2', ground: '#C2AE95', hemi: 0.82, env: 0.4, shadow: 0.15 },
  { t: 0.62, sun: [-9, 5, 5], sunColor: '#FFC9A0', sun_i: 1.9, sky: '#FFE6CF', ground: '#B39576', hemi: 0.72, env: 0.34, shadow: 0.13 },
  { t: 0.71, sun: [-9, 2.6, 3], sunColor: '#E58466', sun_i: 0.9, sky: '#7E7BA6', ground: '#3A3048', hemi: 0.45, env: 0.14, shadow: 0.07 },
  { t: 0.79, sun: [-4, 11, -6], sunColor: '#9DB8FF', sun_i: 0.5, sky: '#3A5A80', ground: '#14232C', hemi: 0.42, env: 0.08, shadow: 0.05 },
  { t: 1.0, sun: [-4, 11, -6], sunColor: '#9DB8FF', sun_i: 0.5, sky: '#3A5A80', ground: '#14232C', hemi: 0.42, env: 0.08, shadow: 0.05 },
]
const SKY_COLORS = SKY.map((k) => ({ sun: new THREE.Color(k.sunColor), sky: new THREE.Color(k.sky), ground: new THREE.Color(k.ground) }))

/** Lamps, lit windows and pool lights fade in at dusk. */
const nightAt = (p: number) => ramp(p, 0.66, 0.78)

function applyNight(
  m: { windowGlow: THREE.MeshBasicMaterial; lantern: THREE.MeshStandardMaterial; water: THREE.MeshStandardMaterial },
  night: number,
) {
  m.windowGlow.opacity = night
  m.windowGlow.visible = night > 0.01
  m.lantern.emissiveIntensity = night * 2.6
  m.water.emissiveIntensity = night * 0.55
}

function Lighting({ progress }: { progress: MotionValue<number> }) {
  const hemi = useRef<THREE.HemisphereLight>(null)
  const sun = useRef<THREE.DirectionalLight>(null)
  const ground = useRef<THREE.ShadowMaterial>(null)
  const lamps = useRef<(THREE.PointLight | null)[]>([])
  const lastSun = useMemo(() => new THREE.Vector3(Infinity, 0, 0), [])

  useFrame((state) => {
    const p = THREE.MathUtils.clamp(progress.get(), 0, 1)
    let i = 0
    while (i < SKY.length - 2 && p > SKY[i + 1].t) i++
    const a = SKY[i]
    const b = SKY[i + 1]
    const k = smooth(THREE.MathUtils.clamp((p - a.t) / (b.t - a.t || 1), 0, 1))
    const mix = (u: number, v: number) => u + (v - u) * k

    if (sun.current) {
      sun.current.position.set(mix(a.sun[0], b.sun[0]), mix(a.sun[1], b.sun[1]), mix(a.sun[2], b.sun[2]))
      sun.current.color.lerpColors(SKY_COLORS[i].sun, SKY_COLORS[i + 1].sun, k)
      sun.current.intensity = mix(a.sun_i, b.sun_i)
      // The shadow map is frozen after the entrance; re-render it only when the sun has moved.
      if (!state.gl.shadowMap.autoUpdate && lastSun.distanceToSquared(sun.current.position) > 0.0004) {
        state.gl.shadowMap.needsUpdate = true
        lastSun.copy(sun.current.position)
      }
    }
    if (hemi.current) {
      hemi.current.color.lerpColors(SKY_COLORS[i].sky, SKY_COLORS[i + 1].sky, k)
      hemi.current.groundColor.lerpColors(SKY_COLORS[i].ground, SKY_COLORS[i + 1].ground, k)
      hemi.current.intensity = mix(a.hemi, b.hemi)
    }
    if (ground.current) ground.current.opacity = mix(a.shadow, b.shadow)
    state.scene.environmentIntensity = mix(a.env, b.env)

    const night = nightAt(p)
    lamps.current.forEach((l, j) => {
      if (l) l.intensity = night * (j === 0 ? 7 : 3.2)
    })
  })

  // Courtyard lantern first, then one warm light per wing.
  const lampPos: [number, number, number][] = [
    [0, 1.5, 0],
    [0, 0.95, -3.5],
    [3.5, 0.95, 0],
    [2.6, 0.95, 3.5],
    [-3.5, 0.95, 0],
  ]

  return (
    <>
      <hemisphereLight ref={hemi} args={['#FFF4E6', '#C2AE95', 0.85]} />
      <directionalLight
        ref={sun}
        position={[9, 6.5, 7]}
        intensity={2.4}
        color="#FFE6CC"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-8}
        shadow-camera-right={8}
        shadow-camera-top={8}
        shadow-camera-bottom={-8}
        shadow-camera-near={1}
        shadow-camera-far={30}
        shadow-bias={-0.0004}
        shadow-normalBias={0.025}
        shadow-radius={4}
      />
      <directionalLight position={[-6, 5, -5]} intensity={0.35} color="#CFDAF0" />
      {lampPos.map((pos, j) => (
        <pointLight
          key={j}
          ref={(l) => {
            lamps.current[j] = l
          }}
          position={pos}
          color={C.lamp}
          intensity={0}
          distance={j === 0 ? 7 : 4.2}
          decay={1.6}
        />
      ))}
      {/* Ground — only the shadow is drawn, so the model sits on the page itself */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.4, 0]} receiveShadow>
        <planeGeometry args={[60, 60]} />
        <shadowMaterial ref={ground} transparent opacity={0.14} color="#5A4630" />
      </mesh>
    </>
  )
}

// ── Environment — local RoomEnvironment, no network fetch ─────────────────
function LocalEnvironment() {
  const get = useThree((s) => s.get)
  useEffect(() => {
    const { gl, scene } = get()
    const pmrem = new THREE.PMREMGenerator(gl)
    const room = new RoomEnvironment()
    const env = pmrem.fromScene(room, 0.04).texture
    scene.environment = env
    scene.environmentIntensity = 0.42
    return () => {
      scene.environment = null
      env.dispose()
      pmrem.dispose()
      room.traverse((o) => {
        const mesh = o as THREE.Mesh
        if (mesh.isMesh) {
          mesh.geometry.dispose()
          const m = mesh.material
          if (Array.isArray(m)) m.forEach((x) => x.dispose())
          else m.dispose()
        }
      })
    }
  }, [get])
  return null
}

// ── The riad ───────────────────────────────────────────────────────────────
function Riad({ progress, rtl, onReady }: { progress: MotionValue<number>; rtl: boolean; onReady: () => void }) {
  const group = useRef<THREE.Group>(null)
  const ring = useRef<THREE.Mesh>(null)
  const readySent = useRef(false)
  const lookTarget = useRef(new THREE.Vector3(0, 0.1, 0))
  const camTarget = useMemo(() => new THREE.Vector3(), [])
  const lookGoal = useMemo(() => new THREE.Vector3(), [])
  const placements = useMemo(() => bedPlacements(), [])
  const guest = useRef<THREE.Group>(null)
  const housekeeper = useRef<THREE.Group>(null)
  const nightPair = useRef<THREE.Group>(null)

  // Shared geometry + materials, disposed on unmount.
  const assets = useMemo(() => {
    const std = (color: string, roughness = 0.9, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) =>
      new THREE.MeshStandardMaterial({ color, roughness, metalness: 0, ...extra })

    const mats = {
      plinth: std(C.plinth, 0.95),
      floor: std(C.floor, 0.85),
      court: std(C.court, 0.7),
      wall: std(C.wall, 0.92),
      wallInner: std(C.wallInner, 0.92),
      arcade: std(C.arcade, 0.88),
      oak: std(C.oak, 0.6),
      pillow: std(C.pillow, 0.95),
      water: std(C.water, 0.06, { metalness: 0.1, envMapIntensity: 1.6, emissive: new THREE.Color(C.poolGlow), emissiveIntensity: 0 }),
      lantern: std(C.lantern, 0.8, { emissive: new THREE.Color(C.lamp), emissiveIntensity: 0 }),
      windowGlow: new THREE.MeshBasicMaterial({ color: C.lamp, transparent: true, opacity: 0, side: THREE.DoubleSide }),
      leaf: std(C.leaf, 0.95),
      trunk: std(C.trunk, 0.9),
      ring: new THREE.MeshBasicMaterial({ color: C.coral, transparent: true, opacity: 0, depthWrite: false }),
      cedar: std(C.cedar, 0.7),
      path: std(C.path, 0.95),
      zelligeBand: std('#2F8A70', 0.5),
    }
    const zellige = zelligeTexture()
    mats.court.map = zellige
    mats.court.color.set('#FFFFFF')

    const winRow = (n: number, span: number) => evenly(n, span).map((x) => ({ x, w: 0.34, spring: 0.72, apex: 0.98, y: 0.42 }))
    const privateDoors = PRIVATE_Z.map((z) => ({ x: -z, w: 0.44, spring: 0.6, apex: 0.86 }))
    const geos = {
      plinth: new THREE.BoxGeometry(10.2, 0.4, 10.2),
      floor: new THREE.BoxGeometry(8.8, 0.04, 8.8),
      court: new THREE.BoxGeometry(3.86, 0.05, 3.86),
      outerNS: wallGeometry(8.98, 1.25, 0.18, [], winRow(5, 8)),
      outerSouth: wallGeometry(8.98, 1.25, 0.18, [{ x: 0, w: 0.72, spring: 0.72, apex: 1.06 }], [...winRow(5, 8)].filter((w) => Math.abs(w.x) > 1)),
      outerEW: wallGeometry(8.98, 1.25, 0.18, [], winRow(5, 8)),
      innerNS: wallGeometry(8.6, 1.18, 0.12, [{ x: -1.2, w: 0.5, spring: 0.6, apex: 0.86 }, { x: 1.2, w: 0.5, spring: 0.6, apex: 0.86 }]),
      innerEW: wallGeometry(5.08, 1.18, 0.12, [{ x: 0, w: 0.5, spring: 0.6, apex: 0.86 }]),
      innerWest: wallGeometry(5.08, 1.18, 0.12, privateDoors),
      partition: wallGeometry(1.7, 1.18, 0.1),
      privateWall: wallGeometry(1.66, 1.18, 0.1),
      window: new THREE.PlaneGeometry(0.38, 0.62),
      lantern: new THREE.BoxGeometry(0.11, 0.14, 0.11),
      nightstand: new THREE.BoxGeometry(0.2, 0.2, 0.2),
      arcade: wallGeometry(4.14, 1.1, 0.16, evenly(3, 4.14).map((x) => ({ x, w: 0.9, spring: 0.62, apex: 0.94 }))),
      tower: new THREE.BoxGeometry(1.86, 2.35, 1.86),
      bedFrame: new THREE.BoxGeometry(0.46, 0.12, 0.94),
      bedFrameDouble: new THREE.BoxGeometry(0.92, 0.12, 1.02),
      blanket: new THREE.BoxGeometry(0.42, 0.07, 0.66),
      blanketDouble: new THREE.BoxGeometry(0.86, 0.07, 0.72),
      pillow: new THREE.BoxGeometry(0.34, 0.06, 0.17),

      rimLong: new THREE.BoxGeometry(2.3, 0.1, 0.15),
      rimShort: new THREE.BoxGeometry(0.15, 0.1, 1.0),
      water: new THREE.BoxGeometry(2.0, 0.04, 1.0),
      planter: new THREE.BoxGeometry(0.56, 0.28, 0.56),
      trunk: new THREE.CylinderGeometry(0.035, 0.05, 0.55, 8),
      leaf: new THREE.SphereGeometry(1, 20, 14),
      desk: new THREE.BoxGeometry(1.0, 0.36, 0.32),
      ring: new THREE.RingGeometry(0.44, 0.5, 48),
      merlons: merlonGeometry(),
      portal: wallGeometry(1.5, 1.62, 0.14, [{ x: 0, w: 0.72, spring: 0.72, apex: 1.06 }]),
      doorLeaf: new THREE.BoxGeometry(0.34, 0.7, 0.04),
      band: new THREE.BoxGeometry(1.1, 0.06, 0.02),
      path: new THREE.BoxGeometry(0.8, 0.02, 0.62),
      post: new THREE.BoxGeometry(0.05, 0.98, 0.05),
      ladder: new THREE.BoxGeometry(0.03, 0.62, 0.12),
      rail: new THREE.BoxGeometry(0.03, 0.08, 0.58),
    }
    return { mats, geos, zellige }
  }, [])

  // One material per bed blanket so each bed can change status independently.
  const blanketMats = useMemo(
    () =>
      Object.fromEntries(
        placements.map((b) => {
          const start: BedStatus =
            b.name === STORY_BOOKED_BED ? 'free' : b.name === STORY_CLEANED_BED ? 'dirty' : FINAL_STATUS[b.name] ?? 'free'
          return [b.name, new THREE.MeshStandardMaterial({ color: BED_COLOR[start], roughness: 0.82, emissive: new THREE.Color('#000000') })]
        }),
      ) as Record<string, THREE.MeshStandardMaterial>,
    [placements],
  )

  useEffect(() => {
    return () => {
      Object.values(assets.geos).forEach((g) => g.dispose())
      Object.values(assets.mats).forEach((m) => m.dispose())
      assets.zellige.dispose()
      Object.values(blanketMats).forEach((m) => m.dispose())
    }
  }, [assets, blanketMats])

  const colors = useMemo(
    () => ({
      free: new THREE.Color(BED_COLOR.free),
      occupied: new THREE.Color(BED_COLOR.occupied),
      dirty: new THREE.Color(BED_COLOR.dirty),
    }),
    [],
  )
  const booked = placements.find((b) => b.name === STORY_BOOKED_BED)!
  const cleaned = placements.find((b) => b.name === STORY_CLEANED_BED)!
  const bedY = (b: BedPlacement) => (b.bunk === 'top' ? BUNK_TOP : 0)

  const { mats, geos } = assets

  useFrame((state, delta) => {
    const p = THREE.MathUtils.clamp(progress.get(), 0, 1)
    const t = state.clock.elapsedTime
    const dt = Math.min(delta, 0.05)

    // Entrance: the model settles onto its plinth, camera eases in.
    const intro = smooth(THREE.MathUtils.clamp(t / 1.8, 0, 1))
    if (group.current) group.current.position.y = (1 - intro) * -0.7

    // Camera
    const k = sampleKeys(p)
    const cam = state.camera as THREE.PerspectiveCamera
    const dist = 1 + (1 - intro) * 0.28
    camTarget.set(k.pos[0] * dist + state.pointer.x * 0.55, k.pos[1] * dist + state.pointer.y * 0.3, k.pos[2] * dist)
    lookGoal.set(k.look[0], k.look[1], k.look[2])
    const lambda = 4.2
    cam.position.x = THREE.MathUtils.damp(cam.position.x, camTarget.x, lambda, dt)
    cam.position.y = THREE.MathUtils.damp(cam.position.y, camTarget.y, lambda, dt)
    cam.position.z = THREE.MathUtils.damp(cam.position.z, camTarget.z, lambda, dt)
    lookTarget.current.lerp(lookGoal, 1 - Math.exp(-lambda * dt))
    cam.lookAt(lookTarget.current)
    // Horizontal framing: keep the model clear of the copy column (mirrored in RTL).
    const shift = 0.22 * k.off * (rtl ? -1 : 1)
    const fov = THREE.MathUtils.damp(cam.fov, k.fov, lambda, dt)
    // three: left += near * filmOffset / filmWidth, so a shift of `s` screen
    // widths needs filmOffset = -s · 2·tan(fov/2) · aspect · filmWidth.
    const film = -shift * 2 * Math.tan(THREE.MathUtils.degToRad(fov) / 2) * cam.aspect * cam.getFilmWidth()
    if (Math.abs(cam.fov - fov) > 1e-4 || Math.abs(cam.filmOffset - film) > 1e-4) {
      cam.fov = fov
      cam.filmOffset = film
      cam.updateProjectionMatrix()
    }

    // Story: A3 gets booked, B2 gets cleaned.
    blanketMats[STORY_BOOKED_BED].color.lerpColors(colors.free, colors.occupied, ramp(p, 0.27, 0.32))
    blanketMats[STORY_CLEANED_BED].color.lerpColors(colors.dirty, colors.free, ramp(p, 0.5, 0.55))

    // Night: lit windows, lanterns and pool lights.
    const night = nightAt(p)
    applyNight(mats, night)

    // Bed legibility at night and in the final top-down view.
    const glow = night * 0.16 + ramp(p, 0.78, 0.92) * 0.2
    for (const name in blanketMats) {
      const m = blanketMats[name]
      m.emissive.copy(m.color).multiplyScalar(glow)
    }

    // Pulse ring on the bed currently in focus.
    if (ring.current) {
      const onBooked = ramp(p, 0.22, 0.27) * (1 - ramp(p, 0.42, 0.46))
      const onCleaned = ramp(p, 0.44, 0.48) * (1 - ramp(p, 0.62, 0.66))
      const target = onBooked > onCleaned ? booked : cleaned
      ring.current.position.set(target.pos[0], 0.24 + bedY(target), target.pos[1])
      const pulse = (t * 0.8) % 1
      const s = 1 + pulse * 0.9
      ring.current.scale.set(s, s, s)
      ;(ring.current.material as THREE.MeshBasicMaterial).opacity = Math.max(onBooked, onCleaned) * (1 - pulse) * 0.9
    }

    // People: a guest walks in through the gate, housekeeping turns over B2,
    // two guests chat by the pool at night.
    if (guest.current) {
      const s = presence(p, -1, 0, 0.2, 0.26)
      const walk = ramp(p, 0.03, 0.18)
      guest.current.visible = s > 0.01
      guest.current.scale.setScalar(Math.max(s, 0.001))
      guest.current.position.set(0, Math.abs(Math.sin(walk * 28)) * 0.025 * (walk > 0 && walk < 1 ? 1 : 0), 5.0 - walk * 1.75)
    }
    if (housekeeper.current) {
      const s = presence(p, 0.42, 0.46, 0.62, 0.66)
      housekeeper.current.visible = s > 0.01
      housekeeper.current.scale.setScalar(Math.max(s, 0.001))
    }
    if (nightPair.current) {
      const s = presence(p, 0.7, 0.75, 1, 1.1)
      nightPair.current.visible = s > 0.01
      nightPair.current.scale.setScalar(Math.max(s, 0.001))
    }

    // Nothing that casts shadows moves after the entrance: freeze the shadow
    // map instead of re-rendering a full shadow pass every frame.
    if (intro >= 1 && state.gl.shadowMap.autoUpdate) {
      state.gl.shadowMap.autoUpdate = false
      state.gl.shadowMap.needsUpdate = true
    }

    if (!readySent.current) {
      readySent.current = true
      onReady()
    }
  })

  const tree = (x: number, z: number, s = 1) => (
    <group position={[x, 0, z]} scale={s}>
      <mesh geometry={geos.planter} material={mats.wall} position={[0, 0.14, 0]} castShadow receiveShadow />
      <mesh geometry={geos.trunk} material={mats.trunk} position={[0, 0.55, 0]} castShadow />
      {(
        [
          [0, 0.98, 0, 0.3],
          [0.2, 0.88, 0.1, 0.22],
          [-0.18, 0.9, -0.06, 0.24],
          [0.06, 1.12, -0.14, 0.2],
          [-0.08, 1.1, 0.16, 0.18],
        ] as const
      ).map(([lx, ly, lz, r], i) => (
        <mesh key={i} geometry={geos.leaf} material={mats.leaf} position={[lx, ly, lz]} scale={r} castShadow />
      ))}
    </group>
  )

  return (
    <group ref={group}>
      {/* Plinth + floors */}
      <mesh geometry={geos.plinth} material={mats.plinth} position={[0, -0.2, 0]} receiveShadow castShadow />
      <mesh geometry={geos.floor} material={mats.floor} position={[0, 0.02, 0]} receiveShadow />
      <mesh geometry={geos.court} material={mats.court} position={[0, 0.045, 0]} receiveShadow />

      {/* Outer walls */}
      <mesh geometry={geos.outerNS} material={mats.wall} position={[0, 0, -4.4]} castShadow receiveShadow />
      <mesh geometry={geos.outerSouth} material={mats.wall} position={[0, 0, 4.4]} castShadow receiveShadow />
      <mesh geometry={geos.outerEW} material={mats.wall} position={[4.4, 0, 0]} rotation={[0, Math.PI / 2, 0]} castShadow receiveShadow />
      <mesh geometry={geos.outerEW} material={mats.wall} position={[-4.4, 0, 0]} rotation={[0, Math.PI / 2, 0]} castShadow receiveShadow />

      {/* Crenellated roofline (outer walls, tower, gate) */}
      <mesh geometry={geos.merlons} material={mats.wall} castShadow receiveShadow />

      {/* Entrance gate: raised portal, zellige band, cedar doors swung open, lanterns, path */}
      <group>
        <mesh geometry={geos.portal} material={mats.arcade} position={[0, 0, 4.56]} castShadow receiveShadow />
        <mesh geometry={geos.band} material={mats.zelligeBand} position={[0, 1.3, 4.64]} />
        <group position={[-0.36, 0.04, 4.3]} rotation={[0, 1.15, 0]}>
          <mesh geometry={geos.doorLeaf} material={mats.cedar} position={[0.17, 0.35, 0]} castShadow />
        </group>
        <group position={[0.36, 0.04, 4.3]} rotation={[0, -1.15, 0]}>
          <mesh geometry={geos.doorLeaf} material={mats.cedar} position={[-0.17, 0.35, 0]} castShadow />
        </group>
        <mesh geometry={geos.lantern} material={mats.lantern} position={[-0.6, 0.98, 4.68]} />
        <mesh geometry={geos.lantern} material={mats.lantern} position={[0.6, 0.98, 4.68]} />
        <mesh geometry={geos.path} material={mats.path} position={[0, 0.01, 4.8]} receiveShadow />
      </group>

      {/* Window glow — sits inside the wall thickness, visible only through the openings */}
      {evenly(5, 8).map((x) => (
        <group key={x}>
          <mesh geometry={geos.window} material={mats.windowGlow} position={[x, 0.71, -4.4]} />
          {Math.abs(x) > 1 && <mesh geometry={geos.window} material={mats.windowGlow} position={[x, 0.71, 4.4]} />}
          <mesh geometry={geos.window} material={mats.windowGlow} position={[4.4, 0.71, -x]} rotation={[0, Math.PI / 2, 0]} />
          <mesh geometry={geos.window} material={mats.windowGlow} position={[-4.4, 0.71, -x]} rotation={[0, Math.PI / 2, 0]} />
        </group>
      ))}

      {/* Inner room walls with arched doors */}
      <mesh geometry={geos.innerNS} material={mats.wallInner} position={[0, 0, -2.6]} castShadow receiveShadow />
      <mesh geometry={geos.innerNS} material={mats.wallInner} position={[0, 0, 2.6]} castShadow receiveShadow />
      <mesh geometry={geos.innerEW} material={mats.wallInner} position={[2.6, 0, 0]} rotation={[0, Math.PI / 2, 0]} castShadow receiveShadow />
      <mesh geometry={geos.innerWest} material={mats.wallInner} position={[-2.6, 0, 0]} rotation={[0, Math.PI / 2, 0]} castShadow receiveShadow />
      {/* Private rooms: walls between the three west-wing rooms */}
      {[-0.865, 0.865].map((z) => (
        <mesh key={z} geometry={geos.privateWall} material={mats.wallInner} position={[-3.48, 0, z]} castShadow receiveShadow />
      ))}
      {/* Partitions: reception | entrance | Dortoir C, and the corner tower bay */}
      <mesh geometry={geos.partition} material={mats.wallInner} position={[-1.0, 0, 3.45]} rotation={[0, Math.PI / 2, 0]} castShadow receiveShadow />
      <mesh geometry={geos.partition} material={mats.wallInner} position={[1.0, 0, 3.45]} rotation={[0, Math.PI / 2, 0]} castShadow receiveShadow />

      {/* Courtyard arcade */}
      <mesh geometry={geos.arcade} material={mats.arcade} position={[0, 0, -2.0]} castShadow receiveShadow />
      <mesh geometry={geos.arcade} material={mats.arcade} position={[0, 0, 2.0]} castShadow receiveShadow />
      <mesh geometry={geos.arcade} material={mats.arcade} position={[2.0, 0, 0]} rotation={[0, Math.PI / 2, 0]} castShadow receiveShadow />
      <mesh geometry={geos.arcade} material={mats.arcade} position={[-2.0, 0, 0]} rotation={[0, Math.PI / 2, 0]} castShadow receiveShadow />

      {/* Lanterns on the arcade corners */}
      {(
        [
          [2, 2],
          [2, -2],
          [-2, 2],
          [-2, -2],
        ] as const
      ).map(([x, z]) => (
        <mesh key={`${x}${z}`} geometry={geos.lantern} material={mats.lantern} position={[x, 1.17, z]} castShadow />
      ))}

      {/* Corner tower with roof-terrace parapet */}
      <group position={[-3.45, 0, -3.45]}>
        <mesh geometry={geos.tower} material={mats.wall} position={[0, 1.175, 0]} castShadow receiveShadow />
      </group>

      {/* Pool */}
      <group position={[0, 0.05, 0]}>
        <mesh geometry={geos.water} material={mats.water} position={[0, 0.035, 0]} receiveShadow />
        <mesh geometry={geos.rimLong} material={mats.plinth} position={[0, 0.03, -0.575]} castShadow receiveShadow />
        <mesh geometry={geos.rimLong} material={mats.plinth} position={[0, 0.03, 0.575]} castShadow receiveShadow />
        <mesh geometry={geos.rimShort} material={mats.plinth} position={[-1.075, 0.03, 0]} castShadow receiveShadow />
        <mesh geometry={geos.rimShort} material={mats.plinth} position={[1.075, 0.03, 0]} castShadow receiveShadow />
      </group>

      {/* Olive trees */}
      {tree(1.35, -1.3)}
      {tree(-1.4, 1.35, 0.85)}

      {/* Reception desk */}
      <mesh geometry={geos.desk} material={mats.plinth} position={[-2.2, 0.2, 3.5]} castShadow receiveShadow />

      {/* Beds */}
      {placements.map((b) =>
        b.double ? (
          <group key={b.name} position={[b.pos[0], 0.04, b.pos[1]]} rotation={[0, b.rotY, 0]}>
            <mesh geometry={geos.bedFrameDouble} material={mats.oak} position={[0, 0.06, 0]} castShadow receiveShadow />
            <mesh geometry={geos.blanketDouble} material={blanketMats[b.name]} position={[0, 0.15, 0.13]} castShadow receiveShadow />
            <mesh geometry={geos.pillow} material={mats.pillow} position={[-0.21, 0.15, -0.36]} castShadow />
            <mesh geometry={geos.pillow} material={mats.pillow} position={[0.21, 0.15, -0.36]} castShadow />
            <mesh geometry={geos.nightstand} material={mats.oak} position={[-0.62, 0.1, -0.36]} castShadow receiveShadow />
            <mesh geometry={geos.nightstand} material={mats.oak} position={[0.62, 0.1, -0.36]} castShadow receiveShadow />
          </group>
        ) : (
          <group key={b.name} position={[b.pos[0], 0.04 + bedY(b), b.pos[1]]} rotation={[0, b.rotY, 0]}>
            <mesh geometry={geos.bedFrame} material={mats.oak} position={[0, 0.06, 0]} castShadow receiveShadow />
            <mesh geometry={geos.blanket} material={blanketMats[b.name]} position={[0, 0.15, 0.12]} castShadow receiveShadow />
            <mesh geometry={geos.pillow} material={mats.pillow} position={[0, 0.15, -0.34]} castShadow />
            {b.bunk === 'bottom' && (
              <>
                {(
                  [
                    [-0.21, -0.45],
                    [0.21, -0.45],
                    [-0.21, 0.45],
                    [0.21, 0.45],
                  ] as const
                ).map(([x, z]) => (
                  <mesh key={`${x}${z}`} geometry={geos.post} material={mats.oak} position={[x, 0.45, z]} castShadow />
                ))}
                <mesh geometry={geos.ladder} material={mats.oak} position={[0.25, 0.42, 0.3]} castShadow />
              </>
            )}
            {b.bunk === 'top' && <mesh geometry={geos.rail} material={mats.oak} position={[0.22, 0.2, 0.05]} castShadow />}
          </group>
        ),
      )}

      {/* People */}
      <group ref={guest} position={[0, 0, 5.0]} rotation={[0, Math.PI, 0]}>
        <Figure color="#3E6FA3" suitcase />
      </group>
      <group ref={housekeeper} position={[3.0, 0.04, cleaned.pos[1] + 0.02]}>
        <Figure color={C.coral} skin="#A97A57" cart />
      </group>
      <group ref={nightPair} position={[-0.45, 0.06, 0.85]}>
        <Figure color="#C9845A" rotation={[0, 0.9, 0]} />
        <Figure color="#E8E1D4" skin="#8D6446" position={[0.4, 0, 0.12]} rotation={[0, -2.1, 0]} />
      </group>

      <mesh ref={ring} geometry={geos.ring} material={mats.ring} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.32, 0]} renderOrder={2} />
    </group>
  )
}

export default function LivingPropertyScene({
  progress,
  rtl,
  active,
  onReady,
}: {
  progress: MotionValue<number>
  rtl: boolean
  active: boolean
  onReady: () => void
}) {
  return (
    <Canvas
      shadows="soft"
      dpr={[1, 1.75]}
      frameloop={active ? 'always' : 'never'}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      camera={{ fov: 26, near: 0.5, far: 80, position: [13, 11, 15] }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.NeutralToneMapping
        gl.toneMappingExposure = 1.02
        gl.setClearColor(0x000000, 0)
      }}
      aria-hidden="true"
    >
      <LocalEnvironment />
      <Lighting progress={progress} />
      <Riad progress={progress} rtl={rtl} onReady={onReady} />
    </Canvas>
  )
}
