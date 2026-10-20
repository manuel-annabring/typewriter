import { useThree, type ThreeElements, type ThreeEvent } from '@react-three/fiber'
import { useCallback, useEffect, useLayoutEffect, useRef } from 'react'
import type { Group, Object3D } from 'three'
import { holdKey } from '../input/dispatchKey.ts'
import { assertModelContract, KEY_NODE_NAMES } from './contract.ts'
import { Model } from './TypewriterModel.generated.tsx'

const KEY_NAMES = new Set(KEY_NODE_NAMES)

/** Walks up from a hit mesh (e.g. Key_A_1) to the key node named in the contract (Key_A). */
function keyNameOf(object: Object3D): string | null {
  for (let o: Object3D | null = object; o; o = o.parent) {
    if (KEY_NAMES.has(o.name)) return o.name
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

  const get = useThree((state) => state.get)
  const setCursor = useCallback(
    (value: '' | 'pointer') => {
      get().gl.domElement.style.cursor = value
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
    const name = keyNameOf(e.object)
    if (!name) return
    e.stopPropagation()
    releaseHeld.current?.()
    releaseHeld.current = holdKey(name)
  }, [])

  // Over and move both assert the cursor: on entry from one mesh of a key to
  // another, an out can land after an over, and move corrects that.
  const showCursor = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      if (!keyNameOf(e.object)) return
      e.stopPropagation()
      setCursor('pointer')
    },
    [setCursor],
  )

  const onPointerOut = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      if (keyNameOf(e.object)) setCursor('')
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
