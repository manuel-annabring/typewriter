import { useEffect } from 'react'
import { armAudio } from './controller.ts'

/** Arms audio for the first user gesture; closes the audio context on unmount. */
export function useAudioUnlock(): void {
  useEffect(() => armAudio(), [])
}
