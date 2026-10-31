import NewSheetButton from './NewSheetButton.tsx'
import SavePageButton from './SavePageButton.tsx'
import SoundToggle from './SoundToggle.tsx'
import ViewControls from './ViewControls.tsx'
import './dock.css'

// The overlay buttons in one place so their layout (dock.css) can change with the screen: corners
// on desktop, two centered rows on a phone.
export default function Dock() {
  return (
    <div className="dock">
      <div className="dock-tools" role="group" aria-label="Page">
        <SavePageButton />
        <NewSheetButton />
        <SoundToggle />
      </div>
      <ViewControls />
    </div>
  )
}
