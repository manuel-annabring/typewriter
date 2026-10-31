import { hasInk, saveFileName } from '../lib/pageExport.ts'
import { drawPage, setupInk } from '../lib/paperDraw.ts'
import { loadPaperFontWithin } from '../lib/paperFont.ts'
import { CANVAS_HEIGHT, CANVAS_WIDTH } from '../lib/paperGrid.ts'
import { useTypewriterStore } from '../store/typewriterStore.ts'
import { usePaperUi } from '../ui/paperUi.ts'

const FONT_WAIT_MS = 3000
const REVOKE_AFTER_MS = 10_000
const FALLBACK_TINT = '#f2eee3'

/** True when the page can be saved now: it has ink and no sheet swap is running. */
export function canSavePage(): boolean {
  const s = useTypewriterStore.getState()
  return s.swap === 'idle' && hasInk(s.lines)
}

/**
 * The "Save page" button: draws the page flat on its paper tint (same draw code as the screen) on an
 * offscreen canvas and downloads it as a PNG. Resolves true once the download was started.
 */
export async function requestSavePage(): Promise<boolean> {
  if (!canSavePage()) return false
  // Draws with the fallback font if Special Elite failed or is slow, like the screen does.
  await loadPaperFontWithin(FONT_WAIT_MS)
  // Re-read after the wait: the page may have changed or a swap may have started.
  if (!canSavePage()) return false

  const canvas = document.createElement('canvas')
  canvas.width = CANVAS_WIDTH
  canvas.height = CANVAS_HEIGHT
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    console.warn('Save page: 2D canvas context unavailable')
    return false
  }
  setupInk(ctx)
  drawPage(ctx, useTypewriterStore.getState().lines, usePaperUi.getState().tint ?? FALLBACK_TINT)

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
  canvas.width = 0
  canvas.height = 0
  if (!blob) {
    console.warn('Save page: the canvas could not be encoded as PNG')
    return false
  }

  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = saveFileName(new Date())
  link.click()
  // Not at once: Safari can cancel a download whose URL is revoked on the same tick.
  setTimeout(() => URL.revokeObjectURL(url), REVOKE_AFTER_MS)
  return true
}
