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

/**
 * Camera distance at which `columns` character cells of `pitchM` meters span the full view width,
 * for a vertical field of view of `fovDeg` degrees and a window of `aspect` (width / height).
 * The sheet is treated as flat and square to the view.
 */
export function fitDistance(columns: number, pitchM: number, fovDeg: number, aspect: number): number {
  const visibleHeightPerMeter = 2 * Math.tan((fovDeg * Math.PI) / 360)
  return (columns * pitchM) / (visibleHeightPerMeter * aspect)
}
