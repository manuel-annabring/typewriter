import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import type { Camera } from 'three'
import { introEase, lerpSpherical, setFromSpherical, type Spherical, type Vec3 } from '../lib/cameraPath.ts'
import {
  INTRO_DELAY,
  INTRO_DURATION,
  INTRO_FAST_FORWARD,
  INTRO_START_SPHERICAL,
  REST_SPHERICAL,
  REST_TARGET,
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

const scratchS: Spherical = { radius: 0, elevation: 0, azimuth: 0 }
const scratchV: Vec3 = { x: 0, y: 0, z: 0 }
// A long frame (shader compile after the model arrives) must not eat the flight.
const MAX_DT = 1 / 20

function place(camera: Camera, e: number) {
  lerpSpherical(INTRO_START_SPHERICAL, REST_SPHERICAL, e, scratchS)
  setFromSpherical(scratchV, REST_TARGET, scratchS)
  camera.position.set(scratchV.x, scratchV.y, scratchV.z)
}

// Drives the camera along the intro flight, then hands it to OrbitControls. It only sets the
// camera position (before OrbitControls' own update at priority -1, which then aims it at the
// target), so OrbitControls never fights it and picks up the pose it ends on. Mounted inside the
// same Suspense as the model, so it starts when loading is done. Typing is never blocked.
export function CameraRig() {
  const get = useThree((s) => s.get)
  const intro = useRef<Intro>({ phase: 'waiting', t: 0, from: 0, duration: INTRO_DURATION, e: 0, fastForward: false })

  useEffect(() => {
    const { camera, gl } = get()
    const run = intro.current
    Object.assign(run, { phase: 'waiting', t: 0, from: 0, duration: INTRO_DURATION, e: 0, fastForward: false })
    place(camera, 0)

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

  useFrame((state, delta) => {
    const run = intro.current
    if (run.phase === 'done') return
    run.t += Math.min(delta, MAX_DT)
    if (run.phase === 'waiting') {
      if (run.t < INTRO_DELAY) return
      run.phase = 'flying'
      run.t = 0
    }
    run.e = introEase(run.from, run.t, run.duration)
    place(state.camera, run.e)
    if (run.t >= run.duration) run.phase = 'done'
  }, -2)

  return null
}
