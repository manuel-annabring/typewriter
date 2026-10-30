// Pure mapping from a key press and the store state around it to the sounds it makes.
// `pressKey` snapshots the state before and after the action; ignored actions (the margin lock)
// leave the cursor unchanged, which is how they are told apart from accepted ones.

export type SoundId = 'clack' | 'space' | 'thunk' | 'bell' | 'lock' | 'return'

/** The part of the store state the sounds depend on. */
export interface SoundState {
  readonly cursor: { readonly row: number; readonly col: number }
  readonly bellSeq: number
}

/** Keys that go down and make a sound whatever the store does with them. */
const THUNK_KEYS: readonly string[] = ['Key_Tab', 'Key_Backspace', 'Key_Shift_L', 'Key_Shift_R']

const moved = (before: SoundState, after: SoundState) =>
  before.cursor.row !== after.cursor.row || before.cursor.col !== after.cursor.col

/**
 * The sounds for pressing `name`, in the order they start. The bell comes last so the engine can
 * delay it behind the clack that rang it. `Lever` is the pseudo-key of the 3D lever.
 */
export function soundsFor(name: string, before: SoundState, after: SoundState): SoundId[] {
  const sounds: SoundId[] = []
  if (name === 'Lever') {
    if (moved(before, after)) sounds.push('return')
  } else if (name === 'Key_Enter') {
    sounds.push('thunk')
    if (moved(before, after)) sounds.push('return')
  } else if (THUNK_KEYS.includes(name)) {
    sounds.push('thunk')
  } else if (name === 'Key_Space') {
    sounds.push(moved(before, after) ? 'space' : 'lock')
  } else if (/^Key_/.test(name)) {
    sounds.push(moved(before, after) ? 'clack' : 'lock')
  }
  if (after.bellSeq !== before.bellSeq) sounds.push('bell')
  return sounds
}
