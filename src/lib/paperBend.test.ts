import { describe, expect, it } from 'vitest'
import { alongFromTangent, BAIL_WRAP, bendPoint, TAIL_ANGLE, wrapAngleFor } from './paperBend.ts'

const R = 0.0226
const LEAN = (8 * Math.PI) / 180
const WRAP_ANGLE = wrapAngleFor(LEAN, TAIL_ANGLE)

const bend = (s: number) => bendPoint(s, R, BAIL_WRAP, WRAP_ANGLE)
const dist = (a: { along: number; out: number }, b: { along: number; out: number }) =>
  Math.hypot(a.along - b.along, a.out - b.out)

describe('bendPoint', () => {
  it('leaves the sheet flat above the tangent point without a bail', () => {
    expect(bendPoint(0.05, R, 0, WRAP_ANGLE)).toEqual({ along: 0.05, out: 0, normalAlong: 0, normalOut: 1 })
  })

  it('wraps below the tangent point the same way with or without a bail', () => {
    for (const s of [-0.01, -0.05, -0.2]) {
      expect(bendPoint(s, R, BAIL_WRAP, WRAP_ANGLE)).toEqual(bendPoint(s, R, 0, WRAP_ANGLE))
    }
  })

  it('keeps distances along the sheet: free part, bail, wrap and tail', () => {
    const step = 1e-4
    for (const s of [0.2, 0.05, R * BAIL_WRAP + step / 2, 0.005, -0.001, -0.02, -R * WRAP_ANGLE + step / 2, -0.1, -0.2]) {
      expect(dist(bend(s), bend(s - step))).toBeCloseTo(step, 7)
    }
  })

  it('stays on the platen circle between the bail and the end of the wrap', () => {
    for (const s of [R * BAIL_WRAP * 0.9, 0.003, -0.005, -0.03, -R * WRAP_ANGLE * 0.95]) {
      const p = bend(s)
      // The axis is at (0, -R) in the sheet frame; the normal points away from it.
      expect(Math.hypot(p.along, p.out + R)).toBeCloseTo(R, 9)
      expect(p.along / R).toBeCloseTo(p.normalAlong, 9)
      expect((p.out + R) / R).toBeCloseTo(p.normalOut, 9)
    }
  })

  it('is continuous at the bail, the tangent point and the end of the wrap', () => {
    const e = 1e-7
    for (const at of [R * BAIL_WRAP, 0, -R * WRAP_ANGLE]) {
      expect(dist(bend(at + e), bend(at - e))).toBeLessThan(1e-6)
      expect(bend(at + e).normalAlong).toBeCloseTo(bend(at - e).normalAlong, 4)
    }
  })

  it('leans the free part back by the bail wrap', () => {
    const a = bend(0.1)
    const b = bend(0.2)
    expect((b.along - a.along) / 0.1).toBeCloseTo(Math.cos(BAIL_WRAP), 9)
    expect((b.out - a.out) / 0.1).toBeCloseTo(-Math.sin(BAIL_WRAP), 9)
  })

  it('lays the tail back at the tail angle above horizontal', () => {
    // Side view: x back, y up. The flat sheet's up axis leans back by LEAN; `out` faces front.
    const toSide = (p: { along: number; out: number }) => ({
      x: p.along * Math.sin(LEAN) - p.out * Math.cos(LEAN),
      y: p.along * Math.cos(LEAN) + p.out * Math.sin(LEAN),
    })
    const a = toSide(bend(-R * WRAP_ANGLE - 0.05))
    const b = toSide(bend(-R * WRAP_ANGLE - 0.15))
    expect(b.x).toBeGreaterThan(a.x)
    expect(Math.atan2(b.y - a.y, b.x - a.x)).toBeCloseTo(TAIL_ANGLE, 9)
  })

  it('keeps the free part and the tail apart for every feed, so the sheet never crosses itself', () => {
    // Every feed shows a part of the same two straight runs, so checking the runs covers all rows.
    let closest = Infinity
    for (let f = R * BAIL_WRAP; f <= 0.3; f += 0.002) {
      for (let t = -R * WRAP_ANGLE; t >= -0.3; t -= 0.002) closest = Math.min(closest, dist(bend(f), bend(t)))
    }
    // The closest pair is where both leave the platen: a chord across bail wrap plus wrap.
    expect(closest).toBeCloseTo(2 * R * Math.sin((BAIL_WRAP + WRAP_ANGLE) / 2), 6)
    expect(closest).toBeGreaterThan(0.04)
  })

  it('returns unit normals at right angles to the sheet', () => {
    const step = 1e-6
    for (const s of [0.1, 0.005, -0.01, -0.05, -0.15]) {
      const p = bend(s)
      const q = bend(s - step)
      expect(Math.hypot(p.normalAlong, p.normalOut)).toBeCloseTo(1, 9)
      expect(((q.along - p.along) * p.normalAlong + (q.out - p.out) * p.normalOut) / step).toBeCloseTo(0, 4)
    }
  })
})

describe('alongFromTangent', () => {
  it('moves the bend profile by exactly the feed', () => {
    const tangentAlong = -0.12
    const alongRest = -0.13
    const before = bend(alongFromTangent(alongRest, 0, tangentAlong))
    const after = bend(alongFromTangent(alongRest - 0.03, 0.03, tangentAlong))
    expect(after).toEqual(before)
    expect(alongFromTangent(alongRest, -0.245, tangentAlong)).toBeCloseTo(alongRest - 0.245 - tangentAlong, 12)
  })
})
