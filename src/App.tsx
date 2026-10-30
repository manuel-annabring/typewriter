import { lazy, Suspense } from 'react'
import { useAudioUnlock } from './audio/useAudioUnlock.ts'
import { useKeyboardInput } from './input/useKeyboardInput.ts'
import DebugOverlay from './ui/DebugOverlay.tsx'
import Loader from './ui/Loader.tsx'
import ViewControls from './ui/ViewControls.tsx'
import WritingNudge from './ui/WritingNudge.tsx'

// The 3D scene (three, drei, r3f, the model code) is a separate chunk, so the page and the loader
// overlay paint before it arrives.
const Scene = lazy(() => import('./scene/Scene.tsx'))

export default function App() {
  useKeyboardInput()
  useAudioUnlock()
  return (
    <>
      <Suspense fallback={null}>
        <Scene />
      </Suspense>
      <ViewControls />
      <WritingNudge />
      <Loader />
      {import.meta.env.DEV && <DebugOverlay />}
    </>
  )
}
