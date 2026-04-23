/**
 * ConfirmDeleteModal.tsx
 * Created: December 2025
 * i18n Migration: January 10th, 2026 - Priority 5: Shared Components
 * Smoover Redesign: April 23rd, 2026 - Phase 2b
 *   Visual refresh to match the softer design system (rounded-full controls,
 *   hairline borders, soft red glow for destructive CTA). No behavioral or
 *   i18n changes — all logic, props API, and translation keys preserved.
 * 
 * A reusable confirmation modal for delete operations.
 * Used by:
 * - Find New page: Bulk delete confirmation
 * - Discovered page: Bulk delete confirmation
 * - Saved page: Bulk delete confirmation
 * 
 * Features:
 * - Modern design matching app aesthetic
 * - Customizable title, message, and item count
 * - Loading state during deletion
 * - Keyboard support (Escape to cancel)
 * 
 * All UI strings have been migrated to use the translation dictionary.
 * Translation hook usage: const { t } = useLanguage();
 */

'use client';

import React from 'react';
import { Modal } from './Modal';
import { AlertTriangle, Trash2, Loader2 } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

interface ConfirmDeleteModalProps {
  /** Whether the modal is open */
  isOpen: boolean;
  /** Callback when modal is closed (cancel or backdrop click) */
  onClose: () => void;
  /** Callback when delete is confirmed */
  onConfirm: () => void;
  /** Number of items being deleted */
  itemCount: number;
  /** Whether deletion is in progress */
  isDeleting?: boolean;
  /** Custom title (optional) */
  title?: string;
  /** Custom message (optional) */
  message?: string;
  /** Type of items being deleted for display (e.g., "affiliates", "items") */
  itemType?: string;
}

export const ConfirmDeleteModal: React.FC<ConfirmDeleteModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  itemCount,
  isDeleting = false,
  title,
  message,
  itemType = 'affiliate'
}) => {
  // i18n translation hook (January 10th, 2026)
  const { t } = useLanguage();
  
  // Pluralize item type based on count - use translated strings for affiliates
  const pluralizedType = itemCount === 1 
    ? (itemType === 'affiliate' ? t.modals.confirmDelete.affiliate : itemType)
    : (itemType === 'affiliate' ? t.modals.confirmDelete.affiliates : `${itemType}s`);
  
  // Default title and message if not provided
  const displayTitle = title || `${t.modals.confirmDelete.deleteCount} ${itemCount} ${pluralizedType}?`;
  const displayMessage = message || t.modals.confirmDelete.message;

  return (
    <Modal
      isOpen={isOpen}
      onClose={isDeleting ? () => {} : onClose} // Prevent closing while deleting
      title=""
      width="max-w-md"
    >
      <div className="space-y-5">
        {/* Warning Icon — SMOOVER (April 23rd, 2026): soft red tint with hairline border instead of brutalist offset shadow */}
        <div className="flex justify-center">
          <div className="w-14 h-14 rounded-2xl bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 flex items-center justify-center">
            <AlertTriangle size={28} className="text-red-500" />
          </div>
        </div>

        {/* Title & Message — SMOOVER (April 23rd, 2026): display-font bold slate title, muted body copy */}
        <div className="text-center space-y-2">
          <h3 className="text-xl font-display font-bold text-[#0f172a] dark:text-white">
            {displayTitle}
          </h3>
          <p className="text-sm text-[#425466] dark:text-gray-400 leading-relaxed max-w-sm mx-auto">
            {displayMessage}
          </p>
        </div>

        {/* Item Count Badge — SMOOVER (April 23rd, 2026): rounded pill with hairline red border */}
        <div className="flex justify-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20">
            <Trash2 size={14} className="text-red-600 dark:text-red-400" />
            <span className="text-sm font-medium text-red-600 dark:text-red-400">
              {itemCount} {pluralizedType} {t.modals.confirmDelete.willBeDeleted}
            </span>
          </div>
        </div>

        {/* Action Buttons — SMOOVER (April 23rd, 2026): rounded-full, ghost cancel + soft red-glow destructive CTA */}
        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            onClick={onClose}
            disabled={isDeleting}
            className="px-5 py-2.5 text-sm font-medium rounded-full text-[#425466] dark:text-gray-300 bg-white dark:bg-[#1a1a1a] hover:bg-[#f6f9fc] dark:hover:bg-gray-800 border border-[#e6ebf1] dark:border-gray-700 shadow-soft-sm transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t.modals.confirmDelete.cancel}
          </button>
          <button
            onClick={onConfirm}
            disabled={isDeleting}
            className="px-5 py-2.5 text-sm font-semibold rounded-full text-white bg-red-500 hover:bg-red-600 shadow-[0_4px_14px_-2px_rgba(239,68,68,0.35)] hover:shadow-[0_6px_18px_-2px_rgba(239,68,68,0.45)] transition-all duration-200 flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isDeleting ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                {t.modals.confirmDelete.deleting}
              </>
            ) : (
              <>
                <Trash2 size={16} />
                {t.modals.confirmDelete.deleteCount} {itemCount} {pluralizedType}
              </>
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
};

