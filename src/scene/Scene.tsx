import { ContactShadows, Environment, Lightformer, OrbitControls, StatsGl } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { Suspense } from 'react'
import { Typewriter } from '../typewriter/Typewriter.tsx'

// Lightformer panels of the environment. The map has no parallax, so a position is really a
// direction from the machine. Metal shows only what it reflects: a direction no panel covers
// reflects the dim backdrop, so keep panels on every side, including the camera side (front).
interface Panel {
  name: string
  form: 'rect' | 'ring'
  intensity: number
  color?: string
  position: [number, number, number]
  scale: number | [number, number, number]
  rotation: [number, number, number]
}
const PANELS: Panel[] = [
  { name: 'top', form: 'rect', intensity: 3, position: [0, 4, -1], scale: [8, 4, 1], rotation: [Math.PI / 2, 0, 0] },
  { name: 'left', form: 'rect', intensity: 2, color: '#fff1dc', position: [-4, 1.5, 2], scale: [3, 5, 1], rotation: [0, Math.PI / 2, 0] },
  { name: 'right', form: 'rect', intensity: 1.2, color: '#dfe8ff', position: [4, 1, 1], scale: [3, 4, 1], rotation: [0, -Math.PI / 2, 0] },
  { name: 'front', form: 'rect', intensity: 1.5, color: '#fff6e8', position: [0, 1.5, 5], scale: [8, 3, 1], rotation: [0, Math.PI, 0] },
  { name: 'floor', form: 'rect', intensity: 0.5, color: '#e8d9c0', position: [0, -2, 0], scale: [8, 8, 1], rotation: [-Math.PI / 2, 0, 0] },
  { name: 'ring', form: 'ring', intensity: 1, position: [0, 0.5, -4], scale: 4, rotation: [0, 0, 0] },
]

// Dev only: FPS, frame time and GPU time (stats-gl) in the top-right corner. `?noshadow` leaves
// ContactShadows out so its cost can be compared without editing code.
const SHOW_STATS = import.meta.env.DEV
const SHADOWS = !(import.meta.env.DEV && new URLSearchParams(window.location.search).has('noshadow'))

// <Canvas> creates the WebGL renderer, a three.js Scene and a default camera,
// and runs the render loop. Everything inside it is a three.js object written
// as JSX: <group> becomes THREE.Group, <ambientLight /> becomes THREE.AmbientLight.
// The model is in meters, so the camera sits about half a meter from the machine.
export default function Scene() {
  return (
    <Canvas camera={{ position: [0.35, 0.4, 0.55], fov: 40, near: 0.01, far: 20 }}>
      <color attach="background" args={['#e8e2d6']} />
      <ambientLight intensity={0.1} />
      <directionalLight position={[0.5, 1, 0.8]} intensity={2} />
      {/* Metal reflects its surroundings, so without an environment map it renders black.
          This one is built from Lightformers (glowing panels drawn into a small cube map
          once), so it needs no downloaded HDRI. It lights materials only; the background
          stays the flat <color> above. */}
      <Environment frames={1} resolution={256} environmentIntensity={0.4}>
        {/* Dim backdrop: directions no panel covers reflect this instead of pure black. */}
        <color attach="background" args={['#6b6660']} />
        {PANELS.map((panel) => (
          <Lightformer
            key={panel.name}
            form={panel.form}
            intensity={panel.intensity}
            color={panel.color}
            position={panel.position}
            scale={panel.scale}
            rotation={panel.rotation}
          />
        ))}
      </Environment>
      {/* The GLB loads asynchronously: useGLTF suspends until it is ready. The
          loading overlay (ui/Loader) is HTML, so the fallback here is empty. */}
      <Suspense fallback={null}>
        <Typewriter />
      </Suspense>
      {/* Ground shadow: ContactShadows renders the scene's depth from below the floor into a
          blurred, transparent texture on a plane at y = 0 (the machine sits on it), so the
          flat background colour shows through. No shadow map or light needed. It re-renders
          every frame so the sliding carriage and pressed keys move the shadow too; the
          resolution is low because the blur hides the detail. */}
      {SHADOWS && (
        <ContactShadows
          position={[0, 0, 0]}
          scale={1}
          far={0.25}
          resolution={512}
          blur={2.5}
          opacity={1.2}
          color="#2b2118"
        />
      )}
      {SHOW_STATS && <StatsGl className="dev-stats" />}
      {/* OrbitControls (from drei) lets you drag to rotate, scroll to zoom and
          right-drag to pan the camera around a target point. */}
      <OrbitControls makeDefault target={[0.05, 0.12, 0]} />
    </Canvas>
  )
}
