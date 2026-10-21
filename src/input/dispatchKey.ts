import { charFromKeyName } from '../lib/keymap.ts'
import { useTypewriterStore } from '../store/typewriterStore.ts'

/** The one place a key name becomes a store action. Keyboard and pointer both call this. */
export function pressKey(name: string): void {
  const s = useTypewriterStore.getState()
  s.keyDown(name)
  switch (name) {
    case 'Key_Space':
      s.space()
      break
    case 'Key_Enter':
    case 'Lever': // the 3D lever is not a key, but it is the same action
      s.returnCarriage()
      break
    case 'Key_Backspace':
      s.backspace()
      break
    default: {
      // Tab and Shift only register as pressed in slice 2.
      const char = charFromKeyName(name)
      if (char) s.typeChar(char)
    }
  }
}

export function releaseKey(name: string): void {
  useTypewriterStore.getState().keyUp(name)
}

/** A quick tap still stays pressed this long, so it is visible and animatable. */
const MIN_HOLD_MS = 80

/** Presses a key and returns a function that releases it (after the minimum hold). */
export function holdKey(name: string): () => void {
  const start = performance.now()
  pressKey(name)
  let released = false
  return () => {
    if (released) return
    released = true
    const wait = Math.max(0, MIN_HOLD_MS - (performance.now() - start))
    if (wait === 0) releaseKey(name)
    else window.setTimeout(() => releaseKey(name), wait)
  }
}
