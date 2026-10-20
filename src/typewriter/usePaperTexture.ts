import { useThree } from '@react-three/fiber'
import { useLayoutEffect, type RefObject } from 'react'
import { CanvasTexture, SRGBColorSpace, type MeshStandardMaterial, type Mesh, type Object3D } from 'three'
import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  cellOrigin,
  FONT_FAMILY,
  FONT_SIZE_PX,
  glyphJitter,
  INK,
} from '../lib/paperGrid.ts'
import { useTypewriterStore } from '../store/typewriterStore.ts'

const FONT_URL = '/fonts/SpecialElite-Regular.woff2'
const MAX_ANISOTROPY = 8

/**
 * Paper canvas: a CanvasTexture on Mat_Paper's map. The store's `lines` is the
 * source of truth; the canvas is a view of it. Each keystroke draws only the new
 * glyph (store.lastPrint). A full redraw happens on mount, when the font finishes
 * loading, and whenever lastPrint is not the next consecutive print (new sheet).
 */
export function usePaperTexture(root: RefObject<Object3D | null>): void {
  const maxAnisotropy = useThree((state) => state.gl.capabilities.getMaxAnisotropy())

  useLayoutEffect(() => {
    const paper = root.current?.getObjectByName('Paper') as Mesh | undefined
    if (!paper) throw new Error('Paper texture: node Paper not found in the model')
    const material = paper.material as MeshStandardMaterial

    const canvas = document.createElement('canvas')
    canvas.width = CANVAS_WIDTH
    canvas.height = CANVAS_HEIGHT
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Paper texture: 2D canvas context unavailable')

    const texture = new CanvasTexture(canvas)
    texture.colorSpace = SRGBColorSpace
    // glTF UVs have v pointing down, which is what flipY = false expects.
    texture.flipY = false
    texture.anisotropy = Math.min(maxAnisotropy, MAX_ANISOTROPY)

    const previousMap = material.map
    material.map = texture
    material.needsUpdate = true

    ctx.font = `${FONT_SIZE_PX}px ${FONT_FAMILY}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'alphabetic'
    ctx.fillStyle = INK

    const drawGlyph = (row: number, col: number, char: string) => {
      const { x, y } = cellOrigin(row, col)
      const j = glyphJitter(row, col, char)
      ctx.save()
      ctx.translate(x + j.dx, y + j.dy)
      ctx.rotate(j.rotation)
      ctx.globalAlpha = j.alpha
      ctx.fillText(char, 0, 0)
      ctx.restore()
    }

    const redrawAll = () => {
      // White, so Mat_Paper's own color (the paper tint) shows through the multiply.
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.fillStyle = INK
      useTypewriterStore.getState().lines.forEach((line, row) => {
        for (let col = 0; col < line.length; col++) {
          const char = line[col]
          if (char && char !== ' ') drawGlyph(row, col, char)
        }
      })
      texture.needsUpdate = true
    }

    let drawnSeq = useTypewriterStore.getState().lastPrint?.seq ?? 0
    const unsubscribe = useTypewriterStore.subscribe((state, prev) => {
      const print = state.lastPrint
      if (print === prev.lastPrint && state.lines === prev.lines) return
      if (print && print !== prev.lastPrint && print.seq === drawnSeq + 1) {
        drawGlyph(print.row, print.col, print.char)
        texture.needsUpdate = true
      } else if (state.lines !== prev.lines) {
        redrawAll()
      }
      drawnSeq = print?.seq ?? 0
    })

    // Glyphs typed before the font is ready are in `lines`; redraw once it is.
    let disposed = false
    redrawAll()
    const font = new FontFace('Special Elite', `url(${FONT_URL})`)
    font
      .load()
      .then((loaded) => {
        if (disposed) return
        document.fonts.add(loaded)
        redrawAll()
      })
      .catch((error: unknown) => {
        console.warn('Paper texture: Special Elite failed to load, using the fallback font', error)
      })

    return () => {
      disposed = true
      unsubscribe()
      material.map = previousMap
      material.needsUpdate = true
      texture.dispose()
    }
  }, [root, maxAnisotropy])
}
