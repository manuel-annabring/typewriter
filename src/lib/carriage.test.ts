import { describe, expect, it } from 'vitest'
import { baselineFromTopM, carriageShiftM, LINE_HEIGHT_M, paperFeedM } from './carriage.ts'
import { COLS } from './paperGrid.ts'

describe('carriageShiftM', () => {
  it('steps one 10 cpi pitch per column, from half a cell at rest', () => {
    expect(carriageShiftM(0)).toBeCloseTo(0.00127, 6)
    expect(carriageShiftM(1) - carriageShiftM(0)).toBeCloseTo(0.00254, 6)
    expect(carriageShiftM(COLS) - carriageShiftM(0)).toBeCloseTo(0.16764, 5)
  })
})

describe('paperFeedM', () => {
  const along = -0.1262
  const height = 0.297
  it('puts the row 0 baseline at the strike point', () => {
    // Baseline offset from the sheet centre is height / 2 - baselineFromTop; the feed cancels it.
    const baselineFromCentre = height / 2 - baselineFromTopM(0)
    expect(baselineFromCentre + paperFeedM(0, along, height)).toBeCloseTo(along, 9)
  })
  it('moves the sheet up one line height per row', () => {
    expect(paperFeedM(5, along, height) - paperFeedM(4, along, height)).toBeCloseTo(LINE_HEIGHT_M, 9)
  })
})
