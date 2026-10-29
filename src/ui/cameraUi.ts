import { create } from 'zustand'

// Camera state the HTML overlay needs. Written by the 3D scene chunk (CameraRig reports `orbited`)
// and by the reset button; lives outside the scene chunk so the overlay needs no three.js.
interface CameraUiState {
  /** The user has moved the view away from the resting one (orbit or zoom), so Reset view is offered. */
  orbited: boolean
  /** Counts reset requests; CameraRig eases the camera back to the resting view on each change. */
  resetSeq: number
  setOrbited: (orbited: boolean) => void
  requestReset: () => void
}

export const useCameraUi = create<CameraUiState>()((set) => ({
  orbited: false,
  resetSeq: 0,
  setOrbited: (orbited) => set((s) => (s.orbited === orbited ? s : { orbited })),
  requestReset: () => set((s) => ({ orbited: false, resetSeq: s.resetSeq + 1 })),
}))
