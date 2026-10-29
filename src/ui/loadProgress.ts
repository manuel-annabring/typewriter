import { create } from 'zustand'

// Loading progress (0 to 100) of the model, written by the 3D scene chunk (ProgressBridge) and
// read by the loader overlay. Lives outside the scene chunk so the overlay needs no three.js.
export const useLoadProgress = create<{ progress: number }>(() => ({ progress: 0 }))
