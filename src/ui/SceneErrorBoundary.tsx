import { Component, type ErrorInfo, type ReactNode } from 'react'
import { BUTTON_STYLE } from './buttonStyle.ts'

interface Props {
  children: ReactNode
}
interface State {
  error: Error | null
}

// three.js reports a missing WebGL context as "Error creating WebGL context".
const isWebGlError = (error: Error) => /webgl/i.test(error.message)

// Without a boundary any throw in the scene (no WebGL, the model failing to download) unmounts the
// whole app and leaves a blank page. This keeps the loader's look and says what happened.
// (Error boundaries can only be class components.)
export default class SceneErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(error, info.componentStack)
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    const noWebGl = isWebGlError(error)
    return (
      <div
        role="alert"
        style={{
          position: 'fixed',
          inset: 0,
          display: 'grid',
          placeItems: 'center',
          alignContent: 'center',
          gap: 20,
          padding: 24,
          background: '#e8e2d6',
          color: '#4a5046',
          font: '14px/1.5 ui-monospace, Menlo, monospace',
          letterSpacing: '0.04em',
          textAlign: 'center',
        }}
      >
        <p style={{ margin: 0, maxWidth: '34ch' }}>
          {noWebGl
            ? 'This typewriter needs WebGL, and this browser or device does not offer it. Try another browser or turn on hardware acceleration.'
            : 'The typewriter could not load. Check your connection and try again.'}
        </p>
        {!noWebGl && (
          <button type="button" style={BUTTON_STYLE} onClick={() => window.location.reload()}>
            Reload
          </button>
        )}
      </div>
    )
  }
}
