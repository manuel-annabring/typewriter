import { useTypewriterStore } from '../store/typewriterStore.ts'

// Slice 2 debug view of the store. Dev only.
export default function DebugOverlay() {
  const pressedKeys = useTypewriterStore((s) => s.pressedKeys)
  const lastChar = useTypewriterStore((s) => s.lastChar)
  const log = useTypewriterStore((s) => s.log)
  const status = useTypewriterStore((s) => s.status)
  const cursor = useTypewriterStore((s) => s.cursor)
  const carriageOffset = useTypewriterStore((s) => s.carriageOffset)

  return (
    <pre
      style={{
        position: 'fixed',
        top: 12,
        left: 12,
        margin: 0,
        padding: '8px 10px',
        font: '12px/1.4 ui-monospace, monospace',
        color: '#e8e4d8',
        background: 'rgba(20, 20, 20, 0.7)',
        borderRadius: 6,
        pointerEvents: 'none',
        userSelect: 'none',
      }}
    >
      {`status:   ${status}
cursor:   row ${cursor.row}, col ${cursor.col}
carriage: ${carriageOffset}
last:     ${lastChar === null ? '-' : JSON.stringify(lastChar)}
pressed:  ${pressedKeys.length ? pressedKeys.join(' ') : '-'}
log:
${log.length ? log.map((l) => `  ${l}`).join('\n') : '  -'}`}
    </pre>
  )
}
