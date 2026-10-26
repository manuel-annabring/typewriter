import { describe, expect, it } from 'vitest'
import { baselineFromTopM } from './carriage.ts'
import {
  alongFromTangent,
  BAIL_WRAP,
  bendPoint,
  DROOP_AT_REFERENCE,
  DROOP_RATE,
  DROOP_REFERENCE_LENGTH,
  droopAngle,
  TAIL_ANGLE,
  wrapAngleFor,
  type BendShape,
} from './paperBend.ts'
import { PAGE_HEIGHT_MM, ROWS } from './paperGrid.ts'

const R = 0.0226
const LEAN = (8 * Math.PI) / 180
const WRAP_ANGLE = wrapAngleFor(LEAN, TAIL_ANGLE)
const BAIL_S = R * BAIL_WRAP
/** The strike point sits about 7 mm below the tangent point in the model. */
const STRIKE_S = -0.0072
const PAGE_HEIGHT = PAGE_HEIGHT_MM / 1000

const shape = (freeLength = DROOP_REFERENCE_LENGTH, droopRate = DROOP_RATE): BendShape => ({
  radius: R,
  bailWrap: BAIL_WRAP,
  wrapAngle: WRAP_ANGLE,
  droopRate,
  freeLength,
})
const bend = (s: number, sh: BendShape = shape()) => bendPoint(s, sh)
const dist = (a: { along: number; out: number }, b: { along: number; out: number }) =>
  Math.hypot(a.along - b.along, a.out - b.out)

describe('bendPoint', () => {
  it('leaves the sheet flat above the tangent point without bail or droop', () => {
    const p = bendPoint(0.05, { radius: R, bailWrap: 0, wrapAngle: WRAP_ANGLE, droopRate: 0, freeLength: 0.1 })
    expect(p.along).toBeCloseTo(0.05, 12)
    expect(p.out).toBeCloseTo(0, 12)
    expect(p.normalOut).toBe(1)
  })

  it('keeps the free part straight when there is no droop', () => {
    const p = bend(BAIL_S + 0.2, shape(0.25, 0))
    const bail = bend(BAIL_S)
    expect(p.along - bail.along).toBeCloseTo(0.2 * Math.cos(BAIL_WRAP), 12)
    expect(p.out - bail.out).toBeCloseTo(-0.2 * Math.sin(BAIL_WRAP), 12)
  })

  it('wraps below the bail the same way whatever the droop', () => {
    for (const s of [BAIL_S * 0.5, -0.01, -0.05, -0.2]) {
      expect(bend(s)).toEqual(bend(s, shape(0.25, 0)))
    }
  })

  it('keeps distances along the sheet below the bail: bail arc, wrap and tail', () => {
    const step = 1e-4
    for (const s of [BAIL_S - step / 2, 0.005, -0.001, -0.02, -R * WRAP_ANGLE + step / 2, -0.1, -0.2]) {
      expect(dist(bend(s), bend(s - step))).toBeCloseTo(step, 7)
    }
  })

  it('keeps the drooping free part as long as the paper, to a tenth of a millimeter', () => {
    const n = 250
    let length = 0
    for (let i = 0; i < n; i++) {
      const s = BAIL_S + (DROOP_REFERENCE_LENGTH * i) / n
      length += dist(bend(s), bend(s + DROOP_REFERENCE_LENGTH / n))
    }
    expect(Math.abs(length - DROOP_REFERENCE_LENGTH)).toBeLessThan(1e-4)
  })

  it('matches a fine reference sum of the droop to a tenth of a millimeter', () => {
    const L = DROOP_REFERENCE_LENGTH
    const n = 20000
    let along = R * Math.sin(BAIL_WRAP)
    let out = R * Math.cos(BAIL_WRAP) - R
    for (let i = 0; i < n; i++) {
      const lean = BAIL_WRAP + droopAngle(((i + 0.5) * L) / n, L, DROOP_RATE)
      along += (L / n) * Math.cos(lean)
      out -= (L / n) * Math.sin(lean)
    }
    expect(dist(bend(BAIL_S + L), { along, out })).toBeLessThan(1e-4)
  })

  it('stays on the platen circle between the bail and the end of the wrap', () => {
    for (const s of [BAIL_S * 0.9, 0.003, -0.005, -0.03, -R * WRAP_ANGLE * 0.95]) {
      const p = bend(s)
      // The axis is at (0, -R) in the sheet frame; the normal points away from it.
      expect(Math.hypot(p.along, p.out + R)).toBeCloseTo(R, 9)
      expect(p.along / R).toBeCloseTo(p.normalAlong, 9)
      expect((p.out + R) / R).toBeCloseTo(p.normalOut, 9)
    }
  })

  it('is continuous at the bail, the tangent point and the end of the wrap', () => {
    const e = 1e-7
    for (const at of [BAIL_S, 0, -R * WRAP_ANGLE]) {
      expect(dist(bend(at + e), bend(at - e))).toBeLessThan(1e-6)
      expect(bend(at + e).normalAlong).toBeCloseTo(bend(at - e).normalAlong, 4)
    }
  })

  it('droops the top edge back by the set amount, growing with the cube of the free length', () => {
    const L = DROOP_REFERENCE_LENGTH
    const top = bend(BAIL_S + L, shape(L))
    expect(Math.atan2(top.normalAlong, top.normalOut)).toBeCloseTo(BAIL_WRAP + DROOP_AT_REFERENCE, 9)
    expect(droopAngle(L / 2, L / 2, DROOP_RATE)).toBeCloseTo(DROOP_AT_REFERENCE / 8, 9)
    expect(droopAngle(0, L, DROOP_RATE)).toBe(0)
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

  it('keeps the drooping front and the tail apart on every row, so the sheet never crosses itself', () => {
    // The sheet's top edge sits above the strike point by the row's baseline distance.
    let closest = Infinity
    for (let row = 0; row < ROWS; row++) {
      const top = STRIKE_S + baselineFromTopM(row)
      const sh = shape(Math.max(top - BAIL_S, 0))
      for (let f = BAIL_S; f <= top; f += 0.004) {
        for (let t = -R * WRAP_ANGLE; t >= top - PAGE_HEIGHT; t -= 0.004) {
          closest = Math.min(closest, dist(bend(f, sh), bend(t, sh)))
        }
      }
    }
    // Where both leave the platen they are a chord across bail wrap plus wrap apart.
    expect(closest).toBeGreaterThan(2 * R * Math.sin((BAIL_WRAP + WRAP_ANGLE) / 2) - 1e-3)
  })

  it('returns unit normals at right angles to the sheet', () => {
    const step = 1e-6
    for (const s of [0.2, 0.1, 0.005, -0.01, -0.05, -0.15]) {
      const p = bend(s)
      const q = bend(s - step)
      expect(Math.hypot(p.normalAlong, p.normalOut)).toBeCloseTo(1, 9)
      expect(((q.along - p.along) * p.normalAlong + (q.out - p.out) * p.normalOut) / step).toBeCloseTo(0, 2)
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
