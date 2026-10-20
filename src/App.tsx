import { useKeyboardInput } from './input/useKeyboardInput.ts'
import Scene from './scene/Scene.tsx'
import DebugOverlay from './ui/DebugOverlay.tsx'
import Loader from './ui/Loader.tsx'

export default function App() {
  useKeyboardInput()
  return (
    <>
      <Scene />
      <Loader />
      {import.meta.env.DEV && <DebugOverlay />}
    </>
  )
}
