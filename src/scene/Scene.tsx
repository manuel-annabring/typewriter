import { OrbitControls } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { Suspense } from 'react'
import { Typewriter } from '../typewriter/Typewriter.tsx'

// <Canvas> creates the WebGL renderer, a three.js Scene and a default camera,
// and runs the render loop. Everything inside it is a three.js object written
// as JSX: <group> becomes THREE.Group, <ambientLight /> becomes THREE.AmbientLight.
// The model is in meters, so the camera sits about half a meter from the machine.
export default function Scene() {
  return (
    <Canvas camera={{ position: [0.35, 0.4, 0.55], fov: 40, near: 0.01, far: 20 }}>
      <color attach="background" args={['#e8e2d6']} />
      <ambientLight intensity={0.6} />
      <directionalLight position={[0.5, 1, 0.8]} intensity={2.5} />
      {/* The GLB loads asynchronously: useGLTF suspends until it is ready. The
          loading overlay (ui/Loader) is HTML, so the fallback here is empty. */}
      <Suspense fallback={null}>
        <Typewriter />
      </Suspense>
      {/* OrbitControls (from drei) lets you drag to rotate, scroll to zoom and
          right-drag to pan the camera around a target point. */}
      <OrbitControls makeDefault target={[0.05, 0.12, 0]} />
    </Canvas>
  )
}
