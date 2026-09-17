import React, { Component, ErrorInfo, ReactNode } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
}

export class EditorErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[BetterShot:ErrorBoundary] Uncaught Studio Editor error:', error, errorInfo)
    this.setState({ error, errorInfo })
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="w-screen h-screen bg-[#0d0d11] text-white p-8 flex flex-col items-center justify-center select-text font-sans">
          <div className="max-w-2xl bg-[#161922] border border-red-500/40 rounded-2xl p-6 shadow-2xl flex flex-col gap-4">
            <div className="flex items-center gap-3 text-red-400">
              <AlertTriangle className="w-8 h-8 flex-shrink-0" />
              <div>
                <h2 className="text-lg font-bold">Studio Editor Render Failure</h2>
                <p className="text-xs text-gray-400">An unexpected React rendering error occurred.</p>
              </div>
            </div>

            <div className="bg-[#0b0c10] p-4 rounded-xl border border-white/10 font-mono text-xs text-red-300 overflow-auto max-h-60">
              {this.state.error?.toString()}
              {this.state.errorInfo?.componentStack && (
                <div className="mt-2 text-gray-400 whitespace-pre-wrap font-mono text-[11px]">
                  {this.state.errorInfo.componentStack}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-2 border-t border-white/5">
              <button
                onClick={() => this.setState({ hasError: false, error: null, errorInfo: null })}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs rounded-xl shadow-lg transition-all"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Retry Render</span>
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
