// Pure mapping from a key press and the store state around it to the sounds it makes.
// `pressKey` snapshots the state before and after the action; ignored actions (the margin lock)
// leave the cursor unchanged, which is how they are told apart from accepted ones.

import { LINE_FEED_SETTLE_S, returnSlideSeconds } from './carriage.ts'
import { GAP_S, INSERT_S, PULL_S } from './sheetSwap.ts'

export type SoundId = 'clack' | 'space' | 'thunk' | 'bell' | 'lock' | 'lever' | 'zip' | 'stop' | 'paperOut' | 'paperIn'

/** One sound to start: `delayS` after the press, and for `zip` how long it should run. */
export interface SoundCue {
  id: SoundId
  delayS: number
  durationS?: number
}

/** The part of the store state the sounds depend on. */
export interface SoundState {
  readonly cursor: { readonly row: number; readonly col: number }
  readonly bellSeq: number
}

/** Keys that go down and make a sound whatever the store does with them. */
const THUNK_KEYS: readonly string[] = ['Key_Tab', 'Key_Backspace', 'Key_Shift_L', 'Key_Shift_R']

/** The bell rings this long after the clack that reached the bell column. */
export const BELL_DELAY_S = 0.06
/** The ratchet starts a moment after the lever or Enter goes down. */
const ZIP_DELAY_S = 0.02
/** A ratchet shorter than this is not worth playing (a return from the first columns). */
const ZIP_MIN_S = 0.08

const moved = (before: SoundState, after: SoundState) =>
  before.cursor.row !== after.cursor.row || before.cursor.col !== after.cursor.col

/**
 * The slide and the stop of a carriage return, timed to the animation: the carriage eases back
 * exponentially (`useCarriageAnimation`), so it is fast at first and the stop comes when the
 * remaining distance is about a millimetre, or when the line feed has settled, whichever is later.
 */
function returnCues(cols: number): SoundCue[] {
  const slideS = returnSlideSeconds(cols)
  const cues: SoundCue[] = []
  if (slideS - ZIP_DELAY_S >= ZIP_MIN_S) cues.push({ id: 'zip', delayS: ZIP_DELAY_S, durationS: slideS - ZIP_DELAY_S })
  cues.push({ id: 'stop', delayS: Math.max(slideS, LINE_FEED_SETTLE_S) })
  return cues
}

/**
 * The sounds of a new sheet, timed to the swap (`sheetSwap.ts`): the carriage goes home while the old
 * page is wound out, then the fresh one is wound in. `col` is the cursor column when the button was
 * pressed. Reduced motion jumps, so it only plays the insert.
 */
export function newSheetSounds(col: number, motion = true): SoundCue[] {
  if (!motion) return [{ id: 'paperIn', delayS: 0 }]
  const cues: SoundCue[] = [{ id: 'paperOut', delayS: 0, durationS: PULL_S }]
  if (col > 0) cues.push(...returnCues(col))
  cues.push({ id: 'paperIn', delayS: PULL_S + GAP_S, durationS: INSERT_S })
  return cues
}

/**
 * The sounds for pressing `name`, in the order they start. `Lever` is the pseudo-key of the 3D
 * lever: it clunks, Enter thunks like any key, and both then play the same slide and stop.
 */
export function soundsFor(name: string, before: SoundState, after: SoundState): SoundCue[] {
  const cues: SoundCue[] = []
  const at = (id: SoundId, delayS = 0) => cues.push({ id, delayS })
  if (name === 'Lever') {
    if (moved(before, after)) {
      at('lever')
      cues.push(...returnCues(before.cursor.col))
    }
  } else if (name === 'Key_Enter') {
    at('thunk')
    if (moved(before, after)) cues.push(...returnCues(before.cursor.col))
  } else if (THUNK_KEYS.includes(name)) {
    at('thunk')
  } else if (name === 'Key_Space') {
    at(moved(before, after) ? 'space' : 'lock')
  } else if (/^Key_/.test(name)) {
    at(moved(before, after) ? 'clack' : 'lock')
  }
  if (after.bellSeq !== before.bellSeq) at('bell', BELL_DELAY_S)
  return cues
}
