// Camera constants in one place (glTF frame, meters). Decided in the camera discussion of
// 2026-10-29; the SPEC open question "orbit limits or a fixed view" is answered by a limited,
// front-facing orbit: no pan, no view from below the floor or round the back.

import { fitDistance, setFromSpherical, toSpherical, type Spherical, type Vec3 } from '../lib/cameraPath.ts'
import { PITCH_MM } from '../lib/paperGrid.ts'

const DEG = Math.PI / 180

/** The machine is the orbit target, so panning is off and it can't be lost. */
export const REST_TARGET: readonly [number, number, number] = [0.05, 0.12, 0]
/** Resting view: 0.69 m from the target, azimuth 28.6 degrees, elevation 24.1 degrees. */
export const REST_POSITION: readonly [number, number, number] = [0.35, 0.4, 0.55]
export const FOV = 40

// Limits are measured from the target. Elevation is the angle above the horizontal; OrbitControls
// uses the polar angle from straight up, so it is 90 degrees minus the elevation (hence min and
// max swap). Azimuth 0 is the front (+z, keyboard side).
export const MIN_ELEVATION = 8 * DEG
export const MAX_ELEVATION = 61 * DEG
export const MIN_POLAR_ANGLE = Math.PI / 2 - MAX_ELEVATION
export const MAX_POLAR_ANGLE = Math.PI / 2 - MIN_ELEVATION
export const AZIMUTH_LIMIT = 70 * DEG
export const MIN_DISTANCE = 0.3
export const MAX_DISTANCE = 1.5
export const DAMPING_FACTOR = 0.08

export const REST_SPHERICAL: Spherical = toSpherical(REST_POSITION, REST_TARGET)

// Intro flight: starts 2x as far away, 45 degrees up and swung 40 degrees to the left of the
// resting view, then eases out into it. It waits for the loader's fade, and a key press
// fast-forwards it; a pointer press or the wheel stops it where it is.
export const INTRO_START_SPHERICAL: Spherical = {
  radius: REST_SPHERICAL.radius * 2,
  elevation: 45 * DEG,
  azimuth: REST_SPHERICAL.azimuth - 40 * DEG,
}
export const INTRO_START_POSITION: readonly [number, number, number] = (() => {
  const p: Vec3 = { x: 0, y: 0, z: 0 }
  setFromSpherical(p, REST_TARGET, INTRO_START_SPHERICAL)
  return [p.x, p.y, p.z]
})()
export const INTRO_DURATION = 2.5
/** The loader overlay fades out over 0.4 s once loading is done (ui/Loader). */
export const INTRO_DELAY = 0.4
export const INTRO_FAST_FORWARD = 0.4
/** Reduced motion turns off the intro (the camera starts at the resting view) and makes Reset view jump. */
export const MOTION_ENABLED = typeof window === 'undefined' || !window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** The Reset view button eases the camera back to the resting view in this long (s). */
export const RESET_DURATION = 0.8

// Writing view (decided 2026-10-30): a click on the carriage, or the Writing view button, flies the
// camera to the strike point so the typed line is easy to read. The typed text lies left of the
// strike point (the paper slides left under it), so the strike point itself is the look-at point.
// The distance fits WRITING_COLUMNS character cells across the window, whatever its shape, within
// the writing limits (which replace the overview limits while the mode is on; Reset view restores
// them). Orbit and zoom still work there, pan stays off.
export const WRITING_ELEVATION = 20 * DEG
/** Almost frontal: a little off the front so the machine keeps some depth. */
export const WRITING_AZIMUTH = 3 * DEG
export const WRITING_COLUMNS = 70
export const WRITING_DURATION = 1
export const WRITING_MIN_DISTANCE = 0.08
export const WRITING_MAX_DISTANCE = 0.4

export interface DistanceLimits {
  min: number
  max: number
}
export const OVERVIEW_LIMITS: DistanceLimits = { min: MIN_DISTANCE, max: MAX_DISTANCE }
export const WRITING_LIMITS: DistanceLimits = { min: WRITING_MIN_DISTANCE, max: WRITING_MAX_DISTANCE }

/** Distance of the writing view for a window of `aspect` (width / height). */
export function writingDistance(aspect: number): number {
  const fit = fitDistance(WRITING_COLUMNS, PITCH_MM / 1000, FOV, aspect)
  return Math.min(WRITING_MAX_DISTANCE, Math.max(WRITING_MIN_DISTANCE, fit))
}
