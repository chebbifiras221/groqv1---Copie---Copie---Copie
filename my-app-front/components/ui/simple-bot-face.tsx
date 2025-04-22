"use client";

import React from 'react';
import { motion } from 'framer-motion';

interface SimpleBotFaceProps {
  className?: string;
  size?: number;
  animated?: boolean;
}

export function SimpleBotFace({ className = '', size = 48, animated = true }: SimpleBotFaceProps) {
  return (
    <div className={`relative ${className}`} style={{ width: size, height: size }}>
      {/* Main face container - blue circle */}
      <motion.div
        className="w-full h-full rounded-full flex items-center justify-center"
        style={{
          backgroundColor: '#4169E1',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
        }}
        initial={animated ? { scale: 0.95 } : {}}
        animate={animated ? {
          scale: [0.95, 1, 0.95],
        } : {}}
        transition={{
          duration: 4,
          repeat: Infinity,
          ease: "easeInOut"
        }}
      >
        {/* Bot face - white rectangle with antenna */}
        <motion.div
          className="relative"
          style={{
            width: size * 0.5,
            height: size * 0.6,
            backgroundColor: 'white',
            borderRadius: size * 0.05
          }}
        >
          {/* Antenna */}
          <motion.div
            className="absolute left-1/2 -top-1/3"
            style={{
              width: size * 0.05,
              height: size * 0.15,
              backgroundColor: 'white',
              borderRadius: size * 0.025,
              marginLeft: -size * 0.025
            }}
            animate={animated ? {
              rotate: [-5, 5, -5],
            } : {}}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut"
            }}
            transformOrigin="bottom"
          />

          {/* Eyes - appear when animated */}
          {animated && (
            <>
              <motion.div
                className="absolute"
                style={{
                  width: size * 0.1,
                  height: size * 0.1,
                  backgroundColor: '#4169E1',
                  borderRadius: '50%',
                  top: size * 0.15,
                  left: size * 0.1
                }}
                animate={{
                  scale: [1, 1.2, 1],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut",
                  repeatDelay: 3
                }}
              />
              <motion.div
                className="absolute"
                style={{
                  width: size * 0.1,
                  height: size * 0.1,
                  backgroundColor: '#4169E1',
                  borderRadius: '50%',
                  top: size * 0.15,
                  right: size * 0.1
                }}
                animate={{
                  scale: [1, 1.2, 1],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut",
                  repeatDelay: 3,
                  delay: 0.1
                }}
              />

              {/* Smiling Mouth */}
              <motion.div
                className="absolute"
                style={{
                  width: size * 0.3,
                  height: size * 0.15,
                  backgroundColor: '#4169E1',
                  borderRadius: '50%',
                  bottom: size * 0.1,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  clipPath: `polygon(0% 0%, 100% 0%, 100% 50%, 0% 50%)`
                }}
                animate={{
                  height: [size * 0.15, size * 0.12, size * 0.15],
                }}
                transition={{
                  duration: 3,
                  repeat: Infinity,
                  ease: "easeInOut",
                  repeatDelay: 2
                }}
              />
            </>
          )}
        </motion.div>
      </motion.div>
    </div>
  );
}
