import { beforeEach, describe, expect, it } from 'vitest'
import { useTypewriterStore } from './typewriterStore.ts'

const store = () => useTypewriterStore.getState()
const reset = () =>
  useTypewriterStore.setState({
    lines: [''],
    cursor: { row: 0, col: 0 },
    status: 'typing',
    bellSeq: 0,
    lastPrint: null,
    swap: 'idle',
    pressedKeys: [],
    log: [],
  })
const type = (text: string) => [...text].forEach((c) => (c === ' ' ? store().space() : store().typeChar(c)))

describe('new sheet', () => {
  beforeEach(reset)

  it('starts the pull: the carriage goes home, the old page stays until the swap', () => {
    type('hello')
    store().returnCarriage()
    type('world')
    store().newSheet()
    expect(store().swap).toBe('pulling')
    expect(store().cursor).toEqual({ row: 1, col: 0 })
    expect(store().lines).toEqual(['hello', 'world'])
  })

  it('swaps to an empty page at row 0, column 0 and keeps lastPrint consecutive', () => {
    type('ab')
    const seq = store().lastPrint?.seq
    store().newSheet()
    const before = store().lines
    store().beginInsert()
    expect(store().swap).toBe('inserting')
    expect(store().lines).toEqual([''])
    expect(store().lines).not.toBe(before)
    expect(store().cursor).toEqual({ row: 0, col: 0 })
    expect(store().status).toBe('typing')
    expect(store().lastPrint?.seq).toBe(seq)
    store().endSwap()
    expect(store().swap).toBe('idle')
  })

  it('ignores typing, space, return and backspace while the old page is pulled out', () => {
    type('abc')
    store().newSheet()
    const { lines, cursor } = store()
    store().typeChar('x')
    store().space()
    store().returnCarriage()
    store().backspace()
    expect(store().lines).toBe(lines)
    expect(store().cursor).toEqual(cursor)
  })

  it('types onto the fresh page as soon as the insert starts', () => {
    type('abc')
    store().newSheet()
    store().beginInsert()
    store().typeChar('z')
    expect(store().lines).toEqual(['z'])
    expect(store().cursor).toEqual({ row: 0, col: 1 })
  })

  it('unlocks a page that was locked at the margin', () => {
    type('a'.repeat(66))
    expect(store().status).toBe('locked')
    store().newSheet()
    expect(store().status).toBe('typing')
    store().beginInsert()
    expect(store().cursor).toEqual({ row: 0, col: 0 })
  })

  it('ignores a second request and out-of-order phase calls', () => {
    store().beginInsert()
    expect(store().swap).toBe('idle')
    store().endSwap()
    expect(store().swap).toBe('idle')
    store().newSheet()
    store().newSheet()
    expect(store().swap).toBe('pulling')
    store().endSwap()
    expect(store().swap).toBe('pulling')
  })
})
