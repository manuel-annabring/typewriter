// Draws the typed page onto a 2D canvas. Shared by the paper texture (live view) and the page
// export, so the saved image can't drift from what is on screen. No three.js here.
import { cellOrigin, FONT_FAMILY, FONT_SIZE_PX, glyphJitter, INK } from './paperGrid.ts'

/** Font and alignment for glyphs. Call once per canvas (resizing a canvas resets them). */
export function setupInk(ctx: CanvasRenderingContext2D): void {
  ctx.font = `${FONT_SIZE_PX}px ${FONT_FAMILY}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = INK
}

/** One glyph in its cell, with the same deterministic jitter every time. */
export function drawGlyph(ctx: CanvasRenderingContext2D, row: number, col: number, char: string): void {
  const { x, y } = cellOrigin(row, col)
  const j = glyphJitter(row, col, char)
  ctx.save()
  ctx.translate(x + j.dx, y + j.dy)
  ctx.rotate(j.rotation)
  ctx.globalAlpha = j.alpha
  ctx.fillText(char, 0, 0)
  ctx.restore()
}

/** Fills the whole canvas with `background`, then draws every non-space character of `lines`. */
export function drawPage(ctx: CanvasRenderingContext2D, lines: readonly string[], background: string): void {
  ctx.fillStyle = background
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height)
  ctx.fillStyle = INK
  lines.forEach((line, row) => {
    for (let col = 0; col < line.length; col++) {
      const char = line[col]
      if (char && char !== ' ') drawGlyph(ctx, row, col, char)
    }
  })
}
