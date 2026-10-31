import { describe, expect, it } from 'vitest'
import { hasInk, saveFileName } from './pageExport.ts'

describe('hasInk', () => {
  it('is false for pages that leave no ink', () => {
    expect(hasInk([''])).toBe(false)
    expect(hasInk([])).toBe(false)
    expect(hasInk(['   ', '', '  '])).toBe(false)
  })

  it('is true as soon as one glyph is on the page', () => {
    expect(hasInk(['', '  .'])).toBe(true)
    expect(hasInk(['a'])).toBe(true)
  })
})

describe('saveFileName', () => {
  it('uses local time with zero padding', () => {
    expect(saveFileName(new Date(2026, 9, 31, 15, 42))).toBe('typewriter-2026-10-31-1542.png')
    expect(saveFileName(new Date(2026, 0, 5, 7, 3))).toBe('typewriter-2026-01-05-0703.png')
  })
})
