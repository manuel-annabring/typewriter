import { describe, expect, it } from 'vitest'
import { TapTracker } from './tapTracker.ts'

describe('TapTracker', () => {
  it('returns the key name for a finger that lifts where it landed', () => {
    const t = new TapTracker(5)
    t.down(1, 'Key_A', 100, 100)
    expect(t.up(1)).toBe('Key_A')
    expect(t.size).toBe(0)
  })

  it('allows a small wobble but not a drag past the threshold', () => {
    const t = new TapTracker(5)
    t.down(1, 'Key_A', 100, 100)
    t.move(1, 103, 103)
    expect(t.up(1)).toBe('Key_A')
    t.down(2, 'Key_B', 100, 100)
    t.move(2, 100, 106)
    expect(t.up(2)).toBeNull()
  })

  it('stays a drag even if the finger comes back to where it started', () => {
    const t = new TapTracker(5)
    t.down(1, 'Key_A', 100, 100)
    t.move(1, 140, 100)
    t.move(1, 100, 100)
    expect(t.up(1)).toBeNull()
  })

  it('tracks two fingers separately', () => {
    const t = new TapTracker(5)
    t.down(1, 'Key_A', 10, 10)
    t.down(2, 'Key_B', 200, 10)
    t.move(2, 260, 10)
    expect(t.up(1)).toBe('Key_A')
    expect(t.up(2)).toBeNull()
  })

  it('forgets cancelled fingers and ignores ones it never saw', () => {
    const t = new TapTracker(5)
    t.down(1, 'Key_A', 0, 0)
    t.cancel(1)
    expect(t.up(1)).toBeNull()
    t.move(9, 50, 50)
    expect(t.up(9)).toBeNull()
  })
})
