import { useThree } from '@react-three/fiber'
import { useLayoutEffect, type RefObject } from 'react'
import { CanvasTexture, SRGBColorSpace, type MeshStandardMaterial, type Mesh, type Object3D } from 'three'
import { drawGlyph, drawPage, setupInk } from '../lib/paperDraw.ts'
import { CANVAS_HEIGHT, CANVAS_WIDTH } from '../lib/paperGrid.ts'
import { loadPaperFont } from '../lib/paperFont.ts'
import { usePaperUi } from '../ui/paperUi.ts'
import { useTypewriterStore } from '../store/typewriterStore.ts'

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

    setupInk(ctx)
    // The page export draws on the tint itself; the screen gets it from the material's colour.
    usePaperUi.setState({ tint: `#${material.color.getHexString()}` })

    const redrawAll = () => {
      // White, so Mat_Paper's own color (the paper tint) shows through the multiply.
      drawPage(ctx, useTypewriterStore.getState().lines, '#ffffff')
      texture.needsUpdate = true
    }

    let drawnSeq = useTypewriterStore.getState().lastPrint?.seq ?? 0
    const unsubscribe = useTypewriterStore.subscribe((state, prev) => {
      const print = state.lastPrint
      if (print === prev.lastPrint && state.lines === prev.lines) return
      if (print && print !== prev.lastPrint && print.seq === drawnSeq + 1) {
        drawGlyph(ctx, print.row, print.col, print.char)
        texture.needsUpdate = true
      } else if (state.lines !== prev.lines) {
        redrawAll()
      }
      drawnSeq = print?.seq ?? 0
    })

    // Glyphs typed before the font is ready are in `lines`; redraw once it is.
    let disposed = false
    redrawAll()
    void loadPaperFont().then((loaded) => {
      if (!disposed && loaded) redrawAll()
    })

    return () => {
      disposed = true
      unsubscribe()
      usePaperUi.setState({ tint: null })
      material.map = previousMap
      material.needsUpdate = true
      texture.dispose()
    }
  }, [root, maxAnisotropy])
}
