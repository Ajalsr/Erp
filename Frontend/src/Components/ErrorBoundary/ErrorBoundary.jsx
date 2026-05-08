import { Component } from 'react'

/**
 * ErrorBoundary — catches any React render/lifecycle error and shows a
 * recovery screen instead of a blank white page.
 *
 * Wrap <Routes> in App.jsx with this component so any crashed module
 * doesn't take down the entire app.
 *
 * Usage:
 *   <ErrorBoundary>
 *     <Routes>...</Routes>
 *   </ErrorBoundary>
 */
class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    // In production you would send this to an error tracking service (Sentry, etc.)
    console.error('[ErrorBoundary] Caught error:', error, info)
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null })
    window.location.href = '/Home'
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children
    }

    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0a0f1e',
        fontFamily: "'DM Sans', sans-serif",
        padding: 24,
      }}>
        <div style={{
          maxWidth: 480,
          width: '100%',
          background: 'rgba(15,23,42,0.95)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 16,
          padding: '40px 36px',
          textAlign: 'center',
        }}>
          {/* Icon */}
          <div style={{
            width: 56, height: 56, borderRadius: 16,
            background: 'rgba(239,68,68,0.12)',
            border: '1px solid rgba(239,68,68,0.25)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 20px',
            fontSize: 24,
          }}>
            ⚠️
          </div>

          <h1 style={{
            fontFamily: "'Sora', sans-serif",
            fontSize: 20, fontWeight: 700,
            color: '#f1f5f9', margin: '0 0 10px',
          }}>
            Something went wrong
          </h1>

          <p style={{
            fontSize: 13, color: '#64748b',
            lineHeight: 1.6, margin: '0 0 28px',
          }}>
            An unexpected error occurred in this part of the app.
            Your data is safe — click below to go back to the dashboard.
          </p>

          {/* Show error message in dev */}
          {import.meta.env.DEV && this.state.error && (
            <pre style={{
              textAlign: 'left', fontSize: 11,
              background: 'rgba(239,68,68,0.06)',
              border: '1px solid rgba(239,68,68,0.15)',
              borderRadius: 8, padding: '10px 12px',
              color: '#fca5a5', overflowX: 'auto',
              marginBottom: 24, whiteSpace: 'pre-wrap',
            }}>
              {this.state.error.toString()}
            </pre>
          )}

          <button
            onClick={this.handleReload}
            style={{
              padding: '10px 28px',
              background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
              border: 'none', borderRadius: 10,
              color: '#fff', fontSize: 13, fontWeight: 700,
              cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
            }}
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    )
  }
}

export default ErrorBoundary
