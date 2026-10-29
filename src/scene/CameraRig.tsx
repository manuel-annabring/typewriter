import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import { Vector3, type Camera, type EventDispatcher } from 'three'
import {
  clampScale,
  damp,
  distanceScale,
  followOffsetM,
  introEase,
  isIdleAfterTyping,
  isTyping,
  lerpSpherical,
  setFromSpherical,
  userGateTarget,
  type Spherical,
  type Vec3,
} from '../lib/cameraPath.ts'
import { useTypewriterStore } from '../store/typewriterStore.ts'
import {
  FOLLOW_FACTOR,
  IDLE_DELAY,
  INTRO_DELAY,
  INTRO_DURATION,
  INTRO_FAST_FORWARD,
  INTRO_START_SPHERICAL,
  LAMBDA_FOLLOW,
  LAMBDA_GATE_IN,
  LAMBDA_GATE_OUT,
  LAMBDA_PULL,
  LAMBDA_PUSH,
  MAX_DISTANCE,
  MIN_DISTANCE,
  PULL_BACK,
  PUSH_IN,
  REST_SPHERICAL,
  REST_TARGET,
  RESUME_DELAY,
  TYPING_WINDOW,
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

/** The event moves' state. Times are performance.now() / 1000. */
interface Moves {
  lastActivity: number
  typedOnce: boolean
  userDown: boolean
  lastInput: number
  // Smoothed levels: follow in meters, push, pull and gate in 0 to 1.
  follow: number
  push: number
  pull: number
  gate: number
  // What is currently applied to the camera and the orbit target (a shift along x, a distance factor).
  appliedX: number
  appliedScale: number
}

// The OrbitControls instance, which drei puts in the store as a plain EventDispatcher.
interface Orbit extends EventDispatcher<{ start: object; end: object }> {
  target: Vector3
}
const isOrbit = (c: EventDispatcher | null): c is Orbit => c !== null && 'target' in c

const scratchS: Spherical = { radius: 0, elevation: 0, azimuth: 0 }
const scratchV: Vec3 = { x: 0, y: 0, z: 0 }
const scratchOffset = new Vector3()
// A long frame (shader compile after the model arrives) must not eat the flight.
const MAX_DT = 1 / 20

const now = () => performance.now() / 1000

function place(camera: Camera, e: number) {
  lerpSpherical(INTRO_START_SPHERICAL, REST_SPHERICAL, e, scratchS)
  setFromSpherical(scratchV, REST_TARGET, scratchS)
  camera.position.set(scratchV.x, scratchV.y, scratchV.z)
}

/** Moves camera and target by `dx` along x and the camera toward or away from the target by `f`. */
function shift(camera: Camera, target: Vector3, dx: number, f: number) {
  camera.position.x += dx
  target.x += dx
  if (f !== 1) {
    scratchOffset.copy(camera.position).sub(target).multiplyScalar(f)
    camera.position.copy(target).add(scratchOffset)
  }
}

function resetIntro(run: Intro) {
  Object.assign(run, { phase: 'waiting', t: 0, from: 0, duration: INTRO_DURATION, e: 0, fastForward: false })
}

// Drives the camera in two stages. First the intro flight along a fixed path; then, for good, the
// event moves, which are offsets on top of the user's own orbit. Both only change the camera's
// position (and the orbit target) before OrbitControls' own update at priority -1, which then aims
// the camera, so OrbitControls never fights them and always starts from the pose they leave.
// Mounted inside the same Suspense as the model, so it starts when loading is done. Typing is
// never blocked.
export function CameraRig() {
  const get = useThree((s) => s.get)
  const intro = useRef<Intro>({ phase: 'waiting', t: 0, from: 0, duration: INTRO_DURATION, e: 0, fastForward: false })
  const moves = useRef<Moves>({
    lastActivity: -Infinity,
    typedOnce: false,
    userDown: false,
    lastInput: -Infinity,
    follow: 0,
    push: 0,
    pull: 0,
    gate: 0,
    appliedX: 0,
    appliedScale: 1,
  })

  useEffect(() => {
    const { camera, gl } = get()
    const run = intro.current
    const fx = moves.current
    resetIntro(run)
    Object.assign(fx, { lastActivity: -Infinity, typedOnce: false, userDown: false, lastInput: -Infinity })
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

    // Typing activity: any change of the cursor (a character, a space, a backspace, a return).
    const unsubscribe = useTypewriterStore.subscribe((s, prev) => {
      if (s.cursor === prev.cursor) return
      fx.lastActivity = now()
      fx.typedOnce = true
    })

    return () => {
      gl.domElement.removeEventListener('pointerdown', stop)
      gl.domElement.removeEventListener('wheel', stop)
      window.removeEventListener('keydown', fastForward)
      unsubscribe()
    }
  }, [get])

  // OrbitControls registers itself in the store from its own effect, which can run after this
  // component's in the commit that reveals the model, so wait for it here.
  const hasControls = useThree((s) => s.controls !== null)
  useEffect(() => {
    const { camera, controls } = get()
    if (!isOrbit(controls)) return
    const fx = moves.current
    Object.assign(fx, { follow: 0, push: 0, pull: 0, gate: 0, appliedX: 0, appliedScale: 1 })

    // OrbitControls fires start and end only for input it actually handles, so a click on a 3D key
    // (which turns orbiting off while held) does not count as the user orbiting.
    const onStart = () => {
      fx.userDown = true
      fx.lastInput = now()
    }
    const onEnd = () => {
      fx.userDown = false
      fx.lastInput = now()
    }
    controls.addEventListener('start', onStart)
    controls.addEventListener('end', onEnd)
    return () => {
      controls.removeEventListener('start', onStart)
      controls.removeEventListener('end', onEnd)
      // Leave no offset behind for the next mount (hot reload) to inherit.
      shift(camera, controls.target, -fx.appliedX, 1 / fx.appliedScale)
      fx.appliedX = 0
      fx.appliedScale = 1
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

    const { controls } = state
    if (!isOrbit(controls)) return
    const fx = moves.current
    const t = now()

    // Smooth each level toward its target, then apply only the change since last frame, so the
    // user's own orbit (which OrbitControls keeps reading from the camera) is never overwritten.
    // The gate falls fast (the user takes over) and rises slowly (the moves ease back in).
    const gateTarget = userGateTarget(fx.userDown, t, fx.lastInput, RESUME_DELAY)
    fx.gate = damp(fx.gate, gateTarget, gateTarget < fx.gate ? LAMBDA_GATE_OUT : LAMBDA_GATE_IN, dt)
    fx.follow = damp(fx.follow, followOffsetM(useTypewriterStore.getState().cursor.col, FOLLOW_FACTOR), LAMBDA_FOLLOW, dt)
    fx.push = damp(fx.push, isTyping(t, fx.lastActivity, TYPING_WINDOW) ? 1 : 0, LAMBDA_PUSH, dt)
    fx.pull = damp(fx.pull, isIdleAfterTyping(fx.typedOnce, t, fx.lastActivity, IDLE_DELAY) ? 1 : 0, LAMBDA_PULL, dt)

    const x = fx.gate * fx.follow
    const base = state.camera.position.distanceTo(controls.target) / fx.appliedScale
    const scale = clampScale(distanceScale(fx.push, fx.pull, fx.gate, PUSH_IN, PULL_BACK), base, MIN_DISTANCE, MAX_DISTANCE)
    shift(state.camera, controls.target, x - fx.appliedX, scale / fx.appliedScale)
    fx.appliedX = x
    fx.appliedScale = scale
  }, -2)

  return null
}
