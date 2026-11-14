import React from 'react';
import { RefreshCw, AlertTriangle } from 'lucide-react';

interface AppErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  AppErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: unknown): AppErrorBoundaryState {
    return {
      hasError: true,
      message: error instanceof Error ? error.message : 'An unexpected rendering error occurred.',
    };
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo): void {
    console.error('AI Music Haven render error:', error, info.componentStack);
  }

  handleReload = (): void => {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#08080C] text-[#e4e1e8] flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-[#0F0F16] border border-white/10 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-5 text-center">
            <div className="w-12 h-12 rounded-2xl bg-[#EF4444]/15 border border-[#EF4444]/30 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6 text-[#EF4444]" />
            </div>
            <div className="space-y-2">
              <h1 className="font-display font-bold text-xl text-white">
                AI Music Haven Hit a Snag
              </h1>
              <p className="text-sm text-[#958ea0]">
                Something interrupted the studio interface while loading. Reloading restores your session cleanly.
              </p>
              {this.state.message && (
                <p className="text-xs font-mono-tech text-[#EF4444]/90 bg-[#08080C] border border-white/5 rounded-xl px-3 py-2 break-words">
                  {this.state.message}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={this.handleReload}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-[#8B5CF6] to-[#06B6D4] text-white font-semibold text-sm flex items-center justify-center gap-2 hover:opacity-95 transition-opacity"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Reload AI Music Haven</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
