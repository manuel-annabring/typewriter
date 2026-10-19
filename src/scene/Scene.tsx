import { OrbitControls } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'

// <Canvas> creates the WebGL renderer, a three.js Scene and a default camera,
// and runs the render loop. Everything inside it is a three.js object written
// as JSX: <mesh> becomes THREE.Mesh, <boxGeometry /> becomes THREE.BoxGeometry.
export default function Scene() {
  return (
    <Canvas camera={{ position: [2, 1.5, 3], fov: 45 }}>
      <color attach="background" args={['#e8e2d6']} />
      <ambientLight intensity={0.5} />
      <directionalLight position={[3, 5, 2]} intensity={2} />
      <mesh>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#9caf88" />
      </mesh>
      {/* OrbitControls (from drei) lets you drag to rotate, scroll to zoom and
          right-drag to pan the camera around a target point. */}
      <OrbitControls makeDefault />
    </Canvas>
  )
}
