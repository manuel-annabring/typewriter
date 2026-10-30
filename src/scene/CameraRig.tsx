import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import type { Camera, EventDispatcher, Vector3 } from 'three'
import { introEase, lerpSpherical, setFromSpherical, toSpherical, type Spherical, type Vec3 } from '../lib/cameraPath.ts'
import { useCameraUi } from '../ui/cameraUi.ts'
import {
  INTRO_DELAY,
  INTRO_DURATION,
  INTRO_FAST_FORWARD,
  INTRO_START_SPHERICAL,
  MOTION_ENABLED,
  REST_SPHERICAL,
  REST_TARGET,
  RESET_DURATION,
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

/** The Reset view ease: from where the camera was (relative to the target) and where the target was. */
interface Reset {
  active: boolean
  t: number
  from: Spherical
  fromTarget: Vec3
}

// The OrbitControls instance, which drei puts in the store as a plain EventDispatcher.
interface Orbit extends EventDispatcher<{ start: object }> {
  target: Vector3
}
const isOrbit = (c: EventDispatcher | null): c is Orbit => c !== null && 'target' in c

const scratchS: Spherical = { radius: 0, elevation: 0, azimuth: 0 }
const scratchV: Vec3 = { x: 0, y: 0, z: 0 }
const scratchT: [number, number, number] = [0, 0, 0]
// A long frame (shader compile after the model arrives) must not eat the flight.
const MAX_DT = 1 / 20

function place(camera: Camera, e: number) {
  lerpSpherical(INTRO_START_SPHERICAL, REST_SPHERICAL, e, scratchS)
  setFromSpherical(scratchV, REST_TARGET, scratchS)
  camera.position.set(scratchV.x, scratchV.y, scratchV.z)
}

function resetIntro(run: Intro) {
  Object.assign(run, { phase: 'waiting', t: 0, from: 0, duration: INTRO_DURATION, e: 0, fastForward: false })
}

// Drives the camera in two situations: the intro flight along a fixed path, and on request (Reset
// view) an ease back to the resting view. Both only change the camera's position (and the orbit
// target) before OrbitControls' own update at priority -1, which then aims the camera, so
// OrbitControls never fights them and always starts from the pose they leave. Mounted inside the
// same Suspense as the model, so it starts when loading is done. Typing is never blocked. With
// reduced motion the intro is off and Reset view jumps instead of easing.
export function CameraRig() {
  const get = useThree((s) => s.get)
  const intro = useRef<Intro>({ phase: 'waiting', t: 0, from: 0, duration: INTRO_DURATION, e: 0, fastForward: false })
  const reset = useRef<Reset>({
    active: false,
    t: 0,
    from: { radius: 0, elevation: 0, azimuth: 0 },
    fromTarget: { x: 0, y: 0, z: 0 },
  })

  useEffect(() => {
    const { camera, gl } = get()
    const run = intro.current
    resetIntro(run)
    if (MOTION_ENABLED) place(camera, 0)
    else run.phase = 'done'

    // Pointer press or wheel: the user takes over. Before the flight has started they have seen
    // nothing move yet, so go straight to the resting view; mid-flight, stay where the camera is.
    const stop = () => {
      if (run.phase === 'done') return
      if (run.phase === 'waiting') place(camera, 1)
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
    const rs = reset.current

    // OrbitControls fires start only for input it actually handles, so a click on a 3D key (which
    // turns orbiting off while held) does not count as the user orbiting. A new orbit also cancels
    // a running reset ease.
    const onStart = () => {
      rs.active = false
      useCameraUi.getState().setOrbited(true)
    }
    controls.addEventListener('start', onStart)

    // Reset view: ease from wherever the camera is to the resting view.
    const unsubscribe = useCameraUi.subscribe((state, prev) => {
      if (state.resetSeq === prev.resetSeq) return
      intro.current.phase = 'done'
      const { target } = controls
      Object.assign(rs.from, toSpherical([camera.position.x, camera.position.y, camera.position.z], [target.x, target.y, target.z]))
      rs.fromTarget.x = target.x
      rs.fromTarget.y = target.y
      rs.fromTarget.z = target.z
      rs.t = 0
      rs.active = true
    })
    return () => {
      controls.removeEventListener('start', onStart)
      unsubscribe()
      rs.active = false
    }
  }, [get, hasControls])

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
      place(state.camera, run.e)
      if (run.t >= run.duration) run.phase = 'done'
      return
    }

    const rs = reset.current
    const { controls } = state
    if (!rs.active || !isOrbit(controls)) return
    rs.t += dt
    const e = MOTION_ENABLED && RESET_DURATION > 0 ? introEase(0, rs.t, RESET_DURATION) : 1
    lerpSpherical(rs.from, REST_SPHERICAL, e, scratchS)
    scratchT[0] = rs.fromTarget.x + (REST_TARGET[0] - rs.fromTarget.x) * e
    scratchT[1] = rs.fromTarget.y + (REST_TARGET[1] - rs.fromTarget.y) * e
    scratchT[2] = rs.fromTarget.z + (REST_TARGET[2] - rs.fromTarget.z) * e
    setFromSpherical(scratchV, scratchT, scratchS)
    state.camera.position.set(scratchV.x, scratchV.y, scratchV.z)
    controls.target.set(scratchT[0], scratchT[1], scratchT[2])
    if (e >= 1) rs.active = false
  }, -2)

  return null
}
