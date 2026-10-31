import { playSounds } from '../audio/controller.ts'
import { newSheetSounds } from '../lib/soundEvents.ts'
import { MOTION_ENABLED } from '../scene/cameraConfig.ts'
import { useTypewriterStore } from '../store/typewriterStore.ts'

/** The "New sheet" button: starts the swap and its sounds. Ignored while a swap is running. */
export function requestNewSheet(): void {
  const s = useTypewriterStore.getState()
  if (s.swap !== 'idle') return
  s.newSheet()
  playSounds(newSheetSounds(s.cursor.col, MOTION_ENABLED))
}
