// Pure key mapping: event.key (the character produced) to contract node names.
// Keep names in sync with KEY_NODE_NAMES in src/typewriter/contract.ts.

const NAMED_KEYS: Readonly<Record<string, string>> = {
  ' ': 'Key_Space',
  Enter: 'Key_Enter',
  Tab: 'Key_Tab',
  Backspace: 'Key_Backspace',
  ',': 'Key_Comma',
  '.': 'Key_Period',
}

/** DOM `KeyboardEvent.location` values for the two Shift keys. */
const LOCATION_RIGHT = 2

/** Maps a keyboard event to a contract key name, or null if the keyboard has no such key. */
export function keyNameFromEvent(key: string, location = 0): string | null {
  if (key === 'Shift') return location === LOCATION_RIGHT ? 'Key_Shift_R' : 'Key_Shift_L'
  const named = NAMED_KEYS[key]
  if (named) return named
  if (/^[a-zA-Z]$/.test(key)) return `Key_${key.toUpperCase()}`
  if (/^[0-9]$/.test(key)) return `Key_${key}`
  return null
}

const CHAR_BY_NAME: Readonly<Record<string, string>> = {
  Key_Space: ' ',
  Key_Comma: ',',
  Key_Period: '.',
}

/** The character a printing key produces (letters lowercase), or null for non-printing keys. */
export function charFromKeyName(name: string): string | null {
  const fixed = CHAR_BY_NAME[name]
  if (fixed) return fixed
  const m = /^Key_([A-Z0-9])$/.exec(name)
  return m?.[1] ? m[1].toLowerCase() : null
}
