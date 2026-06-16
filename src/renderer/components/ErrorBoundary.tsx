import React from 'react'

// Catches render-time exceptions in the page subtree so a single broken page
// shows an inline error panel instead of blanking the whole app. The boundary
// resets when `resetKey` changes (page navigation / global refresh).

interface Props {
  /** Changing this value clears a previously caught error. */
  resetKey: unknown
  children: React.ReactNode
}

interface State {
  error: Error | null
}

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('Renderer error boundary caught:', error, info.componentStack)
  }

  componentDidUpdate(prevProps: Props): void {
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null })
    }
  }

  render(): React.ReactNode {
    if (this.state.error) {
      return (
        <div className="panel">
          <h2>Something went wrong on this page</h2>
          <div className="error">{this.state.error.message}</div>
          <p className="muted">
            The rest of the app is still running. You can retry this page or navigate elsewhere.
          </p>
          <button className="primary" onClick={() => this.setState({ error: null })}>
            Retry
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
