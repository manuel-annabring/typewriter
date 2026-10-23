// Pure key label atlas layout. No three.js here.
// Two atlases (one per key material) share this layout. Cell coordinates use the glTF UV frame:
// u to the right, v down, (0, 0) at the atlas's top-left, which is what flipY = false expects.

import {
  ATLAS_CELL_MARGIN,
  ATLAS_COLS,
  ATLAS_ROWS,
  DARK_KEY_NODE_NAMES,
  KEY_NODE_NAMES,
} from '../typewriter/contract.ts'

/** Atlas resolution in pixels (square). Raise to 2048 if labels look soft up close. */
export const ATLAS_SIZE_PX = 1024
export const CELL_PX = ATLAS_SIZE_PX / ATLAS_COLS

export type KeyMaterialName = 'Mat_KeyCream' | 'Mat_KeyDark'

export interface UvRect {
  u0: number
  v0: number
  u1: number
  v1: number
}

const CELL_BY_KEY: ReadonlyMap<string, number> = new Map(
  KEY_NODE_NAMES.map((name, i) => [name, i + 1]),
)

const SPECIAL_LABELS: Readonly<Record<string, string>> = {
  Key_Tab: 'TAB',
  Key_Enter: '↵',
  Key_Backspace: '←',
  Key_Shift_L: '⇧',
  Key_Shift_R: '⇧',
  Key_Comma: ',',
  Key_Period: '.',
}

/** The atlas cell a key's top face maps into, or null if the node is not a key. */
export function keyAtlasCell(name: string): number | null {
  return CELL_BY_KEY.get(name) ?? null
}

/** The cell's UV rectangle. With `inner`, shrunk by the margin the top face's UVs stay within. */
export function cellRect(cell: number, inner = false): UvRect {
  const col = cell % ATLAS_COLS
  const row = Math.floor(cell / ATLAS_COLS)
  const margin = inner ? ATLAS_CELL_MARGIN : 0
  const w = 1 / ATLAS_COLS
  const h = 1 / ATLAS_ROWS
  return {
    u0: (col + margin) * w,
    v0: (row + margin) * h,
    u1: (col + 1 - margin) * w,
    v1: (row + 1 - margin) * h,
  }
}

/** The text printed on a key, or null for a blank cap (Space). */
export function keyLabel(name: string): string | null {
  const special = SPECIAL_LABELS[name]
  if (special) return special
  return /^Key_([A-Z0-9])$/.exec(name)?.[1] ?? null
}

/** The material whose atlas carries this key's label (the material of its top face). */
export function keyMaterialName(name: string): KeyMaterialName {
  return DARK_KEY_NODE_NAMES.has(name) ? 'Mat_KeyDark' : 'Mat_KeyCream'
}
