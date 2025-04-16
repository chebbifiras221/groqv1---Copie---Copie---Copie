"use client";

import React, { useState, useEffect, createContext, useContext } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, AlertCircle, Info, X } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

interface ToastContextType {
  toasts: Toast[];
  addToast: (message: string, type: ToastType, duration?: number) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = (message: string, type: ToastType, duration = 5000) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type, duration }]);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  };

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      <ToastContainer />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (context === undefined) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

function ToastContainer() {
  const { toasts, removeToast } = useToast();

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2">
      <AnimatePresence>
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onClose={() => removeToast(toast.id)} />
        ))}
      </AnimatePresence>
    </div>
  );
}

function ToastItem({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  useEffect(() => {
    if (toast.duration) {
      const timer = setTimeout(() => {
        onClose();
      }, toast.duration);
      return () => clearTimeout(timer);
    }
  }, [toast, onClose]);

  let bgColor = '';
  let Icon = Info;

  switch (toast.type) {
    case 'success':
      bgColor = 'border-success-DEFAULT bg-success-DEFAULT bg-opacity-10';
      Icon = CheckCircle;
      break;
    case 'error':
      bgColor = 'border-danger-DEFAULT bg-danger-DEFAULT bg-opacity-10';
      Icon = AlertCircle;
      break;
    case 'warning':
      bgColor = 'border-warning-DEFAULT bg-warning-DEFAULT bg-opacity-10';
      Icon = AlertCircle;
      break;
    case 'info':
    default:
      bgColor = 'border-primary-DEFAULT bg-primary-DEFAULT bg-opacity-10';
      Icon = Info;
  }

  return (
    <motion.div
      className={`flex items-center gap-3 px-4 py-3 rounded-md shadow-md border-l-4 ${bgColor} max-w-md`}
      initial={{ opacity: 0, y: -20, x: 20 }}
      animate={{ opacity: 1, y: 0, x: 0 }}
      exit={{ opacity: 0, y: -20, x: 20 }}
    >
      <div className={`text-${toast.type === 'success' ? 'success' : toast.type === 'error' ? 'danger' : toast.type === 'warning' ? 'warning' : 'primary'}-DEFAULT`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="flex-1">
        <p className="text-sm font-medium text-text-primary">{toast.message}</p>
      </div>
      <button
        onClick={onClose}
        className="text-text-secondary hover:text-text-primary transition-colors"
      >
        <X className="h-4 w-4" />
      </button>
    </motion.div>
  );
}
