import { create } from 'zustand'

const LOG_LIMIT = 8

interface TypewriterState {
  // SPEC section 6. Paper and carriage logic arrive in slices 4 and 5.
  lines: string[]
  cursor: { row: number; col: number }
  carriageOffset: number
  status: 'typing' | 'locked'
  /** Contract node names (e.g. 'Key_A') currently held down. Slice 3 animates from this. */
  pressedKeys: readonly string[]
  // Debug (slice 2)
  lastChar: string | null
  log: readonly string[]

  keyDown: (name: string) => void
  keyUp: (name: string) => void
  typeChar: (char: string) => void
  space: () => void
  returnCarriage: () => void
  backspace: () => void
  newSheet: () => void
}

const addLog = (log: readonly string[], entry: string) => [entry, ...log].slice(0, LOG_LIMIT)

export const useTypewriterStore = create<TypewriterState>()((set) => ({
  lines: [''],
  cursor: { row: 0, col: 0 },
  carriageOffset: 0,
  status: 'typing',
  pressedKeys: [],
  lastChar: null,
  log: [],

  keyDown: (name) =>
    set((s) => (s.pressedKeys.includes(name) ? s : { pressedKeys: [...s.pressedKeys, name] })),
  keyUp: (name) =>
    set((s) => (s.pressedKeys.includes(name) ? { pressedKeys: s.pressedKeys.filter((k) => k !== name) } : s)),

  typeChar: (char) => set((s) => ({ lastChar: char, log: addLog(s.log, `typeChar '${char}'`) })),
  space: () => set((s) => ({ lastChar: ' ', log: addLog(s.log, 'space') })),
  returnCarriage: () => set((s) => ({ log: addLog(s.log, 'returnCarriage') })),
  backspace: () => set((s) => ({ log: addLog(s.log, 'backspace') })),
  newSheet: () => set((s) => ({ log: addLog(s.log, 'newSheet') })),
}))
