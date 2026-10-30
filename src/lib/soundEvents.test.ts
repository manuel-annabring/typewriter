import { describe, expect, it } from 'vitest'
import { LINE_FEED_SETTLE_S, returnSlideSeconds } from './carriage.ts'
import { BELL_DELAY_S, soundsFor, type SoundState } from './soundEvents.ts'

const at = (row: number, col: number, bellSeq = 0): SoundState => ({ cursor: { row, col }, bellSeq })
const ids = (...args: Parameters<typeof soundsFor>) => soundsFor(...args).map((c) => c.id)

describe('soundsFor', () => {
  it('clacks for a printed letter or digit', () => {
    expect(ids('Key_A', at(0, 0), at(0, 1))).toEqual(['clack'])
    expect(ids('Key_5', at(2, 7), at(2, 8))).toEqual(['clack'])
    expect(ids('Key_Comma', at(0, 3), at(0, 4))).toEqual(['clack'])
  })

  it('plays the space sound for an accepted space', () => {
    expect(ids('Key_Space', at(0, 3), at(0, 4))).toEqual(['space'])
  })

  it('plays the lock clunk when a key is ignored at the margin', () => {
    expect(ids('Key_A', at(0, 66), at(0, 66))).toEqual(['lock'])
    expect(ids('Key_Space', at(0, 66), at(0, 66))).toEqual(['lock'])
  })

  it('rings the bell after the clack that reached it', () => {
    expect(ids('Key_A', at(0, 59), at(0, 60, 1))).toEqual(['clack', 'bell'])
    expect(ids('Key_Space', at(0, 59), at(0, 60, 1))).toEqual(['space', 'bell'])
    expect(soundsFor('Key_A', at(0, 59), at(0, 60, 1))[1]).toEqual({ id: 'bell', delayS: BELL_DELAY_S })
  })

  it('thunks for Shift, Tab and Backspace, moved or not', () => {
    for (const name of ['Key_Shift_L', 'Key_Shift_R', 'Key_Tab']) {
      expect(ids(name, at(0, 5), at(0, 5))).toEqual(['thunk'])
    }
    expect(ids('Key_Backspace', at(0, 5), at(0, 4))).toEqual(['thunk'])
    expect(ids('Key_Backspace', at(0, 0), at(0, 0))).toEqual(['thunk'])
  })

  it('Enter thunks, then slides and stops when the carriage moved', () => {
    expect(ids('Key_Enter', at(0, 20), at(1, 0))).toEqual(['thunk', 'zip', 'stop'])
    expect(ids('Key_Enter', at(0, 0), at(0, 0))).toEqual(['thunk'])
  })

  it('the lever clunks, slides and stops, and is silent when ignored', () => {
    expect(ids('Lever', at(3, 40), at(4, 0))).toEqual(['lever', 'zip', 'stop'])
    expect(ids('Lever', at(0, 0), at(0, 0))).toEqual([])
  })

  it('times the slide and the stop to the carriage animation', () => {
    const [lever, zip, stop] = soundsFor('Lever', at(3, 40), at(4, 0))
    expect(lever).toEqual({ id: 'lever', delayS: 0 })
    const slide = returnSlideSeconds(40)
    expect(zip?.delayS).toBeCloseTo(0.02)
    expect((zip?.delayS ?? 0) + (zip?.durationS ?? 0)).toBeCloseTo(slide)
    expect(stop?.delayS).toBeCloseTo(slide)
  })

  it('a long return takes longer than a short one, and the stop never beats the line feed', () => {
    const stopAt = (col: number) => soundsFor('Lever', at(3, col), at(4, 0)).find((c) => c.id === 'stop')?.delayS ?? 0
    expect(stopAt(60)).toBeGreaterThan(stopAt(10))
    expect(stopAt(1)).toBeCloseTo(LINE_FEED_SETTLE_S)
    expect(stopAt(0)).toBeCloseTo(LINE_FEED_SETTLE_S)
  })

  it('skips the slide sound for a return from the first columns', () => {
    expect(ids('Lever', at(3, 1), at(4, 0))).toEqual(['lever', 'stop'])
  })

  it('returns nothing for a name it does not know', () => {
    expect(ids('Paper', at(0, 0), at(0, 0))).toEqual([])
  })
})
