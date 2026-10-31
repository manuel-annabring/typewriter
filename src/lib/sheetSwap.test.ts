import { describe, expect, it } from 'vitest'
import {
  GAP_S,
  INSERT_S,
  insertDone,
  insertFeedM,
  insertStartFeedM,
  PULL_END_FEED_M,
  PULL_S,
  pullDone,
  pullFeedM,
  SWAP_TOTAL_S,
} from './sheetSwap.ts'

describe('sheetSwap', () => {
  it('adds up to about two seconds', () => {
    expect(SWAP_TOTAL_S).toBeCloseTo(PULL_S + GAP_S + INSERT_S)
    expect(SWAP_TOTAL_S).toBeLessThan(3)
  })

  it('pulls from the resting feed to the end feed and speeds up', () => {
    const from = -0.1
    expect(pullFeedM(0, from)).toBeCloseTo(from)
    expect(pullFeedM(PULL_S, from)).toBeCloseTo(PULL_END_FEED_M)
    expect(pullFeedM(PULL_S * 5, from)).toBeCloseTo(PULL_END_FEED_M)
    expect(pullFeedM(-1, from)).toBeCloseTo(from)
    // Ease-in: less than half the way after half the time.
    expect(pullFeedM(PULL_S / 2, from) - from).toBeLessThan((PULL_END_FEED_M - from) / 2)
  })

  it('inserts from far down the table to the target and slows down', () => {
    const from = -0.84
    const to = -0.245
    expect(insertFeedM(0, from, to)).toBeCloseTo(from)
    expect(insertFeedM(INSERT_S, from, to)).toBeCloseTo(to)
    expect(insertFeedM(INSERT_S * 3, from, to)).toBeCloseTo(to)
    // Ease-out: more than half the way after half the time.
    expect(insertFeedM(INSERT_S / 2, from, to) - from).toBeGreaterThan((to - from) / 2)
  })

  it('places the new sheet`s top edge out along the table', () => {
    const radius = 0.0226
    const wrap = (133 * Math.PI) / 180
    const topRest = 0.268
    const feed = insertStartFeedM(radius, wrap, topRest, 0.52)
    // Top edge arc length from the tangent point is topRest + feed: past the wrap's end by 0.52 m.
    expect(topRest + feed).toBeCloseTo(-radius * wrap - 0.52)
    expect(feed).toBeCloseTo(-0.84, 1)
  })

  it('reports when each part is over', () => {
    expect(pullDone(PULL_S - 0.01)).toBe(false)
    expect(pullDone(PULL_S)).toBe(true)
    expect(insertDone(GAP_S + INSERT_S - 0.01)).toBe(false)
    expect(insertDone(GAP_S + INSERT_S)).toBe(true)
  })
})
