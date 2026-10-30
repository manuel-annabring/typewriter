import { describe, expect, it } from 'vitest'
import { soundsFor, type SoundState } from './soundEvents.ts'

const at = (row: number, col: number, bellSeq = 0): SoundState => ({ cursor: { row, col }, bellSeq })

describe('soundsFor', () => {
  it('clacks for a printed letter or digit', () => {
    expect(soundsFor('Key_A', at(0, 0), at(0, 1))).toEqual(['clack'])
    expect(soundsFor('Key_5', at(2, 7), at(2, 8))).toEqual(['clack'])
    expect(soundsFor('Key_Comma', at(0, 3), at(0, 4))).toEqual(['clack'])
  })

  it('plays the space sound for an accepted space', () => {
    expect(soundsFor('Key_Space', at(0, 3), at(0, 4))).toEqual(['space'])
  })

  it('plays the lock clunk when a key is ignored at the margin', () => {
    expect(soundsFor('Key_A', at(0, 66), at(0, 66))).toEqual(['lock'])
    expect(soundsFor('Key_Space', at(0, 66), at(0, 66))).toEqual(['lock'])
  })

  it('rings the bell after the clack that reached it', () => {
    expect(soundsFor('Key_A', at(0, 59), at(0, 60, 1))).toEqual(['clack', 'bell'])
    expect(soundsFor('Key_Space', at(0, 59), at(0, 60, 1))).toEqual(['space', 'bell'])
  })

  it('thunks for Shift, Tab and Backspace, moved or not', () => {
    for (const name of ['Key_Shift_L', 'Key_Shift_R', 'Key_Tab']) {
      expect(soundsFor(name, at(0, 5), at(0, 5))).toEqual(['thunk'])
    }
    expect(soundsFor('Key_Backspace', at(0, 5), at(0, 4))).toEqual(['thunk'])
    expect(soundsFor('Key_Backspace', at(0, 0), at(0, 0))).toEqual(['thunk'])
  })

  it('Enter thunks and then returns the carriage when it moved', () => {
    expect(soundsFor('Key_Enter', at(0, 20), at(1, 0))).toEqual(['thunk', 'return'])
    expect(soundsFor('Key_Enter', at(0, 0), at(0, 0))).toEqual(['thunk'])
  })

  it('the lever only returns the carriage, and is silent when ignored', () => {
    expect(soundsFor('Lever', at(3, 40), at(4, 0))).toEqual(['return'])
    expect(soundsFor('Lever', at(0, 0), at(0, 0))).toEqual([])
  })

  it('returns nothing for a name it does not know', () => {
    expect(soundsFor('Paper', at(0, 0), at(0, 0))).toEqual([])
  })
})
