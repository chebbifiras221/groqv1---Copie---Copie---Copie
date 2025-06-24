"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { ConnectionState } from 'livekit-client';

interface BotIconProps {
  connectionState: ConnectionState;
  className?: string;
}

export function BotIcon({ connectionState, className = '' }: BotIconProps) {
  const isConnected = connectionState === ConnectionState.Connected;
  const isDisconnected = connectionState === ConnectionState.Disconnected;
  const isLoading = [
    ConnectionState.Connecting,
    ConnectionState.Reconnecting,
    ConnectionState.Disconnecting
  ].includes(connectionState);

  // Determine the color based on connection state
  const fillColor = isConnected
    ? '#2ea043' // success color
    : isDisconnected
      ? '#6e7681' // neutral color
      : '#e3b341'; // warning color

  return (
    <div className={`relative ${className}`}>
      {/* Happy Bot face SVG */}
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="relative z-10"
      >
        {/* Circle outline */}
        <path
          d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM12 20C7.59 20 4 16.41 4 12C4 7.59 7.59 4 12 4C16.41 4 20 7.59 20 12C20 16.41 16.41 20 12 20Z"
          fill={fillColor}
        />
        {/* Left eye - happy curved eye */}
        <path
          d="M8.5 9C9.33 9 10 9.67 10 10.5C10 11.33 9.33 12 8.5 12C7.67 12 7 11.33 7 10.5C7 9.67 7.67 9 8.5 9Z"
          fill={fillColor}
        />
        {/* Right eye - happy curved eye */}
        <path
          d="M15.5 9C16.33 9 17 9.67 17 10.5C17 11.33 16.33 12 15.5 12C14.67 12 14 11.33 14 10.5C14 9.67 14.67 9 15.5 9Z"
          fill={fillColor}
        />
        {/* Big happy smile with upturned corners */}
        <path
          d="M7 15C7 15 9 18 12 18C15 18 17 15 17 15"
          stroke={fillColor}
          strokeWidth="1.5"
          strokeLinecap="round"
          fill="none"
        />
        {/* Cheeks for extra happiness */}
        <circle
          cx="6.5"
          cy="13.5"
          r="1"
          fill={fillColor}
          opacity="0.7"
        />
        <circle
          cx="17.5"
          cy="13.5"
          r="1"
          fill={fillColor}
          opacity="0.7"
        />
      </svg>

      {/* Loading animation for connecting states */}
      {isLoading && (
        <motion.div
          className="absolute inset-0 rounded-full z-0"
          style={{ backgroundColor: fillColor }}
          animate={{ scale: [1, 1.2, 1], opacity: [0.2, 0.1, 0.2] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        />
      )}
    </div>
  );
}
