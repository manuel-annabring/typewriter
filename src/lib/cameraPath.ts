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

export interface Box3Like {
  min: Tuple3
  max: Tuple3
}

/**
 * Smallest camera distance from `target`, looking at it from `azimuth` / `elevation`, at which the
 * width of `box` (all eight corners, projected on the view's horizontal axis) fits in the view
 * with `margin` (fraction of the view, e.g. 0.06) to spare on each side. Only the width is fitted:
 * the vertical field of view is fixed, so height is what the resting view already settles for and
 * only a narrow window needs the camera to back off. `fovDeg` is vertical, `aspect` is
 * width / height. Perspective is exact per corner (a corner nearer the camera needs more room), but
 * the box is a stand-in for the machine, so the result is slightly generous.
 */
export function fitBoxWidthDistance(
  box: Box3Like,
  target: Tuple3,
  azimuth: number,
  elevation: number,
  fovDeg: number,
  aspect: number,
  margin: number,
): number {
  const tanH = Math.tan((fovDeg * Math.PI) / 360) * aspect * (1 - margin)
  const sa = Math.sin(azimuth)
  const ca = Math.cos(azimuth)
  const se = Math.sin(elevation)
  const ce = Math.cos(elevation)
  let need = 0
  for (let i = 0; i < 8; i++) {
    const cx = (i & 1 ? box.max[0] : box.min[0]) - target[0]
    const cy = (i & 2 ? box.max[1] : box.min[1]) - target[1]
    const cz = (i & 4 ? box.max[2] : box.min[2]) - target[2]
    // Right axis of the camera, and the direction from the target toward the camera.
    const x = cx * ca - cz * sa
    const toward = cx * sa * ce + cy * se + cz * ca * ce
    need = Math.max(need, toward + Math.abs(x) / tanH)
  }
  return need
}
