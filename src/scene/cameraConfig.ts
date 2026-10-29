// Camera constants in one place (glTF frame, meters). Decided in the camera discussion of
// 2026-10-29; the SPEC open question "orbit limits or a fixed view" is answered by a limited,
// front-facing orbit: no pan, no view from below the floor or round the back.

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
