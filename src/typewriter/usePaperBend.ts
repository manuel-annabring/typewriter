import { useFrame } from '@react-three/fiber'
import { useLayoutEffect, useRef, type RefObject } from 'react'
import { MathUtils, Vector3, type BufferGeometry, type Mesh, type MeshStandardMaterial, type Object3D } from 'three'
import { LAMBDA_FEED, paperFeedM } from '../lib/carriage.ts'
import {
  BEND_BEGIN_VERTEX,
  BEND_FRAGMENT_PARS,
  BEND_MAP_FRAGMENT,
  BEND_NORMAL_VERTEX,
  BEND_VERTEX_PARS,
  TAIL_ANGLE,
  wrapAngleFor,
} from '../lib/paperBend.ts'
import { useTypewriterStore } from '../store/typewriterStore.ts'

/** Damping rate for MathUtils.damp (higher is faster): LAMBDA_FEED, in lib/carriage.ts where the return sound is timed from it. */
const SETTLE_EPSILON = 5e-5 // 0.05 mm
const AXIS = new Vector3(1, 0, 0)
/**
 * three looks compiled programs up by this key, not by the shader source, so it carries
 * the injected chunks: a change to the bend (or its constants) gets a fresh compile
 * instead of a cached program with the old GLSL.
 */
const PROGRAM_KEY = [
  'paper-bend',
  BEND_VERTEX_PARS,
  BEND_NORMAL_VERTEX,
  BEND_BEGIN_VERTEX,
  BEND_FRAGMENT_PARS,
  BEND_MAP_FRAGMENT,
].join('\n')

interface PaperUniforms {
  uPaperFeed: { value: number }
  uPaperUp: { value: Vector3 }
  uPaperOut: { value: Vector3 }
  uPaperTangent: { value: Vector3 }
  uPaperRadius: { value: number }
  uPaperWrap: { value: number }
  uPaperTopRest: { value: number }
  uPaperFrontSign: { value: number }
}

/**
 * The uniforms live on the material (userData) and are reused across mounts. three
 * caches the compiled program per material and calls onBeforeCompile only when it builds
 * a new one, so a remount or a hot reload of this module that made fresh uniform objects
 * would update values the cached program never reads. They are stored with the program
 * key: new shader code gets a new program and, with it, a fresh set of uniforms.
 */
const UNIFORMS_KEY = 'paperBend'

interface StoredUniforms {
  programKey: string
  uniforms: PaperUniforms
}

interface PaperRig {
  uniforms: PaperUniforms
  strikeAlong: number
  paperHeight: number
  feed: number
}

/**
 * Measures the sheet from its mesh: the up axis (bottom edge to top edge), its height
 * and the centre, in the paper node's own space. The model bakes the 8 degree lean
 * into the vertices, so this reads it instead of assuming it. Only the two edge rows
 * count: the sheet is subdivided along its height, so averaging "the top half" would
 * read half the height.
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
  const edge = 1e-6
  const v = new Vector3()
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i)
    centre.add(v)
    if (v.y > maxY - edge) {
      top.add(v)
      nTop++
    } else if (v.y < minY + edge) {
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
 * Line feed and the wrap round the platen, both in a vertex shader on Mat_Paper. The
 * Paper node itself never moves: the shader feeds each vertex up the sheet's (tilted)
 * axis by the uPaperFeed uniform, then bends whatever is below the tangent point round
 * the platen axis (lib/paperBend.ts). The feed is derived from the store cursor each
 * frame so the active row's baseline sits at the strike point; nothing is stored.
 *
 * Everything model-dependent is measured at mount, in the paper node's space: the
 * platen axis is the Carriage origin (running along x) and the wrap radius is the
 * distance from that axis to the sheet's plane, so the sheet leaves the platen tangent.
 */
export function usePaperBend(root: RefObject<Object3D | null>): void {
  const rig = useRef<PaperRig | null>(null)

  useLayoutEffect(() => {
    const scene = root.current
    if (!scene) return
    const find = (name: string) => {
      const node = scene.getObjectByName(name)
      if (!node) throw new Error(`Paper bend: node ${name} not found in the model`)
      return node
    }
    const carriage = find('Carriage')
    const paper = find('Paper') as Mesh
    const strike = find('StrikePoint')

    scene.updateWorldMatrix(true, true)
    const sheet = measureSheet(paper.geometry)
    // The strike point and the platen axis in the paper node's space. Projecting the
    // strike point along `up` drops the small gap between it and the sheet.
    const strikeLocal = paper.worldToLocal(strike.getWorldPosition(new Vector3()))
    const strikeAlong = strikeLocal.sub(sheet.centre).dot(sheet.up)
    const axisPoint = paper.worldToLocal(carriage.getWorldPosition(new Vector3()))

    // `out` is the part of (sheet centre - axis) that is square to both the axis and the
    // sheet: it points from the axis to the sheet's plane, and its length is the radius.
    const toSheet = sheet.centre.clone().sub(axisPoint)
    const out = toSheet
      .addScaledVector(sheet.up, -toSheet.dot(sheet.up))
      .addScaledVector(AXIS, -toSheet.dot(AXIS))
    const radius = out.length()
    out.divideScalar(radius)
    const tangent = axisPoint.addScaledVector(out, radius)
    const normal = new Vector3().fromBufferAttribute(paper.geometry.getAttribute('normal'), 0)
    // How far the flat sheet leans back from vertical (glTF: +y up, front is +z).
    const sheetLean = Math.atan2(-sheet.up.z, sheet.up.y)

    const { cursor } = useTypewriterStore.getState()
    const feed = paperFeedM(cursor.row, strikeAlong, sheet.height)
    const material = paper.material as MeshStandardMaterial
    const stored = material.userData[UNIFORMS_KEY] as StoredUniforms | undefined
    let uniforms = stored?.programKey === PROGRAM_KEY ? stored.uniforms : undefined
    if (!uniforms) {
      uniforms = {
        uPaperFeed: { value: 0 },
        uPaperUp: { value: new Vector3() },
        uPaperOut: { value: new Vector3() },
        uPaperTangent: { value: new Vector3() },
        uPaperRadius: { value: 0 },
        uPaperWrap: { value: 0 },
        uPaperTopRest: { value: 0 },
        uPaperFrontSign: { value: 1 },
      }
      const next: StoredUniforms = { programKey: PROGRAM_KEY, uniforms }
      material.userData[UNIFORMS_KEY] = next
    }
    uniforms.uPaperFeed.value = feed
    uniforms.uPaperUp.value.copy(sheet.up)
    uniforms.uPaperOut.value.copy(out)
    uniforms.uPaperTangent.value.copy(tangent)
    uniforms.uPaperRadius.value = radius
    uniforms.uPaperWrap.value = wrapAngleFor(sheetLean, TAIL_ANGLE)
    // The top edge's distance along the sheet from the tangent point, unfed. The shader
    // adds the feed and takes off the bail arc to get the free length that droops.
    uniforms.uPaperTopRest.value = sheet.height / 2 + sheet.centre.clone().sub(tangent).dot(sheet.up)
    uniforms.uPaperFrontSign.value = normal.dot(out) >= 0 ? 1 : -1
    rig.current = { uniforms, strikeAlong, paperHeight: sheet.height, feed }

    // onBeforeCompile edits the built-in standard shader's source before three compiles
    // it, so lighting, colour space and texture sampling stay three's own code.
    const shaderUniforms = uniforms
    const previousCompile = material.onBeforeCompile
    const previousCacheKey = material.customProgramCacheKey
    material.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, shaderUniforms)
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', `#include <common>\n${BEND_VERTEX_PARS}`)
        .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>\n${BEND_NORMAL_VERTEX}`)
        .replace('#include <begin_vertex>', BEND_BEGIN_VERTEX)
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>\n${BEND_FRAGMENT_PARS}`)
        .replace('#include <map_fragment>', BEND_MAP_FRAGMENT)
    }
    material.customProgramCacheKey = () => PROGRAM_KEY
    material.needsUpdate = true
    // Culling uses the flat, unfed mesh's bounds, which are not where the shader draws it.
    const previousCulled = paper.frustumCulled
    paper.frustumCulled = false

    return () => {
      material.onBeforeCompile = previousCompile
      material.customProgramCacheKey = previousCacheKey
      material.needsUpdate = true
      paper.frustumCulled = previousCulled
      rig.current = null
    }
  }, [root])

  useFrame((_, delta) => {
    const r = rig.current
    if (!r) return
    const { cursor } = useTypewriterStore.getState()
    const targetFeed = paperFeedM(cursor.row, r.strikeAlong, r.paperHeight)
    if (r.feed === targetFeed) return
    let next = MathUtils.damp(r.feed, targetFeed, LAMBDA_FEED, delta)
    if (Math.abs(next - targetFeed) < SETTLE_EPSILON) next = targetFeed
    r.feed = next
    r.uniforms.uPaperFeed.value = next
  })
}
