import { useEffect, type ReactNode } from 'react'
import { BUTTON_STYLE } from './buttonStyle.ts'
import { useCameraUi } from './cameraUi.ts'

// Matches the loader's palette. The fade-in is skipped with reduced motion.
const CSS = `
@keyframes view-button-in { from { opacity: 0 } to { opacity: 1 } }
.view-button { animation: view-button-in 0.3s ease }
@media (prefers-reduced-motion: reduce) { .view-button { animation: none } }
`

function ViewButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      className="view-button"
      onClick={(e) => {
        onClick()
        // Keep focus off the button so Space and Enter go on typing, not on pressing it again.
        e.currentTarget.blur()
      }}
      style={BUTTON_STYLE}
    >
      {children}
    </button>
  )
}

// Camera view buttons, in the dock (bottom right on desktop). "Writing view" is offered in the overview (it flies to the
// strike point, same as a click on the carriage); "Reset view" once the view has moved. Esc does
// what Reset view does.
export default function ViewControls() {
  const orbited = useCameraUi((s) => s.orbited)
  const mode = useCameraUi((s) => s.mode)
  const requestReset = useCameraUi((s) => s.requestReset)
  const requestWriting = useCameraUi((s) => s.requestWriting)

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.repeat) return
      const { orbited: moved, mode: current } = useCameraUi.getState()
      if (moved || current === 'writing') useCameraUi.getState().requestReset()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  return (
    <div role="group" aria-label="Camera view" className="dock-camera">
      <style>{CSS}</style>
      {mode === 'overview' && <ViewButton onClick={requestWriting}>Writing view</ViewButton>}
      {orbited && <ViewButton onClick={requestReset}>Reset view</ViewButton>}
    </div>
  )
}
