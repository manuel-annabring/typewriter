import { carriageShiftM } from './carriage.ts'

// Pure camera maths (no three.js): positions as spherical coordinates round the orbit target, and
// the timing of the intro flight. Azimuth 0 is the front (+z, keyboard side) and grows toward +x;
// elevation is the angle above the horizontal. This is also OrbitControls' own convention.

export interface Spherical {
  radius: number
  elevation: number
  azimuth: number
}

export interface Vec3 {
  x: number
  y: number
  z: number
}

type Tuple3 = readonly [number, number, number]

export const easeOutCubic = (t: number): number => 1 - (1 - t) ** 3

const clamp01 = (t: number): number => Math.min(1, Math.max(0, t))

export function toSpherical(position: Tuple3, target: Tuple3): Spherical {
  const dx = position[0] - target[0]
  const dy = position[1] - target[1]
  const dz = position[2] - target[2]
  return {
    radius: Math.hypot(dx, dy, dz),
    elevation: Math.atan2(dy, Math.hypot(dx, dz)),
    azimuth: Math.atan2(dx, dz),
  }
}

/** Writes the position `s` away from `target` into `out` (no allocation). */
export function setFromSpherical(out: Vec3, target: Tuple3, s: Spherical): void {
  const flat = s.radius * Math.cos(s.elevation)
  out.x = target[0] + flat * Math.sin(s.azimuth)
  out.y = target[1] + s.radius * Math.sin(s.elevation)
  out.z = target[2] + flat * Math.cos(s.azimuth)
}

/** Writes the blend of `a` (e = 0) and `b` (e = 1) into `out`. Each field is blended linearly. */
export function lerpSpherical(a: Spherical, b: Spherical, e: number, out: Spherical): void {
  out.radius = a.radius + (b.radius - a.radius) * e
  out.elevation = a.elevation + (b.elevation - a.elevation) * e
  out.azimuth = a.azimuth + (b.azimuth - a.azimuth) * e
}

/**
 * Intro progress (0 to 1) `t` seconds into a segment that starts at `from` and ends at 1 after
 * `duration` seconds, easing out. The first segment starts at 0; a fast-forward starts a new one
 * from wherever the flight had got to, so the camera never jumps.
 */
export function introEase(from: number, t: number, duration: number): number {
  return from + (1 - from) * easeOutCubic(clamp01(t / duration))
}

// Event moves: small offsets on top of whatever the user's orbit has set up (see CameraRig).

/** Frame-rate independent ease of `current` toward `target`; `lambda` is a rate per second. */
export function damp(current: number, target: number, lambda: number, dt: number): number {
  return current + (target - current) * (1 - Math.exp(-lambda * dt))
}

/** How far (m, along x) the look-at point follows the carriage: `factor` of its travel since column 0. */
export function followOffsetM(col: number, factor: number): number {
  return -factor * (carriageShiftM(col) - carriageShiftM(0))
}

/** True while a character was printed less than `window` seconds ago. */
export function isTyping(now: number, lastActivity: number, window: number): boolean {
  return now - lastActivity < window
}

/** True once something was typed and then nothing for more than `delay` seconds. */
export function isIdleAfterTyping(typedOnce: boolean, now: number, lastActivity: number, delay: number): boolean {
  return typedOnce && now - lastActivity > delay
}

/** 1 when the event moves may act, 0 while the user is orbiting or for `resumeDelay` s after. */
export function userGateTarget(userDown: boolean, now: number, lastInput: number, resumeDelay: number): number {
  return userDown || now - lastInput < resumeDelay ? 0 : 1
}

/** Camera distance factor: push in while typing, pull back when idle, all scaled by the gate. */
export function distanceScale(push: number, pull: number, gate: number, pushIn: number, pullBack: number): number {
  return 1 + gate * (pullBack * pull - pushIn * push)
}

/**
 * Limits a distance factor so the camera, at `base` (the user's own distance) times the factor,
 * stays within [min, max]. OrbitControls would clamp it anyway, but then undoing the factor later
 * would not return to the user's distance.
 */
export function clampScale(scale: number, base: number, min: number, max: number): number {
  return Math.min(max / base, Math.max(min / base, scale))
}
