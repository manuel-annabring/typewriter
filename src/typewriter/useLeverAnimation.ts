import { useFrame } from '@react-three/fiber'
import { useLayoutEffect, useRef, type RefObject } from 'react'
import { MathUtils, type Object3D } from 'three'
import { useTypewriterStore } from '../store/typewriterStore.ts'

/** How far the lever swings down, about its hinge (local Z). Any further and the arm meets the left knob. */
const PRESS_ANGLE = MathUtils.degToRad(25)
const LAMBDA_DOWN = 25
const LAMBDA_UP = 12
const SETTLE_EPSILON = 1e-4
/** Names that drive the lever: the 3D lever itself, and the Enter key (same action). */
const TRIGGERS: readonly string[] = ['Lever', 'Key_Enter']

interface LeverRig {
  node: Object3D
  restZ: number
  angle: number
}

/**
 * Swings the lever down while it, or Enter, is held. The return itself is store
 * state (see returnCarriage); this is only the lever's visual.
 */
export function useLeverAnimation(root: RefObject<Object3D | null>): void {
  const rig = useRef<LeverRig | null>(null)

  useLayoutEffect(() => {
    const node = root.current?.getObjectByName('Lever')
    if (!node) throw new Error('Lever animation: node Lever not found in the model')
    rig.current = { node, restZ: node.rotation.z, angle: 0 }
    return () => {
      node.rotation.z = rig.current?.restZ ?? node.rotation.z
      rig.current = null
    }
  }, [root])

  useFrame((_, delta) => {
    const r = rig.current
    if (!r) return
    const pressed = useTypewriterStore.getState().pressedKeys.some((k) => TRIGGERS.includes(k))
    const target = pressed ? PRESS_ANGLE : 0
    if (r.angle === target) return
    let next = MathUtils.damp(r.angle, target, target > r.angle ? LAMBDA_DOWN : LAMBDA_UP, delta)
    if (Math.abs(next - target) < SETTLE_EPSILON) next = target
    r.angle = next
    r.node.rotation.z = r.restZ + next
  })
}
