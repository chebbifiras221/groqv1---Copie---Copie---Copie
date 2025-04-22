"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { ConnectionState } from 'livekit-client';
import { useConnectionState } from '@livekit/components-react';
import { BotIcon } from './bot-icon';

interface StatusIndicatorProps {
  className?: string;
  showText?: boolean;
}

export function StatusIndicator({ className = '', showText = true }: StatusIndicatorProps) {
  const connectionState = useConnectionState();

  let statusColor = '';
  let statusText = '';
  let StatusIcon = Loader2;

  switch (connectionState) {
    case ConnectionState.Connecting:
      statusColor = 'bg-warning-DEFAULT';
      statusText = 'Connecting...';
      StatusIcon = Loader2;
      break;
    case ConnectionState.Connected:
      statusColor = 'bg-success-DEFAULT';
      statusText = 'Connected';
      StatusIcon = CheckCircle;
      break;
    case ConnectionState.Disconnected:
      statusColor = 'bg-neutral-emphasis';
      statusText = 'Disconnected';
      StatusIcon = AlertCircle;
      break;
    case ConnectionState.Disconnecting:
      statusColor = 'bg-warning-DEFAULT';
      statusText = 'Disconnecting...';
      StatusIcon = Loader2;
      break;
    case ConnectionState.Reconnecting:
      statusColor = 'bg-warning-DEFAULT';
      statusText = 'Reconnecting...';
      StatusIcon = Loader2;
      break;
    default:
      statusColor = 'bg-neutral-emphasis';
      statusText = 'Unknown';
      StatusIcon = AlertCircle;
  }

  const isLoading = [
    ConnectionState.Connecting,
    ConnectionState.Reconnecting,
    ConnectionState.Disconnecting
  ].includes(connectionState);

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <BotIcon connectionState={connectionState} />
      {showText && (
        <span className="text-xs text-text-secondary font-medium">
          {statusText}
        </span>
      )}
    </div>
  );
}

interface ConnectionToastProps {
  state: ConnectionState;
  onClose?: () => void;
}

export function ConnectionToast({ state, onClose }: ConnectionToastProps) {
  let statusColor = '';
  let statusText = '';
  let StatusIcon = Loader2;

  switch (state) {
    case ConnectionState.Connected:
      statusColor = 'bg-success-DEFAULT border-success-DEFAULT';
      statusText = 'Connected successfully';
      StatusIcon = CheckCircle;
      break;
    case ConnectionState.Disconnected:
      statusColor = 'bg-danger-DEFAULT border-danger-DEFAULT';
      statusText = 'Disconnected from server';
      StatusIcon = AlertCircle;
      break;
    case ConnectionState.Reconnecting:
      statusColor = 'bg-warning-DEFAULT border-warning-DEFAULT';
      statusText = 'Connection lost, attempting to reconnect...';
      StatusIcon = Loader2;
      break;
    default:
      return null;
  }

  const isLoading = state === ConnectionState.Reconnecting;

  return (
    <motion.div
      className={`fixed top-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-md bg-bg-secondary border-l-4 ${statusColor}`}
      style={{ boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)' }}
      initial={{ opacity: 0, y: -20, x: 20 }}
      animate={{ opacity: 1, y: 0, x: 0 }}
      exit={{ opacity: 0, y: -20, x: 20 }}
    >
      <div className="text-white">
        {isLoading ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : (
          <StatusIcon className="w-5 h-5" />
        )}
      </div>
      <div className="flex-1">
        <p className="text-sm font-medium text-text-primary">{statusText}</p>
      </div>
      {onClose && (
        <button
          onClick={onClose}
          className="text-text-secondary hover:text-text-primary transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </button>
      )}
    </motion.div>
  );
}
