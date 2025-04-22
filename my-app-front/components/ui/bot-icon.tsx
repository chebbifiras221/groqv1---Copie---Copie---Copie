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
      {/* Bot face SVG */}
      <svg 
        width="24" 
        height="24" 
        viewBox="0 0 24 24" 
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
        className="relative z-10"
      >
        <path 
          d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM12 20C7.59 20 4 16.41 4 12C4 7.59 7.59 4 12 4C16.41 4 20 7.59 20 12C20 16.41 16.41 20 12 20Z" 
          fill={fillColor}
        />
        <path 
          d="M8 14C9.1 14 10 13.1 10 12C10 10.9 9.1 10 8 10C6.9 10 6 10.9 6 12C6 13.1 6.9 14 8 14Z" 
          fill={fillColor}
        />
        <path 
          d="M16 14C17.1 14 18 13.1 18 12C18 10.9 17.1 10 16 10C14.9 10 14 10.9 14 12C14 13.1 14.9 14 16 14Z" 
          fill={fillColor}
        />
        <path 
          d="M12 17.5C14.33 17.5 16.31 16.04 17.11 14H6.89C7.69 16.04 9.67 17.5 12 17.5Z" 
          fill={fillColor}
        />
      </svg>

      {/* Blinking eyes animation */}
      {isConnected && (
        <motion.div
          className="absolute inset-0 z-20"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0, 1, 0, 0] }}
          transition={{ duration: 3, repeat: Infinity, repeatDelay: 2 }}
        >
          <svg 
            width="24" 
            height="24" 
            viewBox="0 0 24 24" 
            fill="none" 
            xmlns="http://www.w3.org/2000/svg"
          >
            <path 
              d="M8 12C8 12 8 12 8 12C8 12 8 12 8 12Z" 
              stroke="#0d1117" 
              strokeWidth="8" 
              strokeLinecap="round"
            />
            <path 
              d="M16 12C16 12 16 12 16 12C16 12 16 12 16 12Z" 
              stroke="#0d1117" 
              strokeWidth="8" 
              strokeLinecap="round"
            />
          </svg>
        </motion.div>
      )}

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
