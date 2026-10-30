// Placeholder sounds, synthesized sample by sample into AudioBuffers. They stand in until real
// samples exist: the engine only sees buffers, so replacing them is a loader change.

import type { SoundId } from '../lib/soundEvents.ts'
import { SOUND_SPECS } from '../lib/soundVariation.ts'

const PEAK = 0.9

/** Small seeded PRNG (mulberry32), so every page load renders the same noise. */
function seeded(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

interface NoiseBurst {
  at: number
  /** Time constant of the exponential decay, in seconds. */
  decay: number
  gain: number
  /** One-pole filters: lowpass cutoff and highpass cutoff in Hz (omit for none). */
  lowHz?: number
  highHz?: number
}

interface Tone {
  at: number
  freq: number
  /** Frequency the tone falls to (exponentially, over about `decay`); omit for a steady pitch. */
  toFreq?: number
  decay: number
  gain: number
}

class Voice {
  readonly data: Float32Array<ArrayBuffer>
  private readonly sr: number
  private readonly rand: () => number

  constructor(seconds: number, sr: number, seed: number) {
    this.data = new Float32Array(Math.ceil(seconds * sr))
    this.sr = sr
    this.rand = seeded(seed)
  }

  noise({ at, decay, gain, lowHz, highHz }: NoiseBurst): this {
    const { sr, data } = this
    const aLow = lowHz ? 1 - Math.exp((-2 * Math.PI * lowHz) / sr) : 1
    const aHigh = highHz ? 1 - Math.exp((-2 * Math.PI * highHz) / sr) : 0
    let low = 0
    let high = 0
    const start = Math.floor(at * sr)
    const end = Math.min(data.length, start + Math.ceil(decay * 8 * sr))
    for (let i = start; i < end; i++) {
      const env = Math.exp(-(i - start) / (decay * sr))
      const x = this.rand() * 2 - 1
      low += aLow * (x - low)
      high += aHigh * (low - high)
      data[i] = (data[i] ?? 0) + (low - high) * env * gain
    }
    return this
  }

  tone({ at, freq, toFreq, decay, gain }: Tone): this {
    const { sr, data } = this
    const start = Math.floor(at * sr)
    const end = Math.min(data.length, start + Math.ceil(decay * 8 * sr))
    let phase = 0
    for (let i = start; i < end; i++) {
      const t = (i - start) / sr
      const env = Math.exp(-t / decay)
      const f = toFreq === undefined ? freq : toFreq + (freq - toFreq) * Math.exp(-t / (decay * 0.5))
      phase += (2 * Math.PI * f) / sr
      data[i] = (data[i] ?? 0) + Math.sin(phase) * env * gain
    }
    return this
  }

  toBuffer(ctx: BaseAudioContext): AudioBuffer {
    let peak = 0
    for (const v of this.data) peak = Math.max(peak, Math.abs(v))
    const scale = peak > 0 ? PEAK / peak : 1
    for (let i = 0; i < this.data.length; i++) this.data[i] = (this.data[i] ?? 0) * scale
    const buffer = ctx.createBuffer(1, this.data.length, this.sr)
    buffer.copyToChannel(this.data, 0)
    return buffer
  }
}

/** A key hitting its stop: low body, a dry tick and a short metallic ring. */
function clack(ctx: BaseAudioContext, variant: number): AudioBuffer {
  const v = new Voice(0.12, ctx.sampleRate, 100 + variant)
  return v
    .tone({ at: 0, freq: 150 + variant * 18, toFreq: 90, decay: 0.025, gain: 0.7 })
    .noise({ at: 0, decay: 0.004, gain: 1, lowHz: 6000, highHz: 1800 })
    .noise({ at: 0.003, decay: 0.012, gain: 0.35, lowHz: 3500 + variant * 400, highHz: 2500 })
    .toBuffer(ctx)
}

function space(ctx: BaseAudioContext, variant: number): AudioBuffer {
  const v = new Voice(0.2, ctx.sampleRate, 200 + variant)
  return v
    .tone({ at: 0, freq: 95 + variant * 12, toFreq: 60, decay: 0.05, gain: 0.9 })
    .noise({ at: 0, decay: 0.02, gain: 0.8, lowHz: 900 })
    .noise({ at: 0, decay: 0.004, gain: 0.4, lowHz: 4000, highHz: 1500 })
    .toBuffer(ctx)
}

function thunk(ctx: BaseAudioContext): AudioBuffer {
  return new Voice(0.14, ctx.sampleRate, 300)
    .tone({ at: 0, freq: 120, toFreq: 80, decay: 0.035, gain: 0.8 })
    .noise({ at: 0, decay: 0.012, gain: 0.6, lowHz: 1500 })
    .toBuffer(ctx)
}

/** A key hitting blocked typebars: heavier and duller than a clack, with no tick. */
function lock(ctx: BaseAudioContext): AudioBuffer {
  return new Voice(0.25, ctx.sampleRate, 400)
    .tone({ at: 0, freq: 70, toFreq: 45, decay: 0.08, gain: 1 })
    .noise({ at: 0, decay: 0.03, gain: 0.7, lowHz: 600 })
    .toBuffer(ctx)
}

/** A small struck bell: inharmonic partials, each pair slightly detuned for a slow shimmer. */
function bell(ctx: BaseAudioContext): AudioBuffer {
  const base = 2400
  const partials: readonly (readonly [ratio: number, gain: number, decay: number])[] = [
    [1, 1, 0.9],
    [2.32, 0.5, 0.5],
    [4.25, 0.3, 0.3],
    [6.63, 0.15, 0.15],
  ]
  const v = new Voice(1.6, ctx.sampleRate, 500)
  for (const [ratio, gain, decay] of partials) {
    v.tone({ at: 0, freq: base * ratio, decay, gain })
    v.tone({ at: 0, freq: base * ratio * 1.003, decay, gain: gain * 0.5 })
  }
  return v.noise({ at: 0, decay: 0.003, gain: 0.4, lowHz: 9000, highHz: 4000 }).toBuffer(ctx)
}

/** Lever clunk, a ratchet of ticks while the carriage slides, then the end stop. */
function carriageReturn(ctx: BaseAudioContext): AudioBuffer {
  const v = new Voice(0.8, ctx.sampleRate, 600)
  v.tone({ at: 0, freq: 100, toFreq: 60, decay: 0.05, gain: 0.9 }).noise({ at: 0, decay: 0.02, gain: 0.6, lowHz: 1200 })
  for (let t = 0.06; t < 0.5; t += 0.014) {
    v.noise({ at: t, decay: 0.002, gain: 0.35, lowHz: 5000, highHz: 2000 })
  }
  return v
    .tone({ at: 0.52, freq: 80, toFreq: 50, decay: 0.06, gain: 1 })
    .noise({ at: 0.52, decay: 0.025, gain: 0.7, lowHz: 800 })
    .toBuffer(ctx)
}

function render(ctx: BaseAudioContext, id: SoundId, variant: number): AudioBuffer {
  switch (id) {
    case 'clack':
      return clack(ctx, variant)
    case 'space':
      return space(ctx, variant)
    case 'thunk':
      return thunk(ctx)
    case 'lock':
      return lock(ctx)
    case 'bell':
      return bell(ctx)
    case 'return':
      return carriageReturn(ctx)
  }
}

/** All placeholder buffers, `SOUND_SPECS[id].variants` of each sound. */
export function synthesizeAll(ctx: BaseAudioContext): Record<SoundId, AudioBuffer[]> {
  const ids = Object.keys(SOUND_SPECS) as SoundId[]
  const out = {} as Record<SoundId, AudioBuffer[]>
  for (const id of ids) {
    out[id] = Array.from({ length: SOUND_SPECS[id].variants }, (_, variant) => render(ctx, id, variant))
  }
  return out
}
