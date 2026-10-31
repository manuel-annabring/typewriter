// Pure helpers that keep repeated sounds from sounding mechanical, and the one place the sound
// constants live. Randomness is injected (a `() => number` in [0, 1)) so the tests are exact.

import type { SoundId } from './soundEvents.ts'

export type Random = () => number

export interface SoundSpec {
  /** Clips in `public/audio/` (names without `.mp3`), played round-robin as variants. */
  files: readonly string[]
  /** Base playback rate: below 1 plays the clip lower and slower (how Shift, Tab, the lock and the lever reuse the key clips). */
  rate: number
  /** Base level before the master gain (linear). */
  level: number
  /** Random pitch spread as a fraction of the playback rate (0.04 = ±4 %). */
  pitch: number
  /** Random level spread in dB (±). */
  gainDb: number
}

const KEYS = ['key_1', 'key_2'] as const

export const SOUND_SPECS: Readonly<Record<SoundId, SoundSpec>> = {
  clack: { files: KEYS, rate: 1, level: 0.6, pitch: 0.04, gainDb: 1.5 },
  space: { files: ['space_1'], rate: 1, level: 0.65, pitch: 0.03, gainDb: 1.5 },
  thunk: { files: KEYS, rate: 0.8, level: 0.45, pitch: 0.03, gainDb: 1.5 },
  bell: { files: ['bell'], rate: 1, level: 1, pitch: 0, gainDb: 0.75 },
  lock: { files: KEYS, rate: 0.55, level: 0.8, pitch: 0.02, gainDb: 1 },
  lever: { files: ['key_2'], rate: 0.5, level: 0.8, pitch: 0.02, gainDb: 1 },
  zip: { files: ['return_slide'], rate: 1, level: 0.5, pitch: 0, gainDb: 0.5 },
  stop: { files: ['return_stop'], rate: 1, level: 0.4, pitch: 0.02, gainDb: 1 },
}

/** Every clip the sounds use, once each (the key clips serve several sounds). */
export const SAMPLE_FILES: readonly string[] = [...new Set(Object.values(SOUND_SPECS).flatMap((spec) => spec.files))]

export const MAX_VOICES = 24
/** A stolen voice fades out over this long instead of cutting off with a click. */
export const STEAL_FADE_S = 0.005
export const MASTER_GAIN = 0.5

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
