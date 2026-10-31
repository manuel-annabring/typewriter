import { requestNewSheet } from '../input/newSheet.ts'
import { BUTTON_STYLE } from './buttonStyle.ts'

// In the dock, above the sound toggle. No confirm: the old page is discarded.
export default function NewSheetButton() {
  return (
    <button
      type="button"
      onClick={(e) => {
        requestNewSheet()
        // Keep focus off the button so Space and Enter go on typing, not on pressing it again.
        e.currentTarget.blur()
      }}
      style={BUTTON_STYLE}
    >
      New sheet
    </button>
  )
}
