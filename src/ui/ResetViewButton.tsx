import { useCameraUi } from './cameraUi.ts'

// Offered only after the user has moved the camera. Matches the loader's palette.
export default function ResetViewButton() {
  const orbited = useCameraUi((s) => s.orbited)
  const requestReset = useCameraUi((s) => s.requestReset)

  return (
    <button
      type="button"
      aria-hidden={!orbited}
      tabIndex={orbited ? 0 : -1}
      onClick={(e) => {
        requestReset()
        // Keep focus off the button so Space and Enter go on typing, not on pressing it again.
        e.currentTarget.blur()
      }}
      style={{
        position: 'fixed',
        right: 16,
        bottom: 16,
        padding: '8px 12px',
        font: '12px/1 ui-monospace, Menlo, monospace',
        letterSpacing: '0.08em',
        color: '#4a5046',
        background: 'rgba(232, 226, 214, 0.85)',
        border: '1px solid rgba(74, 80, 70, 0.35)',
        borderRadius: 6,
        cursor: 'pointer',
        opacity: orbited ? 1 : 0,
        pointerEvents: orbited ? 'auto' : 'none',
        transition: 'opacity 0.3s ease',
      }}
    >
      Reset view
    </button>
  )
}
