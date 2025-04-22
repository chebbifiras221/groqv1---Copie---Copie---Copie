"use client";

import React from 'react';
import { motion } from 'framer-motion';

interface RobotFaceProps {
  className?: string;
  size?: number;
  animated?: boolean;
  muted?: boolean;
}

export function RobotFace({ className = '', size = 48, animated = true, muted = false }: RobotFaceProps) {
  // Colors based on theme
  const primaryColor = 'var(--primary)';
  const bgColor = 'var(--text-primary)';

  return (
    <div className={`relative ${className}`} style={{ width: size, height: size }}>
      {/* Main face container */}
      <motion.div
        className="w-full h-full rounded-full flex items-center justify-center overflow-hidden"
        style={{
          background: `linear-gradient(135deg, ${primaryColor}, var(--secondary))`,
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)'
        }}
        initial={animated ? { scale: 0.95 } : {}}
        animate={animated ? {
          scale: [0.95, 1, 0.95],
        } : {}}
        transition={{
          duration: 3,
          repeat: Infinity,
          ease: "easeInOut"
        }}
      >
        {/* Robot face elements */}
        <svg
          width={size * 0.8}
          height={size * 0.8}
          viewBox="0 0 100 100"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Face plate */}
          <rect x="20" y="20" width="60" height="60" rx="10" fill="white" opacity="0.9" />

          {/* Left eye */}
          <motion.rect
            x="30"
            y="35"
            width="15"
            height={muted ? "5" : "10"}
            rx="2"
            fill={bgColor}
            animate={animated && !muted ? {
              height: ["10", "2", "10"],
              y: ["35", "39", "35"]
            } : {}}
            transition={{
              duration: 2.5,
              repeat: Infinity,
              repeatDelay: 5,
              ease: "easeInOut"
            }}
          />

          {/* Right eye */}
          <motion.rect
            x="55"
            y="35"
            width="15"
            height={muted ? "5" : "10"}
            rx="2"
            fill={bgColor}
            animate={animated && !muted ? {
              height: ["10", "2", "10"],
              y: ["35", "39", "35"]
            } : {}}
            transition={{
              duration: 2.5,
              repeat: Infinity,
              repeatDelay: 5,
              ease: "easeInOut",
              delay: 0.1
            }}
          />

          {/* Mouth/speaker */}
          <motion.rect
            x="35"
            y="60"
            width="30"
            height="5"
            rx="2"
            fill={bgColor}
            animate={animated && !muted ? {
              width: ["30", "20", "30"],
              x: ["35", "40", "35"]
            } : {}}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              repeatDelay: 2,
              ease: "easeInOut"
            }}
          />

          {/* Antenna */}
          <motion.path
            d="M50 10 L50 20"
            stroke={bgColor}
            strokeWidth="3"
            strokeLinecap="round"
            animate={animated ? {
              rotate: [-5, 5, -5],
            } : {}}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut"
            }}
            transformOrigin="50% 20"
          />
          <circle cx="50" cy="10" r="3" fill={bgColor} />

          {/* Muted indicator */}
          {muted && (
            <g>
              <circle cx="75" cy="25" r="10" fill="var(--danger)" />
              <path d="M70 25 L80 25" stroke="white" strokeWidth="2" strokeLinecap="round" />
            </g>
          )}
        </svg>
      </motion.div>
    </div>
  );
}
