import { create } from 'zustand'
import { advance, back, COLS, crossesBell, nextLine, printChar } from '../lib/paperGrid.ts'

const LOG_LIMIT = 8
const SHIFT_KEYS: readonly string[] = ['Key_Shift_L', 'Key_Shift_R']

interface TypewriterState {
  // SPEC section 6. The carriage position is derived from `cursor`, not stored.
  lines: string[]
  cursor: { row: number; col: number }
  status: 'typing' | 'locked'
  /** Counts bell events (cursor reaching BELL_COL). Silent in Phase 1; the sound slice subscribes to it. */
  bellSeq: number
  /** The glyph printed by the latest typeChar. The paper draws just this one; null means redraw from `lines`. */
  lastPrint: { row: number; col: number; char: string; seq: number } | null
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
  status: 'typing',
  bellSeq: 0,
  lastPrint: null,
  pressedKeys: [],
  lastChar: null,
  log: [],

  keyDown: (name) =>
    set((s) => (s.pressedKeys.includes(name) ? s : { pressedKeys: [...s.pressedKeys, name] })),
  keyUp: (name) =>
    set((s) => (s.pressedKeys.includes(name) ? { pressedKeys: s.pressedKeys.filter((k) => k !== name) } : s)),

  typeChar: (rawChar) =>
    set((s) => {
      // pressKey passes the lowercase key name's character, so Shift is applied here.
      const shifted = s.pressedKeys.some((k) => SHIFT_KEYS.includes(k))
      const char = shifted && /^[a-z]$/.test(rawChar) ? rawChar.toUpperCase() : rawChar
      const next = printChar(s, char)
      if (!next) return { log: addLog(s.log, `typeChar '${char}' ignored`) }
      const { row, col } = s.cursor
      return {
        lines: next.lines,
        cursor: next.cursor,
        status: next.cursor.col >= COLS ? 'locked' : 'typing',
        bellSeq: crossesBell(s.cursor, next.cursor) ? s.bellSeq + 1 : s.bellSeq,
        lastPrint: { row, col, char, seq: (s.lastPrint?.seq ?? 0) + 1 },
        lastChar: char,
        log: addLog(s.log, `typeChar '${char}'`),
      }
    }),
  space: () =>
    set((s) => {
      const cursor = advance(s.cursor)
      if (!cursor) return { log: addLog(s.log, 'space ignored') }
      return {
        cursor,
        status: cursor.col >= COLS ? 'locked' : 'typing',
        bellSeq: crossesBell(s.cursor, cursor) ? s.bellSeq + 1 : s.bellSeq,
        lastChar: ' ',
        log: addLog(s.log, 'space'),
      }
    }),
  // State only; useCarriageAnimation derives the slide and the line feed from `cursor`.
  returnCarriage: () =>
    set((s) => {
      const cursor = nextLine(s.cursor)
      if (cursor.row === s.cursor.row && cursor.col === s.cursor.col) {
        return { log: addLog(s.log, 'returnCarriage ignored') }
      }
      return { cursor, status: 'typing', log: addLog(s.log, 'returnCarriage') }
    }),
  // Authentic: moves the carriage back one column without erasing; typing over it overstrikes.
  backspace: () =>
    set((s) => {
      const cursor = back(s.cursor)
      if (!cursor) return { log: addLog(s.log, 'backspace ignored') }
      return { cursor, status: 'typing', log: addLog(s.log, 'backspace') }
    }),
  newSheet: () => set((s) => ({ log: addLog(s.log, 'newSheet') })),
}))
