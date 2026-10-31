import { create } from 'zustand'

// The paper's tint as a CSS colour, written by usePaperTexture (scene chunk) from Mat_Paper and read
// by the page export. Lives outside the scene chunk so the entry bundle needs no three.js.
export const usePaperUi = create<{ tint: string | null }>(() => ({ tint: null }))
