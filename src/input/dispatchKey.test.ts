import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { playSounds } from '../audio/controller.ts'
import { useTypewriterStore } from '../store/typewriterStore.ts'
import { holdKey, pressKey } from './dispatchKey.ts'

vi.mock('../audio/controller.ts', () => ({ playSounds: vi.fn() }))

const pressed = () => useTypewriterStore.getState().pressedKeys

describe('holdKey', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.stubGlobal('window', globalThis)
    useTypewriterStore.setState({ pressedKeys: [] })
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('keeps the key pressed while held, however long', () => {
    const release = holdKey('Key_A')
    vi.advanceTimersByTime(2000)
    expect(pressed()).toEqual(['Key_A'])
    release()
    expect(pressed()).toEqual([])
  })

  it('keeps a quick tap pressed for a minimum time', () => {
    const release = holdKey('Key_A')
    release()
    expect(pressed()).toEqual(['Key_A'])
    vi.advanceTimersByTime(100)
    expect(pressed()).toEqual([])
  })

  it('ignores a second release', () => {
    const release = holdKey('Key_A')
    vi.advanceTimersByTime(500)
    release()
    release()
    expect(pressed()).toEqual([])
  })
})

describe('pressKey', () => {
  beforeEach(() => {
    useTypewriterStore.setState({ pressedKeys: [], cursor: { row: 0, col: 4 }, status: 'typing' })
  })

  it('plays the sounds the press made, including the lock clunk when ignored', () => {
    pressKey('Key_A')
    expect(playSounds).toHaveBeenLastCalledWith(['clack'])
    useTypewriterStore.setState({ cursor: { row: 0, col: 66 }, status: 'locked' })
    pressKey('Key_A')
    expect(playSounds).toHaveBeenLastCalledWith(['lock'])
    useTypewriterStore.setState({ cursor: { row: 0, col: 59 } })
    pressKey('Key_B')
    expect(playSounds).toHaveBeenLastCalledWith(['clack', 'bell'])
  })

  it('treats the lever like Enter: return the carriage and feed a line', () => {
    pressKey('Lever')
    expect(useTypewriterStore.getState().cursor).toEqual({ row: 1, col: 0 })
    useTypewriterStore.setState({ pressedKeys: [], cursor: { row: 0, col: 4 } })
    pressKey('Key_Enter')
    expect(useTypewriterStore.getState().cursor).toEqual({ row: 1, col: 0 })
  })
})
