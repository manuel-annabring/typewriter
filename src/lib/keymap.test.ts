import { describe, expect, it } from 'vitest'
import { KEY_NODE_NAMES } from '../typewriter/contract.ts'
import { charFromKeyName, keyNameFromEvent } from './keymap.ts'

describe('keyNameFromEvent', () => {
  it('maps letters regardless of case', () => {
    expect(keyNameFromEvent('a')).toBe('Key_A')
    expect(keyNameFromEvent('A')).toBe('Key_A')
    expect(keyNameFromEvent('z')).toBe('Key_Z')
  })
  it('maps digits', () => {
    expect(keyNameFromEvent('0')).toBe('Key_0')
    expect(keyNameFromEvent('9')).toBe('Key_9')
  })
  it('maps special and punctuation keys', () => {
    expect(keyNameFromEvent(' ')).toBe('Key_Space')
    expect(keyNameFromEvent('Enter')).toBe('Key_Enter')
    expect(keyNameFromEvent('Tab')).toBe('Key_Tab')
    expect(keyNameFromEvent('Backspace')).toBe('Key_Backspace')
    expect(keyNameFromEvent(',')).toBe('Key_Comma')
    expect(keyNameFromEvent('.')).toBe('Key_Period')
  })
  it('tells Shift sides apart by location', () => {
    expect(keyNameFromEvent('Shift', 1)).toBe('Key_Shift_L')
    expect(keyNameFromEvent('Shift', 2)).toBe('Key_Shift_R')
  })
  it('returns null for keys the machine does not have', () => {
    for (const k of ['!', '-', 'Escape', 'ArrowLeft', 'F1', 'ä', 'Control']) {
      expect(keyNameFromEvent(k)).toBeNull()
    }
  })
  it('only returns names that exist in the model contract', () => {
    for (const k of 'abcdefghijklmnopqrstuvwxyz0123456789 ,.'.split('')) {
      expect(KEY_NODE_NAMES).toContain(keyNameFromEvent(k))
    }
  })
})

describe('charFromKeyName', () => {
  it('returns the printed character', () => {
    expect(charFromKeyName('Key_A')).toBe('a')
    expect(charFromKeyName('Key_7')).toBe('7')
    expect(charFromKeyName('Key_Comma')).toBe(',')
    expect(charFromKeyName('Key_Space')).toBe(' ')
  })
  it('returns null for non-printing keys', () => {
    expect(charFromKeyName('Key_Enter')).toBeNull()
    expect(charFromKeyName('Key_Shift_L')).toBeNull()
  })
})
