import { describe, expect, it } from 'vitest'
import {
  baselineFromTopM,
  carriageShiftM,
  LAMBDA_RETURN,
  LINE_FEED_SETTLE_S,
  LINE_HEIGHT_M,
  paperFeedM,
  returnSlideSeconds,
} from './carriage.ts'
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

describe('returnSlideSeconds', () => {
  it('matches the exponential slide: the remaining distance at that time is the rest distance', () => {
    const cols = 40
    const remainingMm = cols * 2.54 * Math.exp(-LAMBDA_RETURN * returnSlideSeconds(cols))
    expect(remainingMm).toBeCloseTo(1, 6)
  })

  it('is 0 for a return that starts within the rest distance, and grows with the distance', () => {
    expect(returnSlideSeconds(0)).toBe(0)
    expect(returnSlideSeconds(60)).toBeGreaterThan(returnSlideSeconds(10))
    expect(returnSlideSeconds(60)).toBeLessThan(0.6)
  })

  it('a line feed settles in a little over a tenth of a second', () => {
    expect(LINE_FEED_SETTLE_S).toBeGreaterThan(0.1)
    expect(LINE_FEED_SETTLE_S).toBeLessThan(0.2)
  })
})
