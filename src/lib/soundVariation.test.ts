import { describe, expect, it } from 'vitest'
import {
  dbToGain,
  gainFor,
  jitter,
  pickVariant,
  rateFor,
  SOUND_SPECS,
  VoicePool,
  type Random,
} from './soundVariation.ts'

/** A random source that walks evenly through [0, 1). */
const sweep = (steps: number): Random => {
  let i = 0
  return () => (i++ % steps) / steps
}

describe('pickVariant', () => {
  it('is always 0 for a single variant', () => {
    expect(pickVariant(1, null, () => 0.9)).toBe(0)
    expect(pickVariant(1, 0, () => 0.1)).toBe(0)
  })

  it('never repeats the last variant and reaches all the others', () => {
    for (const count of [2, 3, 4]) {
      for (let last = 0; last < count; last++) {
        const seen = new Set<number>()
        const rand = sweep(20)
        for (let i = 0; i < 20; i++) {
          const v = pickVariant(count, last, rand)
          expect(v).not.toBe(last)
          expect(v).toBeGreaterThanOrEqual(0)
          expect(v).toBeLessThan(count)
          seen.add(v)
        }
        expect(seen.size).toBe(count - 1)
      }
    }
  })

  it('stays in range with no history and with an extreme random value', () => {
    expect(pickVariant(4, null, () => 0.999999)).toBe(3)
    expect(pickVariant(4, null, () => 0)).toBe(0)
    expect(pickVariant(4, 3, () => 0.999999)).toBe(2)
  })
})

describe('jitter and gain', () => {
  it('spans [-range, range]', () => {
    expect(jitter(0.04, () => 0)).toBeCloseTo(-0.04)
    expect(jitter(0.04, () => 0.5)).toBeCloseTo(0)
    expect(jitter(0.04, () => 0.999999)).toBeCloseTo(0.04)
  })

  it('rateFor stays within the pitch spread and is exactly 1 without one', () => {
    expect(rateFor(0.04, () => 0)).toBeCloseTo(0.96)
    expect(rateFor(0.04, () => 1)).toBeCloseTo(1.04)
    expect(rateFor(0, () => 0.3)).toBe(1)
  })

  it('converts dB to linear gain', () => {
    expect(dbToGain(0)).toBe(1)
    expect(dbToGain(6)).toBeCloseTo(1.995, 2)
    expect(dbToGain(-20)).toBeCloseTo(0.1)
  })

  it('gainFor keeps the base level at the middle of the spread', () => {
    expect(gainFor(0.8, 1.5, () => 0.5)).toBeCloseTo(0.8)
    expect(gainFor(0.8, 1.5, () => 1)).toBeCloseTo(0.8 * dbToGain(1.5))
    expect(gainFor(0.8, 0, () => 0.2)).toBeCloseTo(0.8)
  })
})

describe('SOUND_SPECS', () => {
  it('has at least one variant and a level in (0, 1] for every sound', () => {
    for (const spec of Object.values(SOUND_SPECS)) {
      expect(spec.variants).toBeGreaterThanOrEqual(1)
      expect(spec.level).toBeGreaterThan(0)
      expect(spec.level).toBeLessThanOrEqual(1)
    }
  })
})

describe('VoicePool', () => {
  it('hands back nothing while under the limit', () => {
    const pool = new VoicePool<string>(2)
    expect(pool.add('a')).toEqual([])
    expect(pool.add('b')).toEqual([])
    expect(pool.size).toBe(2)
  })

  it('steals the oldest voices past the limit', () => {
    const pool = new VoicePool<string>(2)
    pool.add('a')
    pool.add('b')
    expect(pool.add('c')).toEqual(['a'])
    expect(pool.size).toBe(2)
  })

  it('frees a slot when a voice ends', () => {
    const pool = new VoicePool<string>(2)
    pool.add('a')
    pool.add('b')
    pool.remove('a')
    expect(pool.add('c')).toEqual([])
    pool.remove('missing')
    expect(pool.size).toBe(2)
  })
})
