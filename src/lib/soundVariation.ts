// Pure helpers that keep repeated sounds from sounding mechanical, and the one place the sound
// constants live. Randomness is injected (a `() => number` in [0, 1)) so the tests are exact.

import type { SoundId } from './soundEvents.ts'

export type Random = () => number

export interface SoundSpec {
  /** Number of variants the synth or the files provide; played round-robin. */
  variants: number
  /** Base level before the master gain (linear). */
  level: number
  /** Random pitch spread as a fraction of the playback rate (0.04 = ±4 %). */
  pitch: number
  /** Random level spread in dB (±). */
  gainDb: number
}

export const SOUND_SPECS: Readonly<Record<SoundId, SoundSpec>> = {
  clack: { variants: 4, level: 0.8, pitch: 0.04, gainDb: 1.5 },
  space: { variants: 2, level: 0.8, pitch: 0.03, gainDb: 1.5 },
  thunk: { variants: 1, level: 0.6, pitch: 0.03, gainDb: 1.5 },
  bell: { variants: 1, level: 0.5, pitch: 0, gainDb: 0.75 },
  lock: { variants: 1, level: 0.8, pitch: 0.02, gainDb: 1 },
  return: { variants: 1, level: 0.8, pitch: 0, gainDb: 0 },
}

/** The bell rings this long after the clack that reached the bell column. */
export const BELL_DELAY_S = 0.06
export const MAX_VOICES = 24
/** A stolen voice fades out over this long instead of cutting off with a click. */
export const STEAL_FADE_S = 0.005
export const MASTER_GAIN = 0.8

/** The next variant index: round-robin order is random, but never the one played last. */
export function pickVariant(count: number, last: number | null, rand: Random): number {
  if (count <= 1) return 0
  if (last === null || last < 0 || last >= count) return Math.min(count - 1, Math.floor(rand() * count))
  // Draw from the other count - 1 variants, then skip over `last`.
  const pick = Math.min(count - 2, Math.floor(rand() * (count - 1)))
  return pick >= last ? pick + 1 : pick
}

/** A symmetric random value in [-range, range]. */
export function jitter(range: number, rand: Random): number {
  return (rand() * 2 - 1) * range
}

export function dbToGain(db: number): number {
  return 10 ** (db / 20)
}

/** Playback rate for a pitch spread: 1 plus or minus up to `pitch`. */
export function rateFor(pitch: number, rand: Random): number {
  return 1 + jitter(pitch, rand)
}

/** Linear gain for a base level with a random spread in dB. */
export function gainFor(level: number, gainDb: number, rand: Random): number {
  return level * dbToGain(jitter(gainDb, rand))
}

/** Voices in start order (oldest first). Adding past `max` hands back the oldest ones to fade out. */
export class VoicePool<T> {
  private readonly voices: T[] = []
  private readonly max: number

  constructor(max: number) {
    this.max = max
  }

  get size(): number {
    return this.voices.length
  }

  add(voice: T): T[] {
    this.voices.push(voice)
    return this.voices.splice(0, Math.max(0, this.voices.length - this.max))
  }

  remove(voice: T): void {
    const i = this.voices.indexOf(voice)
    if (i >= 0) this.voices.splice(i, 1)
  }
}
