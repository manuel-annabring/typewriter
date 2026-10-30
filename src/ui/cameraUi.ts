import { create } from 'zustand'

// Camera state the HTML overlay needs. Written by the 3D scene chunk (CameraRig reports `orbited`,
// the carriage click requests the writing view) and by the view buttons; lives outside the scene
// chunk so the overlay needs no three.js.
interface CameraUiState {
  /** The user has moved the view away from the resting one (orbit or zoom), so Reset view is offered. */
  orbited: boolean
  /** 'writing' from the writing view request until Reset view; CameraRig picks the distance limits by it. */
  mode: 'overview' | 'writing'
  /** The writing view was used at least once, so the nudge toward it is not needed any more. */
  usedWriting: boolean
  /** Counts view requests; CameraRig flies the camera to the pose of `request` on each change. */
  requestSeq: number
  request: 'reset' | 'writing'
  setOrbited: (orbited: boolean) => void
  requestReset: () => void
  requestWriting: () => void
}

export const useCameraUi = create<CameraUiState>()((set) => ({
  orbited: false,
  mode: 'overview',
  usedWriting: false,
  requestSeq: 0,
  request: 'reset',
  setOrbited: (orbited) => set((s) => (s.orbited === orbited ? s : { orbited })),
  requestReset: () => set((s) => ({ orbited: false, mode: 'overview', request: 'reset', requestSeq: s.requestSeq + 1 })),
  requestWriting: () =>
    set((s) => ({ orbited: true, mode: 'writing', usedWriting: true, request: 'writing', requestSeq: s.requestSeq + 1 })),
}))
