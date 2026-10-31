import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import { Vector3, type Camera, type EventDispatcher } from 'three'
import { introEase, lerpSpherical, setFromSpherical, toSpherical, type Spherical, type Vec3 } from '../lib/cameraPath.ts'
import { useCameraUi } from '../ui/cameraUi.ts'
import {
  INTRO_DELAY,
  INTRO_DURATION,
  FOV,
  INTRO_DISTANCE_FACTOR,
  INTRO_FAST_FORWARD,
  INTRO_START_SPHERICAL,
  MOTION_ENABLED,
  overviewDistance,
  overviewLimits,
  REST_SPHERICAL,
  REST_TARGET,
  RESET_DURATION,
  WRITING_AZIMUTH,
  WRITING_DURATION,
  WRITING_ELEVATION,
  WRITING_LIMITS,
  writingFraming,
} from './cameraConfig.ts'

type Phase = 'waiting' | 'flying' | 'done'
interface Intro {
  phase: Phase
  /** Seconds into the current phase or segment. */
  t: number
  /** Progress (0 to 1) the current segment started from. */
  from: number
  duration: number
  /** Latest progress, so a fast-forward can continue from it. */
  e: number
  fastForward: boolean
}

/** A requested move (Reset view or the writing view): from where the camera is to a target pose. */
interface Fly {
  active: boolean
  t: number
  duration: number
  from: Spherical
  fromTarget: Vec3
  to: Spherical
  toTarget: Vec3
}

// The OrbitControls instance, which drei puts in the store as a plain EventDispatcher.
interface Orbit extends EventDispatcher<{ start: object; end: object; change: object }> {
  target: Vector3
  minDistance: number
  maxDistance: number
}
const isOrbit = (c: EventDispatcher | null): c is Orbit => c !== null && 'target' in c

const scratchS: Spherical = { radius: 0, elevation: 0, azimuth: 0 }
const scratchStart: Spherical = { radius: 0, elevation: 0, azimuth: 0 }
const scratchRest: Spherical = { radius: 0, elevation: 0, azimuth: 0 }
const scratchV: Vec3 = { x: 0, y: 0, z: 0 }
const scratchT: [number, number, number] = [0, 0, 0]
const strikeWorld = new Vector3()
// A long frame (shader compile after the model arrives) must not eat the flight.
const MAX_DT = 1 / 20

const aspectOf = (s: { size: { width: number; height: number } }) => s.size.width / s.size.height

/** The resting view for a window of `aspect`: the fixed angles at the overview distance that fits the machine. */
function restFor(aspect: number, out: Spherical): Spherical {
  out.radius = overviewDistance(aspect)
  out.elevation = REST_SPHERICAL.elevation
  out.azimuth = REST_SPHERICAL.azimuth
  return out
}

/** Puts the camera `e` (0 to 1) of the way along the intro path, which ends in the resting view for `aspect`. */
function place(camera: Camera, e: number, aspect: number) {
  const rest = restFor(aspect, scratchRest)
  scratchStart.radius = rest.radius * INTRO_DISTANCE_FACTOR
  scratchStart.elevation = INTRO_START_SPHERICAL.elevation
  scratchStart.azimuth = INTRO_START_SPHERICAL.azimuth
  lerpSpherical(scratchStart, rest, e, scratchS)
  setFromSpherical(scratchV, REST_TARGET, scratchS)
  camera.position.set(scratchV.x, scratchV.y, scratchV.z)
}

function resetIntro(run: Intro) {
  Object.assign(run, { phase: 'waiting', t: 0, from: 0, duration: INTRO_DURATION, e: 0, fastForward: false })
}

/**
 * Sets the distance limits of the current mode, widened to include where the camera is now.
 * OrbitControls clamps the radius on every update, so a limit the camera is outside of would snap
 * it; this way a move that starts or ends outside the new limits (overview to writing and back, or
 * an orbit interrupting one) stays smooth, and the limits tighten again at the next settle.
 */
function settleLimits(camera: Camera, controls: Orbit, aspect: number) {
  const limits = useCameraUi.getState().mode === 'writing' ? WRITING_LIMITS : overviewLimits(aspect)
  const d = camera.position.distanceTo(controls.target)
  controls.minDistance = Math.min(limits.min, d)
  controls.maxDistance = Math.max(limits.max, d)
}

// Drives the camera in two situations: the intro flight along a fixed path, and on request (Reset
// view, the writing view) a flight from wherever the camera is to a target pose. Both only change
// the camera's position (and the orbit target) before OrbitControls' own update at priority -1,
// which then aims the camera, so OrbitControls never fights them and always starts from the pose
// they leave. Mounted inside the same Suspense as the model, so it starts when loading is done.
// Typing is never blocked. With reduced motion the intro is off and the flights jump.
export function CameraRig() {
  const get = useThree((s) => s.get)
  const intro = useRef<Intro>({ phase: 'waiting', t: 0, from: 0, duration: INTRO_DURATION, e: 0, fastForward: false })
  const fly = useRef<Fly>({
    active: false,
    t: 0,
    duration: RESET_DURATION,
    from: { radius: 0, elevation: 0, azimuth: 0 },
    fromTarget: { x: 0, y: 0, z: 0 },
    to: { radius: 0, elevation: 0, azimuth: 0 },
    toTarget: { x: 0, y: 0, z: 0 },
  })

  useEffect(() => {
    const { camera, gl } = get()
    const run = intro.current
    resetIntro(run)
    if (MOTION_ENABLED) place(camera, 0, aspectOf(get()))
    else {
      place(camera, 1, aspectOf(get()))
      run.phase = 'done'
    }

    // Pointer press or wheel: the user takes over. Before the flight has started they have seen
    // nothing move yet, so go straight to the resting view; mid-flight, stay where the camera is.
    const stop = () => {
      if (run.phase === 'done') return
      if (run.phase === 'waiting') place(camera, 1, aspectOf(get()))
      run.phase = 'done'
    }
    // Key press: finish the flight quickly instead of freezing it far away.
    const fastForward = () => {
      if (run.phase === 'done' || run.fastForward) return
      run.fastForward = true
      run.phase = 'flying'
      run.from = run.e
      run.t = 0
      run.duration = INTRO_FAST_FORWARD
    }
    gl.domElement.addEventListener('pointerdown', stop)
    gl.domElement.addEventListener('wheel', stop, { passive: true })
    window.addEventListener('keydown', fastForward)
    return () => {
      gl.domElement.removeEventListener('pointerdown', stop)
      gl.domElement.removeEventListener('wheel', stop)
      window.removeEventListener('keydown', fastForward)
    }
  }, [get])

  // OrbitControls registers itself in the store from its own effect, which can run after this
  // component's in the commit that reveals the model, so wait for it here.
  const hasControls = useThree((s) => s.controls !== null)
  useEffect(() => {
    const { camera, controls } = get()
    if (!isOrbit(controls)) return
    const f = fly.current

    // OrbitControls fires start and end only for input it actually handles, so a click on a 3D key
    // (which turns orbiting off while held) does not count as the user orbiting. A new orbit also
    // cancels a running flight. The view only counts as moved (Reset view is offered) once a
    // change event follows, so a plain click that moves nothing does not; damping keeps changing
    // the view for a moment after the input ends, hence the grace period.
    let down = false
    let lastEnd = -Infinity
    const onStart = () => {
      down = true
      f.active = false
    }
    const onEnd = () => {
      down = false
      lastEnd = performance.now()
      settleLimits(camera, controls, aspectOf(get()))
    }
    const onChange = () => {
      if (f.active) return
      if (down || performance.now() - lastEnd < 2000) useCameraUi.getState().setOrbited(true)
    }
    controls.addEventListener('start', onStart)
    controls.addEventListener('end', onEnd)
    controls.addEventListener('change', onChange)
    settleLimits(camera, controls, aspectOf(get()))

    const startFly = (kind: 'reset' | 'writing') => {
      intro.current.phase = 'done'
      const { target } = controls
      Object.assign(f.from, toSpherical([camera.position.x, camera.position.y, camera.position.z], [target.x, target.y, target.z]))
      f.fromTarget.x = target.x
      f.fromTarget.y = target.y
      f.fromTarget.z = target.z
      if (kind === 'writing') {
        // Look at the strike point (it never moves: the paper slides under it), from the reading angle.
        const strike = get().scene.getObjectByName('StrikePoint')
        if (!strike) throw new Error('CameraRig: node StrikePoint not found in the model')
        strike.getWorldPosition(strikeWorld)
        const { distance, strikeFraction } = writingFraming(aspectOf(get()))
        // In portrait the look-at point sits below the strike point (along the view's up axis), so
        // the strike point shows higher in the window and the keys fit under it.
        const shift = (0.5 - strikeFraction) * 2 * Math.tan((FOV * Math.PI) / 360) * distance
        const sinEl = Math.sin(WRITING_ELEVATION)
        f.toTarget.x = strikeWorld.x + Math.sin(WRITING_AZIMUTH) * sinEl * shift
        f.toTarget.y = strikeWorld.y - Math.cos(WRITING_ELEVATION) * shift
        f.toTarget.z = strikeWorld.z + Math.cos(WRITING_AZIMUTH) * sinEl * shift
        f.to.radius = distance
        f.to.elevation = WRITING_ELEVATION
        f.to.azimuth = WRITING_AZIMUTH
        f.duration = WRITING_DURATION
      } else {
        restFor(aspectOf(get()), f.to)
        f.toTarget.x = REST_TARGET[0]
        f.toTarget.y = REST_TARGET[1]
        f.toTarget.z = REST_TARGET[2]
        f.duration = RESET_DURATION
      }
      f.t = 0
      f.active = true
      settleLimits(camera, controls, aspectOf(get()))
    }
    const unsubscribe = useCameraUi.subscribe((state, prev) => {
      if (state.requestSeq !== prev.requestSeq) startFly(state.request)
    })
    return () => {
      controls.removeEventListener('start', onStart)
      controls.removeEventListener('end', onEnd)
      controls.removeEventListener('change', onChange)
      unsubscribe()
      f.active = false
    }
  }, [get, hasControls])

  // A new window shape (rotating a phone, resizing the browser) changes the fitted overview
  // distance. Re-fit only while the view is untouched; once the user has orbited, zoomed or gone to
  // the writing view, only Reset view fits it, so the camera never jumps under their hands. The
  // flight is the Reset view one. A change in the writing view is left alone too (it fits at request time).
  const size = useThree((s) => s.size)
  const lastRest = useRef(0)
  useEffect(() => {
    const radius = overviewDistance(size.width / size.height)
    const previous = lastRest.current
    lastRest.current = radius
    if (previous === 0 || Math.abs(radius - previous) < 1e-3) return
    const ui = useCameraUi.getState()
    if (ui.orbited || ui.mode !== 'overview' || intro.current.phase !== 'done' || fly.current.active) return
    ui.requestReset()
  }, [size])

  useFrame((state, delta) => {
    const run = intro.current
    const dt = Math.min(delta, MAX_DT)

    if (run.phase !== 'done') {
      run.t += dt
      if (run.phase === 'waiting') {
        if (run.t < INTRO_DELAY) return
        run.phase = 'flying'
        run.t = 0
      }
      run.e = introEase(run.from, run.t, run.duration)
      place(state.camera, run.e, aspectOf(state))
      if (run.t >= run.duration) run.phase = 'done'
      return
    }

    const f = fly.current
    const { controls } = state
    if (!f.active || !isOrbit(controls)) return
    f.t += dt
    const e = MOTION_ENABLED && f.duration > 0 ? introEase(0, f.t, f.duration) : 1
    lerpSpherical(f.from, f.to, e, scratchS)
    scratchT[0] = f.fromTarget.x + (f.toTarget.x - f.fromTarget.x) * e
    scratchT[1] = f.fromTarget.y + (f.toTarget.y - f.fromTarget.y) * e
    scratchT[2] = f.fromTarget.z + (f.toTarget.z - f.fromTarget.z) * e
    setFromSpherical(scratchV, scratchT, scratchS)
    state.camera.position.set(scratchV.x, scratchV.y, scratchV.z)
    controls.target.set(scratchT[0], scratchT[1], scratchT[2])
    if (e >= 1) {
      f.active = false
      settleLimits(state.camera, controls, aspectOf(state))
    }
  }, -2)

  return null
}
