import { describe, expect, it } from 'vitest'
import { alongFromTangent, BAIL_WRAP, bendPoint, WRAP_ANGLE } from './paperBend.ts'

const R = 0.0226

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
    for (const s of [R * BAIL_WRAP * 0.9, 0.003, -0.005, -0.03, -0.06]) {
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

  it('runs the tail parallel to the free part, a platen diameter behind it, so they never cross', () => {
    // Distance of a point from the line the free part runs along (through the bail point).
    const bail = bend(R * BAIL_WRAP)
    const dir = { along: Math.cos(BAIL_WRAP), out: -Math.sin(BAIL_WRAP) }
    const offLine = (p: { along: number; out: number }) =>
      (p.along - bail.along) * dir.out - (p.out - bail.out) * dir.along
    for (const s of [-R * WRAP_ANGLE - 0.01, -0.15, -0.25]) {
      expect(Math.abs(offLine(bend(s)))).toBeCloseTo(2 * R, 9)
    }
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
