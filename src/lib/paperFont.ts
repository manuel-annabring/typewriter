const FONT_URL = '/fonts/SpecialElite-Regular.woff2'

let loading: Promise<boolean> | null = null

/**
 * Loads Special Elite once and adds it to `document.fonts`. Resolves true when the font is ready and
 * false when it failed (one console warning; callers then draw with the fallback font). Never rejects.
 */
export function loadPaperFont(): Promise<boolean> {
  loading ??= new FontFace('Special Elite', `url(${FONT_URL})`)
    .load()
    .then((loaded) => {
      document.fonts.add(loaded)
      return true
    })
    .catch((error: unknown) => {
      console.warn('Paper font: Special Elite failed to load, using the fallback font', error)
      return false
    })
  return loading
}

/** `loadPaperFont`, but gives up after `ms` (resolves false) so a stalled request can't block a caller. */
export function loadPaperFontWithin(ms: number): Promise<boolean> {
  return Promise.race([loadPaperFont(), new Promise<boolean>((resolve) => setTimeout(() => resolve(false), ms))])
}
