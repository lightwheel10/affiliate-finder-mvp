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
      {/* Backdrop - NEO-BRUTALIST */}
      <div 
        className={cn(
          "absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-300",
          isVisible ? "opacity-100" : "opacity-0"
        )}
        onClick={onClose}
      />

      {/* Modal Content - NEO-BRUTALIST (sharp edges, bold border, offset shadow) */}
      <div 
        className={cn(
          "relative bg-white dark:bg-[#0f0f0f] border-4 border-black dark:border-gray-600 w-full transform transition-all duration-300 scale-95 opacity-0 max-h-[90vh] flex flex-col shadow-[8px_8px_0px_0px_#000000] dark:shadow-[8px_8px_0px_0px_#333333]",
          width,
          isVisible && "scale-100 opacity-100"
        )}
      >
        {/* Header - NEO-BRUTALIST */}
        {title && (
          <div className="flex items-center justify-between px-6 py-4 border-b-4 border-black dark:border-gray-600 shrink-0 bg-[#ffbf23]">
            <h3 className="text-lg font-black text-black uppercase tracking-wide">{title}</h3>
            <button 
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center bg-black text-white hover:bg-gray-800 transition-colors border-2 border-black"
            >
              <X size={18} />
            </button>
          </div>
        )}

        {/* Body */}
        <div className="p-6 overflow-y-auto custom-scrollbar">
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
};

