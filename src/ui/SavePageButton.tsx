import { useEffect, useRef, useState } from 'react'
import { requestSavePage } from '../input/savePage.ts'
import { hasInk } from '../lib/pageExport.ts'
import { useTypewriterStore } from '../store/typewriterStore.ts'
import { BUTTON_STYLE } from './buttonStyle.ts'

const SAVED_MS = 1500

// Bottom left, top of the stack. Dimmed and inert on an empty page and while a sheet swap runs.
export default function SavePageButton() {
  const canSave = useTypewriterStore((s) => s.swap === 'idle' && hasInk(s.lines))
  const [saved, setSaved] = useState(false)
  const timer = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(timer.current), [])

  return (
    <button
      type="button"
      aria-disabled={!canSave}
      onClick={(e) => {
        e.currentTarget.blur()
        if (!canSave) return
        void requestSavePage().then((started) => {
          if (!started) return
          setSaved(true)
          window.clearTimeout(timer.current)
          timer.current = window.setTimeout(() => setSaved(false), SAVED_MS)
        })
      }}
      style={{
        ...BUTTON_STYLE,
        position: 'fixed',
        left: 16,
        bottom: 96,
        opacity: canSave ? 1 : 0.5,
        cursor: canSave ? 'pointer' : 'default',
      }}
    >
      {saved ? 'Saved' : 'Save page'}
    </button>
  )
}
