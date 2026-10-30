import { lazy, Suspense } from 'react'
import { useKeyboardInput } from './input/useKeyboardInput.ts'
import DebugOverlay from './ui/DebugOverlay.tsx'
import Loader from './ui/Loader.tsx'
import ViewControls from './ui/ViewControls.tsx'

// The 3D scene (three, drei, r3f, the model code) is a separate chunk, so the page and the loader
// overlay paint before it arrives.
const Scene = lazy(() => import('./scene/Scene.tsx'))

export default function App() {
  useKeyboardInput()
  return (
    <>
      <Suspense fallback={null}>
        <Scene />
      </Suspense>
      <ViewControls />
      <Loader />
      {import.meta.env.DEV && <DebugOverlay />}
    </>
  )
}
