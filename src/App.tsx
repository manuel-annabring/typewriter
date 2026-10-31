import { lazy, Suspense } from 'react'
import { useAudioUnlock } from './audio/useAudioUnlock.ts'
import { useKeyboardInput } from './input/useKeyboardInput.ts'
import DebugOverlay from './ui/DebugOverlay.tsx'
import Dock from './ui/Dock.tsx'
import Loader from './ui/Loader.tsx'
import SceneErrorBoundary from './ui/SceneErrorBoundary.tsx'
import WritingNudge from './ui/WritingNudge.tsx'

// The 3D scene (three, drei, r3f, the model code) is a separate chunk, so the page and the loader
// overlay paint before it arrives.
const Scene = lazy(() => import('./scene/Scene.tsx'))

export default function App() {
  useKeyboardInput()
  useAudioUnlock()
  return (
    <SceneErrorBoundary>
      <Suspense fallback={null}>
        <Scene />
      </Suspense>
      <Dock />
      <WritingNudge />
      <Loader />
      {import.meta.env.DEV && <DebugOverlay />}
    </SceneErrorBoundary>
  )
}
