// The audio engine: decoded buffers in, one short-lived source node per hit, a master gain and a
// limiter out. Kept apart from React. `controller.ts` loads this lazily after the first gesture.

import type { SoundId } from '../lib/soundEvents.ts'
import {
  BELL_DELAY_S,
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

interface ActiveVoice {
  source: AudioBufferSourceNode
  gain: GainNode
}

export interface Engine {
  play: (ids: readonly SoundId[]) => void
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

  const startOne = (id: SoundId, delayS: number) => {
    const spec = SOUND_SPECS[id]
    const variant = pickVariant(spec.variants, lastVariant[id] ?? null, Math.random)
    lastVariant[id] = variant
    const buffer = buffers[id][variant]
    if (!buffer) return

    const source = ctx.createBufferSource()
    source.buffer = buffer
    source.playbackRate.value = rateFor(spec.pitch, Math.random)
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
    source.start(now + delayS)
    started++
  }

  return {
    play: (ids) => {
      if (muted || ctx.state !== 'running') return
      for (const id of ids) startOne(id, id === 'bell' ? BELL_DELAY_S : 0)
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
