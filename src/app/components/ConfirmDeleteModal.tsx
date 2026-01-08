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
        {/* Warning Icon - NEO-BRUTALIST */}
        <div className="flex justify-center">
          <div className="w-16 h-16 bg-red-500 border-4 border-black flex items-center justify-center shadow-[4px_4px_0px_0px_#000000]">
            <AlertTriangle size={32} className="text-white" />
          </div>
        </div>

        {/* Title & Message - NEO-BRUTALIST */}
        <div className="text-center space-y-2">
          <h3 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-wide">
            {displayTitle}
          </h3>
          <p className="text-sm text-gray-500 leading-relaxed max-w-sm mx-auto">
            {displayMessage}
          </p>
        </div>

        {/* Item Count Badge - NEO-BRUTALIST */}
        <div className="flex justify-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-red-100 dark:bg-red-900/30 border-2 border-red-500">
            <Trash2 size={14} className="text-red-600 dark:text-red-400" />
            <span className="text-sm font-bold text-red-700 dark:text-red-300">
              {itemCount} {pluralizedType} will be permanently deleted
            </span>
          </div>
        </div>

        {/* Action Buttons - NEO-BRUTALIST */}
        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            onClick={onClose}
            disabled={isDeleting}
            className="px-5 py-2.5 text-sm font-bold text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 border-2 border-gray-300 dark:border-gray-600 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-wide"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isDeleting}
            className="px-5 py-2.5 text-sm font-black text-white bg-red-500 hover:bg-red-600 border-2 border-black shadow-[3px_3px_0px_0px_#000000] hover:shadow-[1px_1px_0px_0px_#000000] hover:translate-x-[2px] hover:translate-y-[2px] transition-all duration-200 flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed uppercase tracking-wide"
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

