// Pure page geometry for the paper canvas (A4, pica typewriter). No three.js here.
// Canvas pixels map 1:1 to the Paper UVs (flipY = false): canvas top-left is the page's top-left.

export const PAGE_WIDTH_MM = 210
export const PAGE_HEIGHT_MM = 297
/** Texture resolution. If per-keystroke uploads janky, drop to 6. */
export const PX_PER_MM = 8
export const CANVAS_WIDTH = PAGE_WIDTH_MM * PX_PER_MM
export const CANVAS_HEIGHT = PAGE_HEIGHT_MM * PX_PER_MM

/** 10 characters per inch. */
export const PITCH_MM = 2.54
export const LINE_HEIGHT_MM = 6.35
/** The strike point rests 20 mm into the sheet (Carriage rest x=0.085 in the model). */
export const LEFT_MARGIN_MM = 20
export const TOP_MARGIN_MM = 25
export const COLS = 66
export const ROWS = 38
/** Column where the bell will ring (slice 5). */
export const BELL_COL = 60

export const INK = '#1b1b20'
export const FONT_FAMILY = '"Special Elite", "Courier New", Courier, monospace'
/** Font size that makes an average glyph about fill one 10 cpi cell. */
export const FONT_SIZE_PX = 34

export interface Cursor {
  row: number
  col: number
}

/** Horizontal center and baseline of a cell, in canvas pixels. */
export function cellOrigin(row: number, col: number): { x: number; y: number } {
  return {
    x: (LEFT_MARGIN_MM + (col + 0.5) * PITCH_MM) * PX_PER_MM,
    y: (TOP_MARGIN_MM + (row + 0.8) * LINE_HEIGHT_MM) * PX_PER_MM,
  }
}

export interface GlyphJitter {
  dx: number
  dy: number
  /** Radians. */
  rotation: number
  alpha: number
}

const JITTER_DX_PX = 0.8
const JITTER_DY_PX = 1.0
const JITTER_ROT_RAD = (1.5 * Math.PI) / 180
const ALPHA_MIN = 0.72
const ALPHA_MAX = 0.95

/** Deterministic in [0, 1) from integers (a few rounds of integer mixing). */
function unit(seed: number): number {
  let h = seed | 0
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b)
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b)
  h ^= h >>> 16
  return (h >>> 0) / 4294967296
}

/** Same cell and character always look the same, so a redraw reproduces the page. */
export function glyphJitter(row: number, col: number, char: string): GlyphJitter {
  const seed = Math.imul(row + 1, 73856093) ^ Math.imul(col + 1, 19349663) ^ Math.imul(char.codePointAt(0) ?? 0, 83492791)
  const signed = (k: number) => unit(seed + k * 0x9e3779b9) * 2 - 1
  return {
    dx: signed(1) * JITTER_DX_PX,
    dy: signed(2) * JITTER_DY_PX,
    rotation: signed(3) * JITTER_ROT_RAD,
    alpha: ALPHA_MIN + unit(seed + 4 * 0x9e3779b9) * (ALPHA_MAX - ALPHA_MIN),
  }
}

/** True for a single code point from space up that the font could draw. */
export function isPrintable(char: string): boolean {
  const cp = char.codePointAt(0)
  return [...char].length === 1 && cp !== undefined && cp >= 0x20 && cp !== 0x7f && !(cp >= 0x80 && cp < 0xa0)
}

export interface PageState {
  lines: string[]
  cursor: Cursor
}

/**
 * Prints a character at the cursor (overstrikes whatever is there) and advances one column.
 * Returns null when nothing can be printed: not printable, at the right margin, or past the last row.
 */
export function printChar(state: PageState, char: string): PageState | null {
  const { row, col } = state.cursor
  if (!isPrintable(char) || col >= COLS || row >= ROWS) return null
  const line = (state.lines[row] ?? '').padEnd(col)
  const lines = state.lines.slice()
  while (lines.length <= row) lines.push('')
  lines[row] = line.slice(0, col) + char + line.slice(col + 1)
  return { lines, cursor: { row, col: col + 1 } }
}

/** Advances one column without printing. Null at the right margin. */
export function advance(cursor: Cursor): Cursor | null {
  return cursor.col >= COLS ? null : { row: cursor.row, col: cursor.col + 1 }
}

/** Carriage return plus line feed, state only. Null on the last row. */
export function nextLine(cursor: Cursor): Cursor | null {
  return cursor.row + 1 >= ROWS ? null : { row: cursor.row + 1, col: 0 }
}
