import { useFrame } from '@react-three/fiber'
import { useLayoutEffect, useRef, type RefObject } from 'react'
import { MathUtils, type Object3D } from 'three'
import { carriageShiftM } from '../lib/carriage.ts'
import { useTypewriterStore } from '../store/typewriterStore.ts'

/** Damping rates for MathUtils.damp: higher is faster. */
const LAMBDA_STEP = 30 // carriage moving left, one character at a time
const LAMBDA_RETURN = 12 // carriage moving right: the return stroke (or backspace)
const SETTLE_EPSILON = 5e-5 // 0.05 mm

interface CarriageRig {
  carriage: Object3D
  restX: number
  x: number
}

/**
 * Carriage slide. The Lever, Paper and Platen are children of Carriage, so moving the
 * carriage moves them. The target is derived from the store cursor each frame: the
 * carriage slides left one pitch per column. Nothing is stored: a character, a return,
 * or a backspace only moves the target. The line feed is usePaperBend's job.
 */
export function useCarriageAnimation(root: RefObject<Object3D | null>): void {
  const rig = useRef<CarriageRig | null>(null)

  useLayoutEffect(() => {
    const carriage = root.current?.getObjectByName('Carriage')
    if (!carriage) throw new Error('Carriage animation: node Carriage not found in the model')

    const restX = carriage.position.x
    const { cursor } = useTypewriterStore.getState()
    const r: CarriageRig = { carriage, restX, x: restX - carriageShiftM(cursor.col) }
    carriage.position.x = r.x
    rig.current = r

    return () => {
      carriage.position.x = restX
      rig.current = null
    }
  }, [root])

  useFrame((_, delta) => {
    const r = rig.current
    if (!r) return
    const { cursor } = useTypewriterStore.getState()

    const targetX = r.restX - carriageShiftM(cursor.col)
    if (r.x !== targetX) {
      let next = MathUtils.damp(r.x, targetX, targetX > r.x ? LAMBDA_RETURN : LAMBDA_STEP, delta)
      if (Math.abs(next - targetX) < SETTLE_EPSILON) next = targetX
      r.x = next
      r.carriage.position.x = next
    }
  })
}
