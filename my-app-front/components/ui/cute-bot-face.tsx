"use client";

import React from 'react';
import { motion } from 'framer-motion';

interface CuteBotFaceProps {
  className?: string;
  size?: number;
  animated?: boolean;
}

export function CuteBotFace({ className = '', size = 48, animated = true }: CuteBotFaceProps) {
  return (
    <div className={`relative ${className}`} style={{ width: size, height: size }}>
      {/* Main face container */}
      <motion.div 
        className="w-full h-full rounded-full bg-gradient-to-br from-primary-DEFAULT to-secondary-DEFAULT flex items-center justify-center"
        initial={animated ? { scale: 0.9 } : {}}
        animate={animated ? { 
          scale: [0.9, 1, 0.9],
          rotate: [0, 2, 0, -2, 0]
        } : {}}
        transition={{ 
          duration: 4, 
          repeat: Infinity, 
          ease: "easeInOut" 
        }}
        style={{ 
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)' // Lighter shadow
        }}
      >
        {/* Eyes */}
        <div className="relative w-full h-full flex items-center justify-center">
          {/* Left eye */}
          <motion.div 
            className="absolute bg-white rounded-full"
            style={{ 
              width: size * 0.2, 
              height: size * 0.2, 
              top: size * 0.3, 
              left: size * 0.25 
            }}
            animate={animated ? { scale: [1, 1.1, 1] } : {}}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          >
            {/* Left pupil */}
            <motion.div 
              className="absolute bg-bg-primary rounded-full"
              style={{ 
                width: size * 0.1, 
                height: size * 0.1, 
                top: '50%', 
                left: '50%', 
                transform: 'translate(-50%, -50%)' 
              }}
              animate={animated ? { 
                x: [0, 1, 0, -1, 0], 
                y: [0, -1, 0, 1, 0] 
              } : {}}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            />
          </motion.div>
          
          {/* Right eye */}
          <motion.div 
            className="absolute bg-white rounded-full"
            style={{ 
              width: size * 0.2, 
              height: size * 0.2, 
              top: size * 0.3, 
              right: size * 0.25 
            }}
            animate={animated ? { scale: [1, 1.1, 1] } : {}}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          >
            {/* Right pupil */}
            <motion.div 
              className="absolute bg-bg-primary rounded-full"
              style={{ 
                width: size * 0.1, 
                height: size * 0.1, 
                top: '50%', 
                left: '50%', 
                transform: 'translate(-50%, -50%)' 
              }}
              animate={animated ? { 
                x: [0, 1, 0, -1, 0], 
                y: [0, -1, 0, 1, 0] 
              } : {}}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            />
          </motion.div>
          
          {/* Mouth */}
          <motion.div 
            className="absolute bg-white rounded-full"
            style={{ 
              width: size * 0.4, 
              height: size * 0.2, 
              bottom: size * 0.25,
              borderBottomLeftRadius: size * 0.2,
              borderBottomRightRadius: size * 0.2,
              borderTopLeftRadius: 0,
              borderTopRightRadius: 0
            }}
            animate={animated ? { 
              scaleX: [1, 1.1, 1],
              scaleY: [1, 0.9, 1]
            } : {}}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          />
          
          {/* Blinking animation */}
          {animated && (
            <motion.div 
              className="absolute bg-gradient-to-br from-primary-DEFAULT to-secondary-DEFAULT"
              style={{ 
                width: size * 0.9, 
                height: size * 0.9,
                borderRadius: '50%',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                zIndex: 10
              }}
              initial={{ scaleY: 0 }}
              animate={{ 
                scaleY: [0, 1, 0],
                transition: { 
                  duration: 0.3, 
                  repeat: Infinity, 
                  repeatDelay: 5,
                  ease: "easeInOut" 
                }
              }}
            />
          )}
        </div>
      </motion.div>
    </div>
  );
}
