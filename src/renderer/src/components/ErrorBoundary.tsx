import { Component, type ErrorInfo, type ReactNode } from 'react'

type Props = { children: ReactNode }
type State = { error: Error | null; info: ErrorInfo | null }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, info: null }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    this.setState({ error, info })
    console.error('[Terminal42] uncaught render error:', error, info)
  }

  reset = (): void => {
    this.setState({ error: null, info: null })
    try { location.reload() } catch {}
  }

  render(): ReactNode {
    const { error, info } = this.state
    if (!error) return this.props.children
    return (
      <div className="grid h-full min-h-screen w-full place-items-center bg-bg p-8 text-text-primary">
        <div className="flex max-w-[560px] flex-col gap-4 text-[13px]">
          <p className="text-[16px] font-medium">Something went wrong</p>
          <p className="text-text-secondary">
            Terminal42 hit an uncaught error while rendering. The app has stayed loaded so you don't lose your terminals: reload to recover.
          </p>
          <pre className="max-h-[200px] overflow-auto whitespace-pre-wrap rounded-md bg-surface p-3 font-mono text-[11px] text-error">
{error.message}
{info?.componentStack ?? ''}
          </pre>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={this.reset}
              className="rounded-md bg-accent px-3 py-1.5 text-[12px] font-medium text-white hover:opacity-90"
            >
              Reload app
            </button>
            <button
              type="button"
              onClick={() => this.setState({ error: null, info: null })}
              className="rounded-md px-3 py-1.5 text-[12px] text-text-secondary hover:text-text-primary"
            >
              Try to continue
            </button>
          </div>
        </div>
      </div>
    )
  }
}
