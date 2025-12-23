
import React, { Component, ErrorInfo, ReactNode } from 'react';
import { F1CarIcon } from './icons/F1CarIcon.tsx';

interface ErrorBoundaryProps {
  children?: ReactNode;
  onReset?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Standard Error Boundary component to catch rendering errors in child components.
 */
// Fix: Import Component directly from react and extend it to ensure state and props are correctly typed on 'this'.
class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  // Fix: Explicitly initialize state within the constructor and call super(props).
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null
    };
  }

  /**
   * Required static method for ErrorBoundary to catch errors during render.
   */
  public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  /**
   * Standard lifecycle method for logging caught errors.
   */
  public componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error("Uncaught error caught by ErrorBoundary:", error, errorInfo);
  }

  /**
   * Handles recovery from an error state.
   */
  public handleReload = (): void => {
    // Fix: Access props from the inherited instance (this.props).
    const { onReset } = this.props;
    if (onReset) {
        // Fix: Call setState from the base class to reset error boundaries.
        this.setState({ hasError: false, error: null });
        onReset();
    } else {
        window.location.reload();
    }
  };

  public render(): ReactNode {
    // Fix: Access state and props from the inherited instance properties in the render method.
    const { hasError, error } = this.state;
    const { children } = this.props;

    if (hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[50vh] p-8 text-center animate-fade-in">
          {/* F1 Themed "Safety Car" Alert */}
          <div className="bg-yellow-500/10 p-6 rounded-full mb-6 border border-yellow-500/50 shadow-[0_0_40px_rgba(234,179,8,0.2)]">
             <F1CarIcon className="w-20 h-20 text-yellow-500 animate-pulse" />
          </div>
          
          <h2 className="text-3xl md:text-4xl font-black text-pure-white mb-3 uppercase tracking-wide italic">
            Safety Car Deployed
          </h2>
          
          <p className="text-highlight-silver max-w-md mb-8 text-lg leading-relaxed">
            We hit an unexpected barrier on track. The session has been neutralized while we clear the debris.
          </p>
          
          {/* Technical Details (Collapsed/Small) */}
          <div className="bg-carbon-black/80 p-4 rounded-lg border border-red-500/20 max-w-lg w-full mb-8 overflow-hidden text-left shadow-inner">
             <p className="text-[10px] font-bold text-highlight-silver uppercase tracking-wider mb-1">Telemetry Data:</p>
             <p className="text-xs font-mono text-red-400 break-words">
                {error?.toString() || "Unknown Critical Failure"}
             </p>
          </div>

          <button
            onClick={this.handleReload}
            className="group relative bg-primary-red hover:bg-red-600 text-pure-white font-bold py-3 px-10 rounded-lg shadow-lg transition-all transform hover:scale-105 overflow-hidden"
          >
            <span className="relative z-10 flex items-center gap-2">
                BOX BOX (RELOAD)
            </span>
            {/* Speed lines effect */}
            <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-12"></div>
          </button>
        </div>
      );
    }

    return children;
  }
}

export default ErrorBoundary;
