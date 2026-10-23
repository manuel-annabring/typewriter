import { describe, expect, it } from 'vitest'
import {
  ATLAS_BLANK_CELL,
  ATLAS_CELL_MARGIN,
  ATLAS_COLS,
  ATLAS_ROWS,
  KEY_NODE_NAMES,
} from '../typewriter/contract.ts'
import { cellRect, keyAtlasCell, keyLabel, keyMaterialName } from './keyLabels.ts'

describe('keyAtlasCell', () => {
  it('gives every key a unique cell inside the grid, never the blank cell', () => {
    const cells = KEY_NODE_NAMES.map((n) => keyAtlasCell(n))
    expect(new Set(cells).size).toBe(KEY_NODE_NAMES.length)
    for (const cell of cells) {
      expect(cell).not.toBeNull()
      expect(cell).toBeGreaterThan(ATLAS_BLANK_CELL)
      expect(cell).toBeLessThan(ATLAS_COLS * ATLAS_ROWS)
    }
  })
  it('numbers cells by contract order, starting at 1 (mirrored in contract_spec.py)', () => {
    expect(keyAtlasCell('Key_1')).toBe(1)
    expect(keyAtlasCell('Key_Backspace')).toBe(11)
    expect(keyAtlasCell('Key_Tab')).toBe(12)
    expect(keyAtlasCell('Key_Space')).toBe(KEY_NODE_NAMES.length)
  })
  it('returns null for nodes that are not keys', () => {
    expect(keyAtlasCell('Body')).toBeNull()
    expect(keyAtlasCell('Key_Q_1')).toBeNull()
  })
})

describe('cellRect', () => {
  it('puts cell 0 at the atlas top-left and the next cell to its right', () => {
    expect(cellRect(0)).toEqual({ u0: 0, v0: 0, u1: 1 / ATLAS_COLS, v1: 1 / ATLAS_ROWS })
    expect(cellRect(1).u0).toBeCloseTo(1 / ATLAS_COLS)
    expect(cellRect(1).v0).toBe(0)
  })
  it('wraps to the next row after the last column', () => {
    expect(cellRect(ATLAS_COLS).u0).toBe(0)
    expect(cellRect(ATLAS_COLS).v0).toBeCloseTo(1 / ATLAS_ROWS)
  })
  it('shrinks by the margin on every side for the inner rect', () => {
    const outer = cellRect(9)
    const inner = cellRect(9, true)
    const w = outer.u1 - outer.u0
    expect(inner.u0 - outer.u0).toBeCloseTo(w * ATLAS_CELL_MARGIN)
    expect(outer.u1 - inner.u1).toBeCloseTo(w * ATLAS_CELL_MARGIN)
    expect(inner.v0).toBeGreaterThan(outer.v0)
    expect(inner.v1).toBeLessThan(outer.v1)
  })
})

describe('keyLabel', () => {
  it('prints letters in uppercase and digits as they are', () => {
    expect(keyLabel('Key_A')).toBe('A')
    expect(keyLabel('Key_7')).toBe('7')
  })
  it('labels punctuation and special keys', () => {
    expect(keyLabel('Key_Comma')).toBe(',')
    expect(keyLabel('Key_Period')).toBe('.')
    expect(keyLabel('Key_Tab')).toBe('TAB')
    expect(keyLabel('Key_Enter')).toBe('↵')
    expect(keyLabel('Key_Backspace')).toBe('←')
    expect(keyLabel('Key_Shift_L')).toBe('⇧')
    expect(keyLabel('Key_Shift_R')).toBe('⇧')
  })
  it('leaves Space blank and every other key labelled', () => {
    expect(keyLabel('Key_Space')).toBeNull()
    for (const name of KEY_NODE_NAMES.filter((n) => n !== 'Key_Space')) {
      expect(keyLabel(name)).not.toBeNull()
    }
  })
})

describe('keyMaterialName', () => {
  it('uses the dark material for modifier keys and cream for the rest', () => {
    for (const n of ['Key_Tab', 'Key_Enter', 'Key_Backspace', 'Key_Shift_L', 'Key_Shift_R']) {
      expect(keyMaterialName(n)).toBe('Mat_KeyDark')
    }
    expect(keyMaterialName('Key_A')).toBe('Mat_KeyCream')
    expect(keyMaterialName('Key_Space')).toBe('Mat_KeyCream')
  })
})
