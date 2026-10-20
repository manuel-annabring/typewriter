import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useTypewriterStore } from '../store/typewriterStore.ts'
import { holdKey } from './dispatchKey.ts'

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
