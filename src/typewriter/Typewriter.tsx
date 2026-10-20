import type { ThreeElements } from '@react-three/fiber'
import { useLayoutEffect, useRef } from 'react'
import type { Group } from 'three'
import { assertModelContract } from './contract.ts'
import { Model } from './TypewriterModel.generated.tsx'

// Behavior lives here, not in the generated file, so regenerating the model
// from Blender never overwrites it.
export function Typewriter(props: ThreeElements['group']) {
  const root = useRef<Group>(null)

  useLayoutEffect(() => {
    if (import.meta.env.DEV && root.current) assertModelContract(root.current)
  }, [])

  return (
    <group ref={root} {...props}>
      <Model />
    </group>
  )
}
