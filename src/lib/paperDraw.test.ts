import { describe, expect, it } from 'vitest'
import { drawPage } from './paperDraw.ts'
import { glyphJitter, INK } from './paperGrid.ts'

interface Call {
  op: string
  args: unknown[]
}

/** A recording stand-in for a 2D context: just enough for drawPage. */
function stubContext() {
  const calls: Call[] = []
  const rec = (op: string) => (...args: unknown[]) => void calls.push({ op, args })
  const ctx = {
    canvas: { width: 100, height: 200 },
    fillStyle: '',
    globalAlpha: 1,
    save: rec('save'),
    restore: rec('restore'),
    translate: rec('translate'),
    rotate: rec('rotate'),
    fillRect: rec('fillRect'),
    fillText: rec('fillText'),
  }
  return { ctx: ctx as unknown as CanvasRenderingContext2D, calls, raw: ctx }
}

describe('drawPage', () => {
  it('fills the background once, then draws only non-space characters', () => {
    const { ctx, calls } = stubContext()
    drawPage(ctx, ['a b', '', ' c'], '#abcdef')
    expect(calls.filter((c) => c.op === 'fillRect')).toEqual([{ op: 'fillRect', args: [0, 0, 100, 200] }])
    expect(calls.filter((c) => c.op === 'fillText').map((c) => c.args[0])).toEqual(['a', 'b', 'c'])
  })

  it('uses the background colour for the fill and the ink colour afterwards', () => {
    const { ctx, raw } = stubContext()
    let atFill = ''
    raw.fillRect = () => void (atFill = String(raw.fillStyle))
    drawPage(ctx, ['x'], '#abcdef')
    expect(atFill).toBe('#abcdef')
    expect(raw.fillStyle).toBe(INK)
  })

  it('applies the same jitter as glyphJitter', () => {
    const { ctx, calls } = stubContext()
    drawPage(ctx, ['', 'q'], '#fff')
    const j = glyphJitter(1, 0, 'q')
    expect(calls.find((c) => c.op === 'rotate')?.args).toEqual([j.rotation])
  })

  it('draws nothing but the background on an empty page', () => {
    const { ctx, calls } = stubContext()
    drawPage(ctx, [''], '#fff')
    expect(calls.some((c) => c.op === 'fillText')).toBe(false)
  })
})
