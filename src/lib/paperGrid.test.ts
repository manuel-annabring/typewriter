import { describe, expect, it } from 'vitest'
import {
  advance,
  back,
  BELL_COL,
  cellOrigin,
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  COLS,
  crossesBell,
  glyphJitter,
  isPrintable,
  nextLine,
  printChar,
  ROWS,
} from './paperGrid.ts'

const empty = { lines: [''], cursor: { row: 0, col: 0 } }

describe('canvas size', () => {
  it('keeps the A4 ratio', () => {
    expect(CANVAS_HEIGHT / CANVAS_WIDTH).toBeCloseTo(297 / 210, 3)
  })
})

describe('cellOrigin', () => {
  it('steps one pitch per column and one line per row', () => {
    const a = cellOrigin(0, 0)
    expect(cellOrigin(0, 1).x - a.x).toBeCloseTo(2.54 * 8)
    expect(cellOrigin(1, 0).y - a.y).toBeCloseTo(6.35 * 8)
  })
  it('keeps the whole grid on the sheet', () => {
    expect(cellOrigin(ROWS - 1, COLS - 1).x).toBeLessThan(CANVAS_WIDTH)
    expect(cellOrigin(ROWS - 1, 0).y).toBeLessThan(CANVAS_HEIGHT)
  })
})

describe('glyphJitter', () => {
  it('is deterministic', () => {
    expect(glyphJitter(2, 5, 'a')).toEqual(glyphJitter(2, 5, 'a'))
  })
  it('varies between cells and stays in range', () => {
    const seen = new Set<number>()
    for (let col = 0; col < COLS; col++) {
      const j = glyphJitter(0, col, 'e')
      seen.add(j.dx)
      expect(Math.abs(j.dx)).toBeLessThanOrEqual(0.8)
      expect(Math.abs(j.dy)).toBeLessThanOrEqual(1)
      expect(Math.abs(j.rotation)).toBeLessThanOrEqual((1.5 * Math.PI) / 180)
      expect(j.alpha).toBeGreaterThanOrEqual(0.72)
      expect(j.alpha).toBeLessThanOrEqual(0.95)
    }
    expect(seen.size).toBeGreaterThan(30)
  })
})

describe('isPrintable', () => {
  it('accepts letters, digits and punctuation, rejects controls and multi-char keys', () => {
    expect(isPrintable('A')).toBe(true)
    expect(isPrintable('.')).toBe(true)
    expect(isPrintable('ä')).toBe(true)
    expect(isPrintable('\n')).toBe(false)
    expect(isPrintable('Enter')).toBe(false)
    expect(isPrintable('')).toBe(false)
  })
})

describe('printChar', () => {
  it('prints at the cursor and advances', () => {
    const s = printChar(empty, 'h')
    expect(s?.lines).toEqual(['h'])
    expect(s?.cursor).toEqual({ row: 0, col: 1 })
  })
  it('pads skipped columns with spaces', () => {
    const s = printChar({ lines: [''], cursor: { row: 0, col: 3 } }, 'x')
    expect(s?.lines).toEqual(['   x'])
  })
  it('overstrikes an existing character', () => {
    const s = printChar({ lines: ['abc'], cursor: { row: 0, col: 1 } }, 'X')
    expect(s?.lines).toEqual(['aXc'])
  })
  it('does not mutate its input', () => {
    printChar(empty, 'h')
    expect(empty.lines).toEqual([''])
  })
  it('refuses at the right margin, past the last row, and for non-printables', () => {
    expect(printChar({ lines: [''], cursor: { row: 0, col: COLS } }, 'a')).toBeNull()
    expect(printChar({ lines: [''], cursor: { row: ROWS, col: 0 } }, 'a')).toBeNull()
    expect(printChar(empty, '\t')).toBeNull()
  })
})

describe('advance and nextLine', () => {
  it('advances up to the margin', () => {
    expect(advance({ row: 0, col: COLS - 1 })).toEqual({ row: 0, col: COLS })
    expect(advance({ row: 0, col: COLS })).toBeNull()
  })
  it('feeds a line, and on the last row only returns the carriage', () => {
    expect(nextLine({ row: 3, col: 10 })).toEqual({ row: 4, col: 0 })
    expect(nextLine({ row: ROWS - 1, col: 40 })).toEqual({ row: ROWS - 1, col: 0 })
  })
})

describe('back', () => {
  it('steps one column back and stops at column 0', () => {
    expect(back({ row: 2, col: 5 })).toEqual({ row: 2, col: 4 })
    expect(back({ row: 2, col: 0 })).toBeNull()
  })
})

describe('crossesBell', () => {
  it('fires once, on the step that reaches the bell column', () => {
    expect(crossesBell({ row: 0, col: BELL_COL - 1 }, { row: 0, col: BELL_COL })).toBe(true)
    expect(crossesBell({ row: 0, col: BELL_COL }, { row: 0, col: BELL_COL + 1 })).toBe(false)
    expect(crossesBell({ row: 0, col: 3 }, { row: 0, col: 4 })).toBe(false)
  })
  it('does not fire for a move to another row', () => {
    expect(crossesBell({ row: 0, col: BELL_COL - 1 }, { row: 1, col: 0 })).toBe(false)
  })
})
