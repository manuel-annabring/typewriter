import { useFrame } from '@react-three/fiber'
import { useLayoutEffect, useRef, type RefObject } from 'react'
import { MathUtils, type Object3D } from 'three'
import { useTypewriterStore } from '../store/typewriterStore.ts'
import { KEY_NODE_NAMES } from './contract.ts'

/** How far a pressed key sinks, in meters (model scale). */
const PRESS_DEPTH = 0.004
/** Damping rates for MathUtils.damp: higher is faster. Press is snappier than release. */
const LAMBDA_DOWN = 40
const LAMBDA_UP = 20
const SETTLE_EPSILON = 1e-5

interface KeyRig {
  nodes: Object3D[]
  restY: number[]
  sink: number[]
}

/**
 * Sinks each pressed key along local -Y (keys sit directly under an unrotated
 * Scene group, so that is world down) and eases it back on release.
 * Reads pressedKeys per frame from the store; nothing here re-renders.
 */
export function useKeyPressAnimation(root: RefObject<Object3D | null>): void {
  const rig = useRef<KeyRig | null>(null)

  useLayoutEffect(() => {
    const scene = root.current
    if (!scene) return
    const nodes: Object3D[] = []
    for (const name of KEY_NODE_NAMES) {
      const node = scene.getObjectByName(name)
      if (!node) throw new Error(`Key animation: node ${name} not found in the model`)
      nodes.push(node)
    }
    // Plain number arrays, not Float32Array: float32 would round the rest Y,
    // and a released key must return to exactly its authored position.
    rig.current = { nodes, restY: nodes.map((n) => n.position.y), sink: nodes.map(() => 0) }
    return () => {
      // Put keys back at rest if the component unmounts mid-press.
      rig.current?.nodes.forEach((n, i) => {
        n.position.y = rig.current?.restY[i] ?? n.position.y
      })
      rig.current = null
    }
  }, [root])

  useFrame((_, delta) => {
    const r = rig.current
    if (!r) return
    const pressed = useTypewriterStore.getState().pressedKeys
    for (let i = 0; i < r.nodes.length; i++) {
      const node = r.nodes[i]
      const name = KEY_NODE_NAMES[i]
      const sink = r.sink[i]
      const restY = r.restY[i]
      if (!node || name === undefined || sink === undefined || restY === undefined) continue

      const target = pressed.includes(name) ? PRESS_DEPTH : 0
      if (sink === target) continue
      let next = MathUtils.damp(sink, target, target > sink ? LAMBDA_DOWN : LAMBDA_UP, delta)
      if (Math.abs(next - target) < SETTLE_EPSILON) next = target
      r.sink[i] = next
      node.position.y = restY - next
    }
  })
}
