/**
 * =============================================================================
 * MODAL COMPONENT
 * =============================================================================
 *
 * Created: December 2025 (Neo-brutalist shell)
 * Updated: April 23rd, 2026 - "SMOOVER" visual refresh (Phase 2b)
 *
 * APRIL 23RD, 2026 - VISUAL REFRESH (Phase 2b):
 * ---------------------------------------------
 * Shared modal shell used by ~10 consumers (Sidebar logout, AddCardModal,
 * PricingModal, ConfirmDeleteModal, plus 1-3 modals each on find / settings /
 * saved / outreach dashboard pages). Updating this file alone cascades the
 * soft visual language to every one of those surfaces.
 *
 * What changed:
 * - Container: border-4 black + 8px offset shadow  →  rounded-2xl hairline
 *   border (#e6ebf1) + shadow-soft-xl. Added overflow-hidden so the header's
 *   subtle fill respects the rounded corners.
 * - Header: solid yellow block + border-b-4 black + font-black/uppercase title
 *   →  clean white (respects dark mode) + hairline bottom border + font-display
 *   bold title in dark slate. Keeps the conditional-render pattern so
 *   consumers passing title="" (PricingModal, ConfirmDeleteModal) still get
 *   no header — unchanged behaviour.
 * - Close button: black square with border-2  →  rounded-full ghost icon
 *   button that lights up on hover.
 *
 * What is UNCHANGED:
 * - Portal target (document.body), z-index (9999), backdrop click to close.
 * - Escape-key listener, body-scroll lock.
 * - Enter/exit animation timing (10ms paint delay, 300ms scale+fade,
 *   300ms unmount wait). Scale 95 → 100 on open.
 * - `width` prop default ("max-w-md") and all existing overrides.
 * - All existing consumer JSX (title="" pattern, children layout).
 *
 * NOT addressed by this change (by design):
 * - The content INSIDE each modal body is still brutalist (buttons, warnings,
 *   uppercase titles etc.). Those need per-consumer passes.
 * - AffiliateRow.tsx rolls its own inline modal markup (3 custom modals) and
 *   does NOT route through this component, despite importing it. It will
 *   stay brutalist until a dedicated refactor pass.
 *
 * =============================================================================
 */

'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  width?: string;
}

export const Modal: React.FC<ModalProps> = ({ 
  isOpen, 
  onClose, 
  title, 
  children,
  width = "max-w-md"
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      // Small timeout to allow mounting before adding opacity class for transition
      const timer = setTimeout(() => setIsVisible(true), 10);
      return () => clearTimeout(timer);
    } else {
      setIsVisible(false);
      // Wait for transition to finish before unmounting
      const timer = setTimeout(() => setShouldRender(false), 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Lock body scroll
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!shouldRender) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      {/* Backdrop — unchanged (already soft). */}
      <div
        className={cn(
          "absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-300",
          isVisible ? "opacity-100" : "opacity-0"
        )}
        onClick={onClose}
      />

      {/* =================================================================== */
      /*  Modal Content — "SMOOVER" refresh (April 23rd, 2026).                */
      /*  Was:  border-4 black + 8px offset brutalist shadow.                  */
      /*  Now:  rounded-2xl hairline border + soft drop shadow.                */
      /*  `overflow-hidden` added so the header's subtle fill stays inside the */
      /*  rounded corners. Scroll still lives on the body (overflow-y-auto).   */
      /*  =================================================================== */}
      <div
        className={cn(
          "relative bg-white dark:bg-[#0f0f0f] border border-[#e6ebf1] dark:border-gray-800 rounded-2xl overflow-hidden w-full transform transition-all duration-300 scale-95 opacity-0 max-h-[90vh] flex flex-col shadow-soft-xl",
          width,
          isVisible && "scale-100 opacity-100"
        )}
      >
        {/* =============================================================== */
        /*  Header — "SMOOVER" refresh (April 23rd, 2026).                  */
        /*  Was:  solid yellow block + border-b-4 black + font-black        */
        /*         uppercase title + black square close button.             */
        /*  Now:  clean white (respects dark mode) + hairline divider +    */
        /*         font-display bold title + rounded-full ghost close btn. */
        /*  Conditional render on `title` is UNCHANGED — consumers passing */
        /*  title="" (PricingModal, ConfirmDeleteModal) still render no    */
        /*  header and no close button, exactly as today.                  */
        /*  =============================================================== */}
        {title && (
          <div className="flex items-center justify-between px-6 py-4 border-b border-[#e6ebf1] dark:border-gray-800 shrink-0 bg-white dark:bg-[#0f0f0f]">
            <h3 className="font-display text-lg font-bold text-[#0f172a] dark:text-white">
              {title}
            </h3>
            <button
              onClick={onClose}
              aria-label="Close modal"
              className="w-8 h-8 rounded-full flex items-center justify-center text-[#8898aa] hover:text-[#0f172a] dark:hover:text-white hover:bg-[#f6f9fc] dark:hover:bg-gray-800 transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        )}

        {/* Body — unchanged (padding + custom-scrollbar utility preserved). */}
        <div className="p-6 overflow-y-auto custom-scrollbar">
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
};

