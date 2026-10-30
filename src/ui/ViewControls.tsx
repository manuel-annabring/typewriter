import { useEffect, type ReactNode } from 'react'
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
      style={{
        padding: '8px 12px',
        font: '12px/1 ui-monospace, Menlo, monospace',
        letterSpacing: '0.08em',
        color: '#4a5046',
        background: 'rgba(232, 226, 214, 0.85)',
        border: '1px solid rgba(74, 80, 70, 0.35)',
        borderRadius: 6,
        cursor: 'pointer',
      }}
    >
      {children}
    </button>
  )
}

// Camera view buttons, bottom right. "Writing view" is offered in the overview (it flies to the
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
    <div role="group" aria-label="Camera view" style={{ position: 'fixed', right: 16, bottom: 16, display: 'flex', gap: 8 }}>
      <style>{CSS}</style>
      {mode === 'overview' && <ViewButton onClick={requestWriting}>Writing view</ViewButton>}
      {orbited && <ViewButton onClick={requestReset}>Reset view</ViewButton>}
    </div>
  )
}
