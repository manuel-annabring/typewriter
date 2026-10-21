import { useFrame, useThree } from '@react-three/fiber'
import { useLayoutEffect, useRef, type RefObject } from 'react'
import { MathUtils, Plane, Vector3, type BufferGeometry, type Mesh, type MeshStandardMaterial, type Object3D } from 'three'
import { carriageShiftM, paperFeedM } from '../lib/carriage.ts'
import { useTypewriterStore } from '../store/typewriterStore.ts'

/** Damping rates for MathUtils.damp: higher is faster. */
const LAMBDA_STEP = 30 // carriage moving left, one character at a time
const LAMBDA_RETURN = 12 // carriage moving right: the return stroke (or backspace)
const LAMBDA_FEED = 14
const SETTLE_EPSILON = 5e-5 // 0.05 mm
/** The sheet is cut this far below the strike point: room for descenders, and no paper hanging out of the machine. */
const CLIP_BELOW_STRIKE = 0.008

interface CarriageRig {
  carriage: Object3D
  paper: Object3D
  lever: Object3D
  restX: number
  leverRestX: number
  paperRest: Vector3
  /** Unit vector along the sheet, bottom edge to top edge, in Carriage space. */
  up: Vector3
  strikeAlong: number
  paperHeight: number
  x: number
  feed: number
}

/**
 * Measures the sheet from its mesh: the up axis (bottom edge to top edge), its height
 * and the centre, in the paper node's own space. The model bakes the 8 degree lean
 * into the vertices, so this reads it instead of assuming it.
 */
function measureSheet(geometry: BufferGeometry): { up: Vector3; height: number; centre: Vector3 } {
  const pos = geometry.getAttribute('position')
  let minY = Infinity
  let maxY = -Infinity
  for (let i = 0; i < pos.count; i++) {
    minY = Math.min(minY, pos.getY(i))
    maxY = Math.max(maxY, pos.getY(i))
  }
  const top = new Vector3()
  const bottom = new Vector3()
  const centre = new Vector3()
  let nTop = 0
  let nBottom = 0
  const edge = (maxY - minY) / 2
  const v = new Vector3()
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i)
    centre.add(v)
    if (v.y > minY + edge) {
      top.add(v)
      nTop++
    } else {
      bottom.add(v)
      nBottom++
    }
  }
  centre.divideScalar(pos.count)
  top.divideScalar(nTop)
  bottom.divideScalar(nBottom)
  const up = top.sub(bottom)
  const height = up.length()
  return { up: up.divideScalar(height), height, centre }
}

/**
 * Carriage slide and line feed. The Lever is a top-level node in the model (contract),
 * but it is mounted on the carriage's left end, so it is slid by the same amount here.
 * Both targets are derived from the store cursor each
 * frame: the carriage slides left one pitch per column, and the sheet feeds up its own
 * (tilted) axis so the active row's baseline sits at the strike point. Nothing is
 * stored: a character, a return, or a backspace only moves the target.
 */
export function useCarriageAnimation(root: RefObject<Object3D | null>): void {
  const rig = useRef<CarriageRig | null>(null)
  const get = useThree((state) => state.get)

  useLayoutEffect(() => {
    const scene = root.current
    if (!scene) return
    const find = (name: string) => {
      const node = scene.getObjectByName(name)
      if (!node) throw new Error(`Carriage animation: node ${name} not found in the model`)
      return node
    }
    const carriage = find('Carriage')
    const paper = find('Paper') as Mesh
    const strike = find('StrikePoint')
    const lever = find('Lever')

    scene.updateWorldMatrix(true, true)
    const sheet = measureSheet(paper.geometry)
    const paperRest = paper.position.clone()
    // The strike point in Carriage space at rest, projected onto the sheet's up axis.
    // Projecting along `up` drops the small z gap between the strike point and the sheet.
    const strikeLocal = carriage.worldToLocal(strike.getWorldPosition(new Vector3()))
    const strikeAlong = strikeLocal.sub(paperRest).sub(sheet.centre).dot(sheet.up)

    const restX = carriage.position.x
    const { cursor } = useTypewriterStore.getState()
    const r: CarriageRig = {
      carriage,
      paper,
      lever,
      restX,
      leverRestX: lever.position.x,
      paperRest,
      up: sheet.up,
      strikeAlong,
      paperHeight: sheet.height,
      x: restX - carriageShiftM(cursor.col),
      feed: paperFeedM(cursor.row, strikeAlong, sheet.height),
    }
    carriage.position.x = r.x
    lever.position.x = r.leverRestX + (r.x - restX)
    paper.position.copy(paperRest).addScaledVector(r.up, r.feed)
    rig.current = r

    // Below the platen the real sheet runs down inside the machine. Here the flat sheet
    // would hang out of the body (it is wider than the body is deep), so cut it just
    // below the strike point. Clipping planes are in world space, and neither the strike
    // point nor the sheet's direction ever changes in world space, so one plane is enough.
    const { gl } = get()
    const material = paper.material as MeshStandardMaterial
    const upWorld = sheet.up.clone().transformDirection(carriage.matrixWorld)
    const cut = strike.getWorldPosition(new Vector3()).addScaledVector(upWorld, -CLIP_BELOW_STRIKE)
    const previousClipping = material.clippingPlanes
    const previousLocal = gl.localClippingEnabled
    material.clippingPlanes = [new Plane().setFromNormalAndCoplanarPoint(upWorld, cut)]
    material.needsUpdate = true
    gl.localClippingEnabled = true

    return () => {
      gl.localClippingEnabled = previousLocal
      material.clippingPlanes = previousClipping
      material.needsUpdate = true
      carriage.position.x = restX
      lever.position.x = r.leverRestX
      paper.position.copy(paperRest)
      rig.current = null
    }
  }, [root, get])

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
      r.lever.position.x = r.leverRestX + (next - r.restX)
    }

    const targetFeed = paperFeedM(cursor.row, r.strikeAlong, r.paperHeight)
    if (r.feed !== targetFeed) {
      let next = MathUtils.damp(r.feed, targetFeed, LAMBDA_FEED, delta)
      if (Math.abs(next - targetFeed) < SETTLE_EPSILON) next = targetFeed
      r.feed = next
      r.paper.position.copy(r.paperRest).addScaledVector(r.up, next)
    }
  })
}
