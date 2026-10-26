import { useThree, type ThreeElements, type ThreeEvent } from '@react-three/fiber'
import { useCallback, useEffect, useLayoutEffect, useRef } from 'react'
import type { Group, Object3D } from 'three'
import { holdKey } from '../input/dispatchKey.ts'
import { assertModelContract, KEY_NODE_NAMES } from './contract.ts'
import { Model } from './TypewriterModel.generated.tsx'
import { useCarriageAnimation } from './useCarriageAnimation.ts'
import { useKeyLabels } from './useKeyLabels.ts'
import { useKeyPressAnimation } from './useKeyPressAnimation.ts'
import { useLeverAnimation } from './useLeverAnimation.ts'
import { usePaperBend } from './usePaperBend.ts'
import { usePaperTexture } from './usePaperTexture.ts'

// The 3D keys and the carriage return lever are what the pointer can press.
const PRESSABLE_NAMES = new Set([...KEY_NODE_NAMES, 'Lever'])

/** Walks up from a hit mesh (e.g. Key_A_1) to the pressable node named in the contract (Key_A). */
function pressableOf(object: Object3D): string | null {
  for (let o: Object3D | null = object; o; o = o.parent) {
    if (PRESSABLE_NAMES.has(o.name)) return o.name
  }
  return null
}

// Behavior lives here, not in the generated file, so regenerating the model
// from Blender never overwrites it. r3f pointer events bubble up the scene
// graph, so one handler on a wrapper group covers every key mesh.
export function Typewriter(props: ThreeElements['group']) {
  const root = useRef<Group>(null)

  useLayoutEffect(() => {
    if (import.meta.env.DEV && root.current) assertModelContract(root.current)
  }, [])
  useKeyPressAnimation(root)
  usePaperTexture(root)
  useKeyLabels(root)
  useCarriageAnimation(root)
  usePaperBend(root)
  useLeverAnimation(root)

  const get = useThree((state) => state.get)
  const setCursor = useCallback(
    (value: '' | 'pointer') => {
      get().gl.domElement.style.cursor = value
    },
    [get],
  )
  const setOrbitEnabled = useCallback(
    (enabled: boolean) => {
      const controls = get().controls
      if (controls && 'enabled' in controls) controls.enabled = enabled
    },
    [get],
  )
  const releaseHeld = useRef<(() => void) | null>(null)

  useEffect(() => {
    // The pointer can leave the key (or the window) before the button goes up,
    // so release on window-level events, not on the key's own pointerup.
    const release = () => {
      releaseHeld.current?.()
      releaseHeld.current = null
    }
    window.addEventListener('pointerup', release)
    window.addEventListener('pointercancel', release)
    window.addEventListener('blur', release)
    return () => {
      window.removeEventListener('pointerup', release)
      window.removeEventListener('pointercancel', release)
      window.removeEventListener('blur', release)
      release()
      setCursor('')
    }
  }, [setCursor])

  const onPointerDown = useCallback((e: ThreeEvent<PointerEvent>) => {
    const name = pressableOf(e.object)
    // Raycasts don't occlude: without this, a click on the Body would also reach a key lever
    // behind it, so any non-pressable hit stops the event too.
    e.stopPropagation()
    if (!name) return
    releaseHeld.current?.()
    const releaseKey = holdKey(name)
    // OrbitControls listens on the DOM, so stopPropagation above doesn't stop
    // it. Pause it for the duration of the press so a drag doesn't spin the camera.
    setOrbitEnabled(false)
    releaseHeld.current = () => {
      releaseKey()
      setOrbitEnabled(true)
    }
  }, [setOrbitEnabled])

  // Over and move both assert the cursor: on entry from one mesh of a key to
  // another, an out can land after an over, and move corrects that.
  const showCursor = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation()
      setCursor(pressableOf(e.object) ? 'pointer' : '')
    },
    [setCursor],
  )

  const onPointerOut = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      if (pressableOf(e.object)) setCursor('')
    },
    [setCursor],
  )

  return (
    <group ref={root} {...props}>
      <group onPointerDown={onPointerDown} onPointerOver={showCursor} onPointerMove={showCursor} onPointerOut={onPointerOut}>
        <Model />
      </group>
    </group>
  )
}
