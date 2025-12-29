'use client';

import React, { Component, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

/**
 * =============================================================================
 * ErrorBoundary Component
 * =============================================================================
 * 
 * Created: 29th December 2025
 * 
 * PURPOSE:
 * Catches React errors and shows a friendly message instead of crashing.
 * This prevents users from seeing a blank white screen when something breaks.
 * 
 * HOW IT WORKS:
 * - Wraps page content (Dashboard, Saved, Discovered, Outreach, Settings)
 * - If any child component throws an error, this catches it
 * - Shows "Something went wrong" message with refresh button
 * - Logs error to console for debugging
 * 
 * USAGE:
 * Wrap any component that might crash:
 *   <ErrorBoundary>
 *     <YourComponent />
 *   </ErrorBoundary>
 * 
 * FUTURE IMPROVEMENTS:
 * - Add Sentry or similar error tracking service
 * - Add error reporting to backend for monitoring
 * - Add more specific error messages based on error type
 * 
 * =============================================================================
 */
class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log the error for debugging
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleRefresh = () => {
    this.setState({ hasError: false });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center min-h-[400px] p-8">
          <div className="text-center max-w-md">
            {/* Icon */}
            <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-8 h-8 text-red-500" />
            </div>
            
            {/* Message */}
            <h2 className="text-lg font-semibold text-slate-900 mb-2">
              Something went wrong
            </h2>
            <p className="text-sm text-slate-500 mb-6">
              Please try again later. If the problem continues, contact us at{' '}
              <a 
                href="mailto:support@crewcast.studio" 
                className="text-[#1A1D21] font-medium hover:underline"
              >
                support@crewcast.studio
              </a>
            </p>
            
            {/* Refresh Button */}
            <button
              onClick={this.handleRefresh}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#D4E815] text-[#1A1D21] font-semibold rounded-lg hover:bg-[#c5d913] transition-colors"
            >
              <RefreshCw size={16} />
              Try Again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;

