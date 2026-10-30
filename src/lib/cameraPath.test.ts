import { describe, expect, it } from 'vitest'
import {
  AZIMUTH_LIMIT,
  INTRO_START_SPHERICAL,
  MAX_DISTANCE,
  MAX_ELEVATION,
  MIN_DISTANCE,
  MIN_ELEVATION,
  REST_POSITION,
  REST_SPHERICAL,
  REST_TARGET,
  OVERVIEW_LIMITS,
  WRITING_AZIMUTH,
  WRITING_COLUMNS,
  WRITING_ELEVATION,
  WRITING_LIMITS,
  writingDistance,
} from '../scene/cameraConfig.ts'
import {
  easeOutCubic,
  fitDistance,
  introEase,
  lerpSpherical,
  setFromSpherical,
  toSpherical,
  type Spherical,
  type Vec3,
} from './cameraPath.ts'

const deg = (r: number) => (r * 180) / Math.PI

describe('toSpherical / setFromSpherical', () => {
  it('reads the resting view as 0.686 m, 24.1 degrees up, 28.6 degrees to the right', () => {
    const s = toSpherical(REST_POSITION, REST_TARGET)
    expect(s.radius).toBeCloseTo(0.686, 3)
    expect(deg(s.elevation)).toBeCloseTo(24.1, 1)
    expect(deg(s.azimuth)).toBeCloseTo(28.6, 1)
  })

  it('round-trips a position', () => {
    const out: Vec3 = { x: 0, y: 0, z: 0 }
    setFromSpherical(out, REST_TARGET, toSpherical(REST_POSITION, REST_TARGET))
    expect(out.x).toBeCloseTo(REST_POSITION[0], 9)
    expect(out.y).toBeCloseTo(REST_POSITION[1], 9)
    expect(out.z).toBeCloseTo(REST_POSITION[2], 9)
  })

  it('puts azimuth 0 in front of the machine (+z) and positive azimuth toward +x', () => {
    const out: Vec3 = { x: 0, y: 0, z: 0 }
    setFromSpherical(out, [0, 0, 0], { radius: 1, elevation: 0, azimuth: 0 })
    expect(out.z).toBeCloseTo(1, 9)
    setFromSpherical(out, [0, 0, 0], { radius: 1, elevation: 0, azimuth: Math.PI / 2 })
    expect(out.x).toBeCloseTo(1, 9)
  })
})

describe('lerpSpherical', () => {
  const a: Spherical = { radius: 2, elevation: 1, azimuth: -0.5 }
  const b: Spherical = { radius: 1, elevation: 0.5, azimuth: 0.5 }
  const out: Spherical = { radius: 0, elevation: 0, azimuth: 0 }

  it('returns the ends at 0 and 1 and the middle at 0.5', () => {
    lerpSpherical(a, b, 0, out)
    expect(out).toEqual(a)
    lerpSpherical(a, b, 1, out)
    expect(out).toEqual(b)
    lerpSpherical(a, b, 0.5, out)
    expect(out).toEqual({ radius: 1.5, elevation: 0.75, azimuth: 0 })
  })
})

describe('introEase', () => {
  it('runs from 0 to 1 over the duration, easing out', () => {
    expect(introEase(0, 0, 2.5)).toBe(0)
    expect(introEase(0, 2.5, 2.5)).toBe(1)
    expect(introEase(0, 100, 2.5)).toBe(1)
    expect(introEase(0, 0.5, 2.5)).toBeGreaterThan(0.2)
    expect(easeOutCubic(0.5)).toBeCloseTo(0.875, 9)
  })

  it('never goes backwards over time', () => {
    let last = 0
    for (let t = 0; t <= 2.5; t += 0.05) {
      const e = introEase(0, t, 2.5)
      expect(e).toBeGreaterThanOrEqual(last)
      last = e
    }
  })

  it('continues from where the flight was when fast-forwarded, without a jump', () => {
    const from = introEase(0, 0.7, 2.5)
    expect(introEase(from, 0, 0.4)).toBe(from)
    expect(introEase(from, 0.4, 0.4)).toBe(1)
    expect(introEase(from, 0.2, 0.4)).toBeGreaterThan(from)
  })
})

describe('camera config', () => {
  it('keeps the resting view and the intro start inside the orbit limits', () => {
    for (const s of [REST_SPHERICAL, INTRO_START_SPHERICAL]) {
      expect(s.radius).toBeGreaterThanOrEqual(MIN_DISTANCE)
      expect(s.radius).toBeLessThanOrEqual(MAX_DISTANCE)
      expect(s.elevation).toBeGreaterThanOrEqual(MIN_ELEVATION)
      expect(s.elevation).toBeLessThanOrEqual(MAX_ELEVATION)
      expect(Math.abs(s.azimuth)).toBeLessThanOrEqual(AZIMUTH_LIMIT)
    }
  })

  it('starts the intro 2x as far away, 45 degrees up and 40 degrees to the left of the resting azimuth', () => {
    expect(INTRO_START_SPHERICAL.radius).toBeCloseTo(REST_SPHERICAL.radius * 2, 9)
    expect(deg(INTRO_START_SPHERICAL.elevation)).toBeCloseTo(45, 9)
    expect(deg(INTRO_START_SPHERICAL.azimuth)).toBeCloseTo(deg(REST_SPHERICAL.azimuth) - 40, 9)
  })
})

describe('writing view', () => {
  it('fits the given number of columns across the view', () => {
    // 70 columns of 2.54 mm in a 16:10 window with a 40 degree vertical field of view.
    const d = fitDistance(70, 0.00254, 40, 1.6)
    expect(d).toBeCloseTo(0.1527, 3)
    // The visible width at that distance is the 70 columns.
    expect(2 * d * Math.tan((20 * Math.PI) / 180) * 1.6).toBeCloseTo(0.1778, 6)
  })

  it('moves farther away in narrower windows and closer in wider ones', () => {
    expect(fitDistance(70, 0.00254, 40, 1.33)).toBeGreaterThan(fitDistance(70, 0.00254, 40, 1.6))
    expect(fitDistance(70, 0.00254, 40, 1.78)).toBeLessThan(fitDistance(70, 0.00254, 40, 1.6))
  })

  it('stays inside the writing limits for any window shape', () => {
    for (const aspect of [0.4, 0.75, 1, 1.33, 1.6, 1.78, 2.4, 4]) {
      const d = writingDistance(aspect)
      expect(d).toBeGreaterThanOrEqual(WRITING_LIMITS.min)
      expect(d).toBeLessThanOrEqual(WRITING_LIMITS.max)
    }
    expect(writingDistance(1.6)).toBeCloseTo(0.1527, 3)
  })

  it('lets the writing view go closer than the overview allows, and keeps its angles in range', () => {
    expect(WRITING_LIMITS.min).toBeLessThan(OVERVIEW_LIMITS.min)
    expect(WRITING_LIMITS.max).toBeLessThan(OVERVIEW_LIMITS.max)
    expect(WRITING_ELEVATION).toBeGreaterThanOrEqual(MIN_ELEVATION)
    expect(WRITING_ELEVATION).toBeLessThanOrEqual(MAX_ELEVATION)
    expect(Math.abs(WRITING_AZIMUTH)).toBeLessThanOrEqual(AZIMUTH_LIMIT)
    expect(WRITING_COLUMNS).toBeGreaterThan(66)
  })
})
