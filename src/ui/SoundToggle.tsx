import { BUTTON_STYLE } from './buttonStyle.ts'
import { useSoundUi } from './soundUi.ts'

// Mute switch, bottom left (the camera buttons are bottom right).
export default function SoundToggle() {
  const muted = useSoundUi((s) => s.muted)
  const toggleMuted = useSoundUi((s) => s.toggleMuted)
  return (
    <button
      type="button"
      aria-pressed={!muted}
      aria-label="Sound"
      onClick={(e) => {
        toggleMuted()
        // Keep focus off the button so Space and Enter go on typing, not on pressing it again.
        e.currentTarget.blur()
      }}
      style={{ ...BUTTON_STYLE, position: 'fixed', left: 16, bottom: 16 }}
    >
      {muted ? 'Sound off' : 'Sound on'}
    </button>
  )
}
