"use client"

import { Component, type ReactNode } from "react"
import { AlertCircle, RefreshCw } from "lucide-react"

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  render() {
    if (this.state.error) {
      return (
        this.props.fallback ?? (
          <div className="flex flex-col items-center justify-center min-h-[400px] gap-5 p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-danger-50 flex items-center justify-center">
              <AlertCircle className="w-8 h-8 text-danger-500" strokeWidth={1.5} />
            </div>
            <div>
              <h3 className="font-display font-semibold text-lg text-ink-primary">
                Something went wrong
              </h3>
              <p className="font-body text-sm text-ink-secondary mt-1 max-w-[280px] mx-auto leading-relaxed">
                An unexpected error occurred. Please try refreshing the page.
              </p>
            </div>
            <button
              onClick={() => window.location.reload()}
              className="flex items-center gap-2 px-4 py-2.5 rounded-[10px] border border-border-default text-sm font-medium font-body text-ink-secondary hover:border-primary-500 hover:text-primary-500 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh Page
            </button>
          </div>
        )
      )
    }

    return this.props.children
  }
}
