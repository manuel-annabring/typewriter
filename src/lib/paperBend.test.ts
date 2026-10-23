import { describe, expect, it } from 'vitest'
import { alongFromTangent, bendPoint, WRAP_ANGLE } from './paperBend.ts'

const R = 0.0226

const dist = (a: { along: number; out: number }, b: { along: number; out: number }) =>
  Math.hypot(a.along - b.along, a.out - b.out)

describe('bendPoint', () => {
  it('leaves the sheet flat above the tangent point', () => {
    expect(bendPoint(0.05, R, WRAP_ANGLE)).toEqual({ along: 0.05, out: 0, normalAlong: 0, normalOut: 1 })
  })

  it('keeps distances along the sheet, on the wrap and on the tail', () => {
    const step = 1e-4
    for (const s of [-0.001, -0.02, -R * Math.PI + step / 2, -0.1, -0.2]) {
      expect(dist(bendPoint(s, R, WRAP_ANGLE), bendPoint(s - step, R, WRAP_ANGLE))).toBeCloseTo(step, 7)
    }
  })

  it('stays on the wrap circle, with the normal pointing away from the axis', () => {
    for (const s of [-0.005, -0.03, -0.06]) {
      const p = bendPoint(s, R, WRAP_ANGLE)
      // The axis is at (0, -R) in the sheet frame.
      expect(Math.hypot(p.along, p.out + R)).toBeCloseTo(R, 9)
      expect(p.along / R).toBeCloseTo(p.normalAlong, 9)
      expect((p.out + R) / R).toBeCloseTo(p.normalOut, 9)
    }
  })

  it('is continuous at the tangent point and at the end of the wrap', () => {
    const e = 1e-7
    expect(dist(bendPoint(e, R, WRAP_ANGLE), bendPoint(-e, R, WRAP_ANGLE))).toBeLessThan(1e-6)
    const end = -R * WRAP_ANGLE
    expect(dist(bendPoint(end + e, R, WRAP_ANGLE), bendPoint(end - e, R, WRAP_ANGLE))).toBeLessThan(1e-6)
    expect(bendPoint(-e, R, WRAP_ANGLE).normalOut).toBeCloseTo(1, 6)
  })

  it('sends the tail back up behind the platen after half a turn', () => {
    const end = bendPoint(-R * Math.PI, R, Math.PI)
    expect(end.along).toBeCloseTo(0, 9)
    expect(end.out).toBeCloseTo(-2 * R, 9)
    const tail = bendPoint(-R * Math.PI - 0.1, R, Math.PI)
    expect(tail.along).toBeCloseTo(0.1, 9)
    expect(tail.out).toBeCloseTo(-2 * R, 9)
    expect(tail.normalOut).toBeCloseTo(-1, 9)
  })

  it('returns unit normals at right angles to the sheet', () => {
    const step = 1e-6
    for (const s of [0.01, -0.01, -0.05, -0.15]) {
      const p = bendPoint(s, R, WRAP_ANGLE)
      const q = bendPoint(s - step, R, WRAP_ANGLE)
      expect(Math.hypot(p.normalAlong, p.normalOut)).toBeCloseTo(1, 9)
      expect(((q.along - p.along) * p.normalAlong + (q.out - p.out) * p.normalOut) / step).toBeCloseTo(0, 4)
    }
  })
})

describe('alongFromTangent', () => {
  it('moves the bend profile by exactly the feed', () => {
    const tangentAlong = -0.12
    const alongRest = -0.13
    const before = bendPoint(alongFromTangent(alongRest, 0, tangentAlong), R, WRAP_ANGLE)
    const after = bendPoint(alongFromTangent(alongRest - 0.03, 0.03, tangentAlong), R, WRAP_ANGLE)
    expect(after).toEqual(before)
    expect(alongFromTangent(alongRest, -0.245, tangentAlong)).toBeCloseTo(alongRest - 0.245 - tangentAlong, 12)
  })
})
