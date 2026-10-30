// Entry-side audio glue. It stays tiny on purpose: it creates the AudioContext on the first user
// gesture (browser autoplay rules; iOS Safari needs this inside the handler) and loads the engine
// chunk afterwards, so the entry bundle carries none of the synthesis code. Until the engine is
// ready, presses are held for a moment and then dropped; typing is never delayed.

import type { SoundCue } from '../lib/soundEvents.ts'
import type { Engine } from './engine.ts'

const GESTURES = ['pointerdown', 'pointerup', 'click', 'keydown', 'touchend'] as const
/** A press that waited for the engine longer than this is not played any more. */
const PENDING_MAX_AGE_MS = 300
const PENDING_MAX = 8

let ctx: AudioContext | null = null
let engine: Engine | null = null
let muted = false
let armed = false
let pending: { cues: readonly SoundCue[]; at: number }[] = []

function unlock(): void {
  if (!ctx) {
    if (typeof AudioContext === 'undefined') return disarm()
    try {
      ctx = new AudioContext({ latencyHint: 'interactive' })
    } catch {
      return disarm()
    }
    ctx.addEventListener('statechange', onStateChange)
    void load(ctx)
  }
  if (ctx.state !== 'running') ctx.resume().catch(() => {})
}

function onStateChange(): void {
  if (ctx?.state === 'running') disarm()
}

async function load(c: AudioContext): Promise<void> {
  try {
    const { createEngine } = await import('./engine.ts')
    if (ctx !== c) return
    const created = createEngine(c)
    created.setMuted(muted)
    if (c.state !== 'running') await c.resume()
    if (ctx !== c) {
      created.dispose()
      return
    }
    engine = created
    const now = performance.now()
    for (const p of pending) if (now - p.at <= PENDING_MAX_AGE_MS) created.play(p.cues)
    pending = []
  } catch {
    // Blocked or unsupported audio stays silent.
  }
}

function disarm(): void {
  if (!armed) return
  armed = false
  for (const type of GESTURES) window.removeEventListener(type, unlock, true)
}

/** Listens for the first gesture. Returns the cleanup (removes listeners, closes the context). */
export function armAudio(): () => void {
  if (!armed) {
    armed = true
    for (const type of GESTURES) window.addEventListener(type, unlock, { capture: true, passive: true })
  }
  return () => {
    disarm()
    engine?.dispose()
    engine = null
    pending = []
    const c = ctx
    ctx = null
    if (c) {
      c.removeEventListener('statechange', onStateChange)
      c.close().catch(() => {})
    }
  }
}

/** Plays the sounds a key press made (see `soundsFor`). A silent no-op until audio is unlocked. */
export function playSounds(cues: readonly SoundCue[]): void {
  if (cues.length === 0) return
  if (engine) engine.play(cues)
  else if (ctx && pending.length < PENDING_MAX) pending.push({ cues, at: performance.now() })
}

export function setMuted(value: boolean): void {
  muted = value
  engine?.setMuted(value)
}

/** For checks: where the audio pipeline stands. */
export function audioStatus(): { context: AudioContextState | 'none'; engine: boolean; started: number; muted: boolean } {
  return { context: ctx?.state ?? 'none', engine: engine !== null, started: engine?.started ?? 0, muted }
}
