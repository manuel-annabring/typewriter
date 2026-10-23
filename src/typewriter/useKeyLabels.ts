import { useThree } from '@react-three/fiber'
import { useLayoutEffect, type RefObject } from 'react'
import { CanvasTexture, SRGBColorSpace, type Mesh, type MeshStandardMaterial, type Object3D } from 'three'
import {
  ATLAS_SIZE_PX,
  CELL_PX,
  cellRect,
  keyAtlasCell,
  keyLabel,
  keyMaterialName,
  type KeyMaterialName,
} from '../lib/keyLabels.ts'
import { KEY_NODE_NAMES } from './contract.ts'

const FONT_URL = '/fonts/InterVariable.woff2'
const FONT_FAMILY = '"Inter", system-ui, sans-serif'
const MAX_ANISOTROPY = 8
const LABEL_WEIGHT = 600
/** Label font size as a fraction of one atlas cell. */
const LABEL_SIZE = 0.5
/** Widest a label may be, as a fraction of one atlas cell (the cap is round, so keep it narrow). */
const LABEL_MAX_WIDTH = 0.58
const MATERIAL_NAMES: readonly KeyMaterialName[] = ['Mat_KeyCream', 'Mat_KeyDark']
const INK: Readonly<Record<KeyMaterialName, string>> = {
  Mat_KeyCream: '#1b1b20',
  Mat_KeyDark: '#e9e4d6',
}

interface Label {
  text: string
  material: KeyMaterialName
  /** Cell centre in atlas pixels. */
  x: number
  y: number
}

const LABELS: readonly Label[] = KEY_NODE_NAMES.flatMap((name) => {
  const text = keyLabel(name)
  const cell = keyAtlasCell(name)
  if (text === null || cell === null) return []
  const rect = cellRect(cell)
  return [
    {
      text,
      material: keyMaterialName(name),
      x: ((rect.u0 + rect.u1) / 2) * ATLAS_SIZE_PX,
      y: ((rect.v0 + rect.v1) / 2) * ATLAS_SIZE_PX,
    },
  ]
})

function drawLabel(ctx: CanvasRenderingContext2D, label: Label): void {
  let size = LABEL_SIZE * CELL_PX
  ctx.font = `${LABEL_WEIGHT} ${size}px ${FONT_FAMILY}`
  const width = ctx.measureText(label.text).width
  const maxWidth = LABEL_MAX_WIDTH * CELL_PX
  if (width > maxWidth) {
    size *= maxWidth / width
    ctx.font = `${LABEL_WEIGHT} ${size}px ${FONT_FAMILY}`
  }
  // Centre on the cap height of "H", so every label shares one baseline.
  const capHeight = ctx.measureText('H').actualBoundingBoxAscent
  ctx.fillText(label.text, label.x, label.y + capHeight / 2)
}

/**
 * Key labels: one CanvasTexture atlas per key material (Mat_KeyCream, Mat_KeyDark), assigned as
 * the material's map. The model's UVs put each key's top face in its atlas cell and everything
 * else in the blank cell (SPEC.md section 5, "Key label atlas"). Each atlas is painted with the
 * material's own base colour, then the material colour goes white so the map shows unchanged.
 * Drawn once at mount and again when the font finishes loading; nothing happens per keystroke.
 */
export function useKeyLabels(root: RefObject<Object3D | null>): void {
  const maxAnisotropy = useThree((state) => state.gl.capabilities.getMaxAnisotropy())

  useLayoutEffect(() => {
    const found = new Map<string, MeshStandardMaterial>()
    root.current?.traverse((object) => {
      const mesh = object as Mesh
      if (!mesh.isMesh || Array.isArray(mesh.material)) return
      if ((MATERIAL_NAMES as readonly string[]).includes(mesh.material.name)) {
        found.set(mesh.material.name, mesh.material as MeshStandardMaterial)
      }
    })

    const atlases = MATERIAL_NAMES.map((name) => {
      const material = found.get(name)
      if (!material) throw new Error(`Key labels: material ${name} not found in the model`)
      const canvas = document.createElement('canvas')
      canvas.width = ATLAS_SIZE_PX
      canvas.height = ATLAS_SIZE_PX
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('Key labels: 2D canvas context unavailable')
      ctx.textAlign = 'center'
      ctx.textBaseline = 'alphabetic'

      const texture = new CanvasTexture(canvas)
      texture.colorSpace = SRGBColorSpace
      // glTF UVs have v pointing down, which is what flipY = false expects.
      texture.flipY = false
      texture.anisotropy = Math.min(maxAnisotropy, MAX_ANISOTROPY)

      const previousMap = material.map
      const previousColor = material.color.clone()
      const background = previousColor.getStyle()
      material.map = texture
      material.color.set(0xffffff)
      material.needsUpdate = true
      return { name, material, ctx, texture, previousMap, previousColor, background }
    })

    const redraw = () => {
      for (const { name, ctx, texture, background } of atlases) {
        ctx.fillStyle = background
        ctx.fillRect(0, 0, ATLAS_SIZE_PX, ATLAS_SIZE_PX)
        ctx.fillStyle = INK[name]
        for (const label of LABELS) if (label.material === name) drawLabel(ctx, label)
        texture.needsUpdate = true
      }
    }

    let disposed = false
    redraw()
    const font = new FontFace('Inter', `url(${FONT_URL})`, { weight: '100 900' })
    font
      .load()
      .then((loaded) => {
        if (disposed) return
        document.fonts.add(loaded)
        redraw()
      })
      .catch((error: unknown) => {
        console.warn('Key labels: Inter failed to load, using the fallback font', error)
      })

    return () => {
      disposed = true
      for (const { material, texture, previousMap, previousColor } of atlases) {
        material.map = previousMap
        material.color.copy(previousColor)
        material.needsUpdate = true
        texture.dispose()
      }
    }
  }, [root, maxAnisotropy])
}
