import { useEffect } from 'react'
import { useTypewriterStore } from '../store/typewriterStore.ts'
import { useCameraUi } from './cameraUi.ts'

/** The hint appears once this many characters are printed, so there is something worth reading. */
const NUDGE_AFTER_CHARS = 15
/** ...and goes away by itself after this long (ms). */
const NUDGE_MS = 10_000

const CSS = `
.writing-nudge { transition: opacity 0.4s ease }
@media (prefers-reduced-motion: reduce) { .writing-nudge { transition: none } }
`

// A one-time hint toward the writing view, taught when the text has become hard to read from the
// overview. It never moves the camera itself. Gone for good once the writing view was used, or
// after NUDGE_MS.
export default function WritingNudge() {
  const printed = useTypewriterStore((s) => s.lastPrint?.seq ?? 0)
  const mode = useCameraUi((s) => s.mode)
  const usedWriting = useCameraUi((s) => s.usedWriting)
  const dismissed = useCameraUi((s) => s.nudgeDismissed)
  const dismissNudge = useCameraUi((s) => s.dismissNudge)

  const show = printed >= NUDGE_AFTER_CHARS && mode === 'overview' && !usedWriting && !dismissed

  useEffect(() => {
    if (!show) return
    const id = window.setTimeout(dismissNudge, NUDGE_MS)
    return () => window.clearTimeout(id)
  }, [show, dismissNudge])

  return (
    <div
      className="writing-nudge"
      aria-hidden={!show}
      style={{
        position: 'fixed',
        left: '50%',
        bottom: 64,
        transform: 'translateX(-50%)',
        maxWidth: 'calc(100vw - 32px)',
        padding: '8px 12px',
        font: '12px/1.4 ui-monospace, Menlo, monospace',
        letterSpacing: '0.04em',
        textAlign: 'center',
        color: '#4a5046',
        background: 'rgba(232, 226, 214, 0.85)',
        border: '1px solid rgba(74, 80, 70, 0.35)',
        borderRadius: 6,
        opacity: show ? 1 : 0,
        pointerEvents: 'none',
      }}
    >
      <style>{CSS}</style>
      Click the paper, or use Writing view, to read what you type
    </div>
  )
}
