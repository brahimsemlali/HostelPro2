'use client'

// ─────────────────────────────────────────────────────────────────────────────
// Property-types turntable: four clay buildings (Higgsfield image → 3D, served
// from /public/landing/3d, so the 'self' CSP is respected) stand on a round
// plinth facing outward. Selecting a type turns the plinth until that building
// faces the camera; the one behind is hidden, so the generated models' unseen
// backs never show. Lazy-loaded on capable desktops only.
// ─────────────────────────────────────────────────────────────────────────────

import { Suspense, useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'

const MODELS = ['/landing/3d/hostel.glb', '/landing/3d/riad.glb', '/landing/3d/surf.glb', '/landing/3d/guesthouse.glb']
/** Extra yaw per model so its best (generated) facade looks outward. */
const FACING = [0, 0, 0, 0]
const RADIUS = 1.45
const STEP = (Math.PI * 2) / MODELS.length

function LocalEnvironment() {
  const get = useThree((s) => s.get)
  useEffect(() => {
    const { gl, scene } = get()
    const pmrem = new THREE.PMREMGenerator(gl)
    const room = new RoomEnvironment()
    const env = pmrem.fromScene(room, 0.04).texture
    scene.environment = env
    scene.environmentIntensity = 0.55
    return () => {
      scene.environment = null
      env.dispose()
      pmrem.dispose()
    }
  }, [get])
  return null
}

/** Clone each model, normalise its size, sit it on y=0 and give it a clay finish. */
function prepare(gltf: { scene: THREE.Group }) {
  const root = gltf.scene.clone(true)
  const box = new THREE.Box3().setFromObject(root)
  const size = box.getSize(new THREE.Vector3())
  const centre = box.getCenter(new THREE.Vector3())
  const s = 1.3 / Math.max(size.x, size.z)
  root.position.set(-centre.x * s, -box.min.y * s, -centre.z * s)
  root.scale.setScalar(s)
  root.traverse((o) => {
    const mesh = o as THREE.Mesh
    if (!mesh.isMesh) return
    mesh.castShadow = true
    mesh.receiveShadow = true
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    for (const m of mats) {
      const sm = m as THREE.MeshStandardMaterial
      if (sm.isMeshStandardMaterial) {
        sm.metalness = 0
        sm.roughness = 0.82
        sm.envMapIntensity = 0.7
      }
    }
  })
  const holder = new THREE.Group()
  holder.add(root)
  return holder
}

function Turntable({ active, rtl, onReady }: { active: number; rtl: boolean; onReady: () => void }) {
  const gltfs = useLoader(GLTFLoader, MODELS)
  const models = useMemo(() => gltfs.map(prepare), [gltfs])
  const plate = useRef<THREE.Group>(null)
  const slots = useRef<(THREE.Group | null)[]>([])
  const angle = useRef(0)
  const target = useRef(0)
  const last = useRef(active)
  const sent = useRef(false)

  // Turn the shortest way to the selected building.
  useEffect(() => {
    let d = (active - last.current) * STEP
    d = Math.atan2(Math.sin(d), Math.cos(d))
    target.current -= d * (rtl ? -1 : 1)
    last.current = active
  }, [active, rtl])

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05)
    angle.current = THREE.MathUtils.damp(angle.current, target.current, 3.2, dt)
    const sway = Math.sin(state.clock.elapsedTime * 0.35) * 0.16
    if (plate.current) {
      plate.current.rotation.y = angle.current + sway + state.pointer.x * 0.12
      plate.current.rotation.x = THREE.MathUtils.damp(plate.current.rotation.x, -state.pointer.y * 0.05, 3, dt)
    }
    // Front building full size, neighbours smaller, the one behind hidden.
    slots.current.forEach((g, k) => {
      if (!g) return
      const world = k * STEP * (rtl ? -1 : 1) + angle.current
      const facing = Math.cos(world)
      const goal = k === active ? 1 : facing < -0.2 ? 0 : 0.55
      const sc = THREE.MathUtils.damp(g.scale.x, goal, 6, dt)
      g.scale.setScalar(Math.max(sc, 0.0001))
      g.visible = sc > 0.02
    })
    if (!sent.current) {
      sent.current = true
      onReady()
    }
  })

  useEffect(
    () => () => {
      for (const m of models)
        m.traverse((o) => {
          const mesh = o as THREE.Mesh
          if (mesh.isMesh) mesh.geometry.dispose()
        })
    },
    [models],
  )

  return (
    <group ref={plate}>
      <mesh position={[0, -0.04, 0]} receiveShadow>
        <cylinderGeometry args={[RADIUS + 0.75, RADIUS + 0.8, 0.08, 96]} />
        <meshStandardMaterial color="#EDE6DA" roughness={0.92} />
      </mesh>
      {models.map((m, k) => {
        const a = k * STEP * (rtl ? -1 : 1)
        return (
          <group
            key={MODELS[k]}
            ref={(g) => {
              slots.current[k] = g
            }}
            position={[Math.sin(a) * RADIUS, 0, Math.cos(a) * RADIUS]}
            rotation={[0, a + FACING[k], 0]}
          >
            <primitive object={m} />
          </group>
        )
      })}
    </group>
  )
}

export default function ClayTurntable({
  active,
  running,
  rtl,
  onReady,
}: {
  active: number
  running: boolean
  rtl: boolean
  onReady: () => void
}) {
  return (
    <Canvas
      shadows="soft"
      dpr={[1, 1.75]}
      frameloop={running ? 'always' : 'never'}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      camera={{ fov: 30, near: 0.1, far: 50, position: [0, 2.4, RADIUS + 5.6] }}
      onCreated={({ gl, camera }) => {
        gl.toneMapping = THREE.NeutralToneMapping
        gl.toneMappingExposure = 0.98
        gl.setClearColor(0x000000, 0)
        camera.lookAt(0, 0.35, RADIUS * 0.35)
      }}
      aria-hidden="true"
    >
      <LocalEnvironment />
      <hemisphereLight args={['#FFFFFF', '#D9CDBA', 0.9]} />
      <directionalLight
        position={[3.5, 6, 4.5]}
        intensity={1.8}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-4}
        shadow-camera-right={4}
        shadow-camera-top={4}
        shadow-camera-bottom={-4}
        shadow-bias={-0.0005}
        shadow-normalBias={0.03}
        shadow-radius={5}
      />
      <Suspense fallback={null}>
        <Turntable active={active} rtl={rtl} onReady={onReady} />
      </Suspense>
    </Canvas>
  )
}
