import { useEffect } from 'react'
import { keyNameFromEvent } from '../lib/keymap.ts'
import { pressKey, releaseKey } from './dispatchKey.ts'

const PREVENT_DEFAULT = new Set(['Key_Space', 'Key_Tab', 'Key_Backspace', 'Key_Enter'])

export function useKeyboardInput(): void {
  useEffect(() => {
    // Keep the name that went down per physical key, so keyup releases it
    // even if the produced character changed in between (Shift held).
    const held = new Map<string, string>()

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      const name = keyNameFromEvent(e.key, e.location)
      if (!name) return
      if (PREVENT_DEFAULT.has(name)) e.preventDefault()
      if (e.repeat) return
      held.set(e.code, name)
      pressKey(name)
    }
    const onKeyUp = (e: KeyboardEvent) => {
      const name = held.get(e.code)
      if (!name) return
      held.delete(e.code)
      releaseKey(name)
    }
    const onBlur = () => {
      for (const name of held.values()) releaseKey(name)
      held.clear()
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
      onBlur()
    }
  }, [])
}
