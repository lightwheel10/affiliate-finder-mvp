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
 * ErrorBoundary Component - NEO-BRUTALIST
 * =============================================================================
 * 
 * Created: 29th December 2025
 * Updated: January 8th, 2026
 * 
 * NEO-BRUTALIST DESIGN UPDATE:
 * - Sharp edges (no rounded corners)
 * - Bold borders (border-2 to border-4 with black)
 * - Yellow accent color (#ffbf23)
 * - Square elements throughout
 * - Bold typography (font-black uppercase)
 * - Dark mode support
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
            {/* Icon - NEO-BRUTALIST square */}
            <div className="w-16 h-16 bg-red-500 border-4 border-black flex items-center justify-center mx-auto mb-4 shadow-[4px_4px_0px_0px_#000000]">
              <AlertTriangle className="w-8 h-8 text-white" />
            </div>
            
            {/* Message - NEO-BRUTALIST */}
            <h2 className="text-lg font-black text-gray-900 dark:text-white mb-2 uppercase tracking-wide">
              Something went wrong
            </h2>
            <p className="text-sm text-gray-500 mb-6">
              Please try again later. If the problem continues, contact us at{' '}
              <a 
                href="mailto:support@crewcast.studio" 
                className="text-black dark:text-white font-bold hover:underline"
              >
                support@crewcast.studio
              </a>
            </p>
            
            {/* Refresh Button - NEO-BRUTALIST */}
            <button
              onClick={this.handleRefresh}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#ffbf23] text-black font-black uppercase tracking-wide border-2 border-black shadow-[4px_4px_0px_0px_#000000] hover:shadow-[2px_2px_0px_0px_#000000] hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
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
