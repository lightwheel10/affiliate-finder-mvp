'use client';

import React, { Component, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

interface TranslatedErrorBoundaryProps extends ErrorBoundaryProps {
  translations: {
    title: string;
    message: string;
    contactPrefix: string;
    tryAgain: string;
  };
}

/**
 * =============================================================================
 * ErrorBoundary Component — SMOOVER REFRESH
 * =============================================================================
 *
 * Created: 29th December 2025
 * Updated: April 24th, 2026 — smoover visual refresh
 * i18n Migration: January 10th, 2026 - Priority 5: Shared Components
 *
 * CURRENT DESIGN LANGUAGE ("smoover"):
 * - Red icon tile: rounded-2xl + shadow-soft-lg (no more brutalist offset).
 * - Title: Archivo display (font-display) + tracking-tight, mixed case.
 * - "Try again" CTA: rounded-full + shadow-yellow-glow-sm + hover lift,
 *   matching sign-in / onboarding primary CTAs.
 * - Vivid red (bg-red-500) preserved as the error signal colour.
 *
 * PURPOSE:
 * Catches React errors and shows a friendly message instead of crashing.
 * This prevents users from seeing a blank white screen when something breaks.
 *
 * HOW IT WORKS:
 * - Wraps page content under the (dashboard) route group, which also hosts
 *   OnboardingScreen via AuthGuard — so this is the error UI for both the
 *   dashboard pages AND the onboarding flow.
 * - If any child component throws an error, this catches it.
 * - Shows "Something went wrong" message with refresh button.
 * - Logs error to console for debugging.
 *
 * i18n NOTES:
 * Since ErrorBoundary is a class component (required for error boundaries),
 * we use a wrapper functional component to access the translation hook and
 * pass translations as props to the class component.
 *
 * All UI strings have been migrated to use the translation dictionary.
 *
 * =============================================================================
 */

// Inner class component that receives translations as props
class ErrorBoundaryInner extends Component<TranslatedErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: TranslatedErrorBoundaryProps) {
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
      const { translations } = this.props;
      
      return (
        <div className="flex items-center justify-center min-h-[400px] p-8">
          <div className="text-center max-w-md">
            {/* Icon — smoover refresh (April 24th, 2026). Red signal colour kept vivid; tile softened to rounded-2xl + shadow-soft-lg. */}
            <div className="w-16 h-16 bg-red-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-soft-lg">
              <AlertTriangle className="w-8 h-8 text-white" />
            </div>

            {/* Message — smoover Archivo display title + muted body */}
            <h2 className="text-lg font-display font-bold text-[#0f172a] dark:text-white mb-2 tracking-tight">
              {translations.title}
            </h2>
            <p className="text-sm text-[#8898aa] dark:text-gray-400 mb-6">
              {translations.message}{' '}
              <a
                href="mailto:support@afforceone.com"
                className="text-[#0f172a] dark:text-white font-semibold hover:underline"
              >
                {translations.contactPrefix}
              </a>
            </p>

            {/* Refresh Button — smoover primary CTA (rounded-full + shadow-yellow-glow-sm) */}
            <button
              onClick={this.handleRefresh}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#ffbf23] text-[#1A1D21] font-bold uppercase tracking-wide rounded-full hover:bg-[#e5ac20] shadow-yellow-glow-sm hover:shadow-yellow-glow hover:-translate-y-px transition-all"
            >
              <RefreshCw size={16} />
              {translations.tryAgain}
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Wrapper functional component that provides translations to the class component
const ErrorBoundary: React.FC<ErrorBoundaryProps> = ({ children }) => {
  const { t } = useLanguage();
  
  return (
    <ErrorBoundaryInner translations={t.errorBoundary}>
      {children}
    </ErrorBoundaryInner>
  );
};

export default ErrorBoundary;
