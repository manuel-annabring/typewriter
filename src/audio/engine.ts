// The audio engine: decoded buffers in, one short-lived source node per hit, a master gain and a
// limiter out. Kept apart from React. `controller.ts` loads this lazily after the first gesture.

import type { SoundCue, SoundId } from '../lib/soundEvents.ts'
import {
  gainFor,
  MASTER_GAIN,
  MAX_VOICES,
  pickVariant,
  rateFor,
  SOUND_SPECS,
  STEAL_FADE_S,
  VoicePool,
} from '../lib/soundVariation.ts'
import { synthesizeAll } from './synth.ts'

/** How far a timed cue may be stretched (playback rate), and the fade at its cut-off. */
const MIN_STRETCH = 0.8
const MAX_STRETCH = 1.6
const CUT_FADE_S = 0.02

interface ActiveVoice {
  source: AudioBufferSourceNode
  gain: GainNode
}

export interface Engine {
  play: (cues: readonly SoundCue[]) => void
  setMuted: (muted: boolean) => void
  /** Sources started so far (for checks; you can't hear audio in a test browser). */
  readonly started: number
  dispose: () => void
}

export function createEngine(ctx: AudioContext): Engine {
  const buffers = synthesizeAll(ctx)

  const master = ctx.createGain()
  master.gain.value = MASTER_GAIN
  // Against clipping when fast typing and the bell stack up: a hard-knee, fast compressor.
  const limiter = ctx.createDynamicsCompressor()
  limiter.threshold.value = -10
  limiter.knee.value = 0
  limiter.ratio.value = 12
  limiter.attack.value = 0.001
  limiter.release.value = 0.1
  master.connect(limiter).connect(ctx.destination)

  const pool = new VoicePool<ActiveVoice>(MAX_VOICES)
  const lastVariant: Partial<Record<SoundId, number>> = {}
  let muted = false
  let started = 0

  const startOne = ({ id, delayS, durationS }: SoundCue) => {
    const spec = SOUND_SPECS[id]
    const variant = pickVariant(spec.variants, lastVariant[id] ?? null, Math.random)
    lastVariant[id] = variant
    const buffer = buffers[id][variant]
    if (!buffer) return

    const source = ctx.createBufferSource()
    source.buffer = buffer
    // A cue with a duration (the ratchet) is stretched to it, within reason, and cut off at its end.
    const stretch = durationS === undefined ? 1 : Math.min(MAX_STRETCH, Math.max(MIN_STRETCH, buffer.duration / durationS))
    source.playbackRate.value = rateFor(spec.pitch, Math.random) * stretch
    const gain = ctx.createGain()
    gain.gain.value = gainFor(spec.level, spec.gainDb, Math.random)
    source.connect(gain).connect(master)

    const voice: ActiveVoice = { source, gain }
    source.onended = () => {
      pool.remove(voice)
      source.disconnect()
      gain.disconnect()
    }
    const now = ctx.currentTime
    for (const stolen of pool.add(voice)) {
      stolen.gain.gain.cancelScheduledValues(now)
      stolen.gain.gain.setValueAtTime(stolen.gain.gain.value, now)
      stolen.gain.gain.linearRampToValueAtTime(0, now + STEAL_FADE_S)
      stolen.source.stop(now + STEAL_FADE_S)
    }
    const at = now + delayS
    source.start(at)
    if (durationS !== undefined) {
      gain.gain.setValueAtTime(gain.gain.value, Math.max(at, at + durationS - CUT_FADE_S))
      gain.gain.linearRampToValueAtTime(0, at + durationS)
      source.stop(at + durationS)
    }
    started++
  }

  return {
    play: (cues) => {
      if (muted || ctx.state !== 'running') return
      for (const cue of cues) startOne(cue)
    },
    setMuted: (value) => {
      muted = value
      master.gain.setTargetAtTime(value ? 0 : MASTER_GAIN, ctx.currentTime, 0.01)
    },
    get started() {
      return started
    },
    dispose: () => {
      master.disconnect()
      limiter.disconnect()
    },
  }
}
