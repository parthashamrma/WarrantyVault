import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { logger } from '../lib/logger';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    logger.error('Unhandled React Error Boundary Exception:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = '/dashboard';
  };

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-[var(--bg)] text-[var(--ink)]">
          <div className="max-w-md w-full bg-[var(--bg)] border-2 border-[var(--ink)] shadow-brutal p-8 rounded space-y-6 text-center">
            <div className="w-12 h-12 rounded bg-[var(--r)]/15 border border-[var(--r)] text-[var(--r)] flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div className="space-y-2">
              <span className="font-mono text-xs uppercase tracking-widest text-[var(--mut)]">
                Security Intercept · Error 500
              </span>
              <h1 className="font-serif text-3xl text-[var(--ink)] leading-tight">
                The vault encountered an unexpected disturbance.
              </h1>
              <p className="font-sans text-xs text-[var(--mut)] leading-relaxed">
                A client runtime exception occurred. Your stored documents and database records remain safe and encrypted.
              </p>
            </div>

            {this.state.error?.message && (
              <div className="p-3 rounded bg-[var(--bg2)] border border-[var(--line)] text-left font-mono text-[11px] text-[var(--mut)] break-words">
                {this.state.error.message}
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <button
                onClick={this.handleReload}
                className="btn sm o w-full sm:w-auto inline-flex items-center justify-center gap-2 cursor-pointer !text-xs"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Reload Vault</span>
              </button>
              <button
                onClick={this.handleReset}
                className="btn sm w-full sm:w-auto inline-flex items-center justify-center gap-2 cursor-pointer !text-xs"
              >
                <Home className="w-3.5 h-3.5" />
                <span>Return to Dashboard</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
