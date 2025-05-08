"use client";

import React, { useState, useEffect } from 'react';
import { AlertCircle, WifiOff, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface ConnectionErrorAlertProps {
  message: string;
  details?: string;
  onRetry?: () => void;
  autoHide?: boolean;
  hideAfter?: number; // in milliseconds
}

export function ConnectionErrorAlert({
  message,
  details,
  onRetry,
  autoHide = false,
  hideAfter = 10000, // Default to 10 seconds
}: ConnectionErrorAlertProps) {
  const [visible, setVisible] = useState(true);
  const [expanded, setExpanded] = useState(false);

  // Auto-hide the alert after the specified time if autoHide is true
  useEffect(() => {
    if (autoHide && visible) {
      const timer = setTimeout(() => {
        setVisible(false);
      }, hideAfter);

      return () => clearTimeout(timer);
    }
  }, [autoHide, hideAfter, visible]);

  // Handle retry action
  const handleRetry = () => {
    if (onRetry) {
      onRetry();
    }
  };

  // Handle dismiss action
  const handleDismiss = () => {
    setVisible(false);
  };

  // Toggle expanded state
  const toggleExpanded = () => {
    setExpanded(!expanded);
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
          className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 w-full max-w-md"
        >
          <div className="bg-danger-DEFAULT/95 text-white rounded-lg shadow-lg p-4 mx-4">
            <div className="flex items-start">
              <div className="flex-shrink-0 mt-0.5">
                <WifiOff size={20} className="text-white" />
              </div>
              <div className="ml-3 flex-1">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">
                    {message || "Connection error detected"}
                  </p>
                  <div className="flex-shrink-0 flex ml-4">
                    {onRetry && (
                      <button
                        type="button"
                        onClick={handleRetry}
                        className="inline-flex text-white hover:text-white/80 focus:outline-none mr-2"
                      >
                        <RefreshCw size={18} />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleDismiss}
                      className="inline-flex text-white hover:text-white/80 focus:outline-none"
                    >
                      <span className="sr-only">Close</span>
                      <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path
                          fillRule="evenodd"
                          d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </button>
                  </div>
                </div>
                {details && (
                  <div className="mt-2">
                    <button
                      type="button"
                      onClick={toggleExpanded}
                      className="text-xs text-white/80 hover:text-white underline focus:outline-none"
                    >
                      {expanded ? "Hide details" : "Show details"}
                    </button>
                    {expanded && (
                      <div className="mt-2 p-2 bg-black/20 rounded text-xs font-mono overflow-x-auto">
                        {details}
                      </div>
                    )}
                  </div>
                )}
                <div className="mt-2 text-xs text-white/80">
                  <p>
                    This may be due to network issues or server load. Try refreshing the page or checking your connection.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
