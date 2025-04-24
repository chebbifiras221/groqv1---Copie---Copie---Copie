"use client";

import React, { useEffect, useState, useCallback } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  maxWidth?: string;
  showCloseButton?: boolean;
  /**
   * ID of the element that labels the modal
   * Used for accessibility to connect the modal to its title
   */
  'aria-labelledby'?: string;
}

export function Modal({
  isOpen,
  onClose,
  title,
  children,
  maxWidth = 'max-w-2xl',
  showCloseButton = true,
  'aria-labelledby': ariaLabelledBy
}: ModalProps) {
  const [isMounted, setIsMounted] = useState(false);

  /**
   * Memoize the escape handler to prevent unnecessary re-renders
   * This ensures we don't create a new function on every render
   */
  const handleEscape = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  }, [onClose]);

  /**
   * Handle escape key press and body scroll lock
   * This improves accessibility and prevents scrolling behind the modal
   */
  useEffect(() => {
    setIsMounted(true);

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      // Prevent scrolling when modal is open
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      // Restore scrolling when modal is closed
      document.body.style.overflow = 'auto';
    };
  }, [isOpen, handleEscape]);

  // Don't render on the server
  if (!isMounted) return null;

  return (
    <>
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
            style={{ contain: 'content' }}
            onClick={onClose}
          >
            {/* Modal */}
            <div
              className={`bg-bg-primary rounded-lg ${maxWidth} w-full max-h-[90vh] overflow-hidden border border-bg-tertiary/30`}
              style={{
                contain: 'content',
                transform: 'translateZ(0)' // Force GPU acceleration
              }}
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby={ariaLabelledBy || (title ? 'modal-title' : undefined)}
            >
              {/* Header */}
              {(title || showCloseButton) && (
                <div className="flex items-center justify-between p-4 bg-bg-secondary">
                  {title && <h2 id="modal-title" className="text-lg font-semibold text-text-primary">{title}</h2>}
                  {showCloseButton && (
                    <button
                      onClick={onClose}
                      className="text-text-secondary hover:text-text-primary rounded-full p-1 hover:bg-bg-tertiary transition-colors"
                      aria-label="Close modal"
                    >
                      <X size={20} />
                    </button>
                  )}
                </div>
              )}

              {/* Content */}
              <div
                className="overflow-y-auto max-h-[calc(90vh-4rem)]"
                style={{ contain: 'content', transform: 'translateZ(0)' }}
              >
                {children}
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
