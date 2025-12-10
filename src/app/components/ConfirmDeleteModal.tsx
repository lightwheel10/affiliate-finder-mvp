/**
 * ConfirmDeleteModal.tsx
 * Created: December 2025
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
 */

'use client';

import React from 'react';
import { Modal } from './Modal';
import { AlertTriangle, Trash2, Loader2 } from 'lucide-react';

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
  // Pluralize item type based on count
  const pluralizedType = itemCount === 1 ? itemType : `${itemType}s`;
  
  // Default title and message if not provided
  const displayTitle = title || `Delete ${itemCount} ${pluralizedType}?`;
  const displayMessage = message || 
    `Are you sure you want to delete ${itemCount} selected ${pluralizedType}? This action cannot be undone.`;

  return (
    <Modal
      isOpen={isOpen}
      onClose={isDeleting ? () => {} : onClose} // Prevent closing while deleting
      title=""
      width="max-w-md"
    >
      <div className="space-y-5">
        {/* Warning Icon */}
        <div className="flex justify-center">
          <div className="w-16 h-16 rounded-full bg-red-50 border-4 border-red-100 flex items-center justify-center">
            <AlertTriangle size={32} className="text-red-500" />
          </div>
        </div>

        {/* Title & Message */}
        <div className="text-center space-y-2">
          <h3 className="text-xl font-bold text-slate-900">
            {displayTitle}
          </h3>
          <p className="text-sm text-slate-500 leading-relaxed max-w-sm mx-auto">
            {displayMessage}
          </p>
        </div>

        {/* Item Count Badge */}
        <div className="flex justify-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-red-50 border border-red-100 rounded-lg">
            <Trash2 size={14} className="text-red-500" />
            <span className="text-sm font-semibold text-red-700">
              {itemCount} {pluralizedType} will be permanently deleted
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            onClick={onClose}
            disabled={isDeleting}
            className="px-5 py-2.5 text-sm font-semibold text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isDeleting}
            className="px-5 py-2.5 text-sm font-semibold text-white bg-red-500 hover:bg-red-600 border border-transparent rounded-xl shadow-sm hover:shadow-md shadow-red-500/20 transition-all duration-200 flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isDeleting ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Deleting...
              </>
            ) : (
              <>
                <Trash2 size={16} />
                Delete {itemCount} {pluralizedType}
              </>
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
};

