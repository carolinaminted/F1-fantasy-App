import React, { ErrorInfo, ReactNode } from 'react';
import { F1CarIcon } from './icons/F1CarIcon.tsx';

interface ErrorBoundaryProps {
  // Made children optional to resolve 'missing property children' error when used with nested JSX.
  children?: ReactNode;
  onReset?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

// Fix: Explicitly extend React.Component to ensure that 'props', 'state', and 'setState' are correctly identified as inherited members by the TypeScript compiler.
class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  // Fix: Initialize state using property initializer.
  state: ErrorBoundaryState = {
    hasError: false,
    error: null
  };

  // Fix: Ensure constructor correctly passes props to the base class.
  constructor(props: ErrorBoundaryProps) {
    super(props);
  }

  // Fix: Use static method correctly to derive error state.
  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  // Fix: Explicitly typed componentDidCatch.
  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log the error to an error reporting service or console
    console.error("Uncaught error caught by ErrorBoundary:", error, errorInfo);
  }

  // Fix: handleReload now correctly accesses inherited members 'this.props' and 'this.setState' from React.Component.
  handleReload = () => {
    const { onReset } = this.props;
    if (onReset) {
        this.setState({ hasError: false, error: null });
        onReset();
    } else {
        window.location.reload();
    }
  };

  render() {
    // Fix: Access state and props via destructuring from 'this' as inherited from React.Component.
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