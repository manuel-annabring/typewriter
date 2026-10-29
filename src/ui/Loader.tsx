import { useLoadProgress } from './loadProgress.ts'

// Painted before the 3D chunk arrives; the scene reports progress through useLoadProgress.
export default function Loader() {
  const progress = useLoadProgress((s) => s.progress)
  const done = progress >= 100

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        display: 'grid',
        placeItems: 'center',
        background: '#e8e2d6',
        color: '#4a5046',
        font: '14px/1 ui-monospace, Menlo, monospace',
        letterSpacing: '0.08em',
        opacity: done ? 0 : 1,
        pointerEvents: done ? 'none' : 'auto',
        transition: 'opacity 0.4s ease',
      }}
    >
      Loading {Math.round(progress)}%
    </div>
  )
}
