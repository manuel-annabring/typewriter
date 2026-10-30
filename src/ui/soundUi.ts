import { create } from 'zustand'
import { setMuted } from '../audio/controller.ts'

// Sound state the HTML overlay needs. Like cameraUi.ts it lives outside the scene chunk. The mute
// choice is a per-visitor preference, kept in localStorage; storage can be missing or throw
// (private windows, blocked site data), so every access is wrapped and the page works without it.
const STORAGE_KEY = 'typewriter:muted'

function readMuted(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

function writeMuted(muted: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, muted ? '1' : '0')
  } catch {
    // Not persisted; the choice still holds for this visit.
  }
}

interface SoundUiState {
  muted: boolean
  toggleMuted: () => void
}

const initial = readMuted()
setMuted(initial)

export const useSoundUi = create<SoundUiState>()((set, get) => ({
  muted: initial,
  toggleMuted: () => {
    const muted = !get().muted
    set({ muted })
    setMuted(muted)
    writeMuted(muted)
  },
}))
