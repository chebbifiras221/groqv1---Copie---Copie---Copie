"use client";

import React from 'react';
import { motion } from 'framer-motion';

interface SimpleBotFaceProps {
  className?: string;
  size?: number;
  animated?: boolean;
  customImageUrl?: string; // URL to a custom bot image
}

export function SimpleBotFace({ className = '', size = 48, animated = true, customImageUrl }: SimpleBotFaceProps) {
  // ===================================================================
  // REPLACE THIS URL WITH YOUR OWN IMAGE URL TO USE A CUSTOM BOT ICON
  // Example: const DEFAULT_BOT_IMAGE = "/images/my-custom-bot.png";
  // Or use an external URL: const DEFAULT_BOT_IMAGE = "https://i.imgur.com/YOURIMAGE.png";
  // ===================================================================
  // Using the image from the provided Imgur album
  // Direct image URL extracted from the album
  const DEFAULT_BOT_IMAGE = "https://i.imgur.com/WtB3SLq.png"; // Custom bot icon from user

  // Use custom image URL from props or the default
  const imageUrl = customImageUrl || DEFAULT_BOT_IMAGE;

  // If we have a valid image URL, render the image instead of the default bot face
  if (imageUrl) {
    return (
      <div className={`relative ${className}`} style={{ width: size, height: size }}>
        <motion.div
          className="w-full h-full rounded-full overflow-hidden flex items-center justify-center"
          style={{
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
            willChange: 'transform'
          }}
          animate={animated ? {
            scale: [1, 1.03, 1],
          } : {}}
          transition={{
            duration: 2,
            ease: "easeInOut",
            repeat: Infinity,
            repeatType: "reverse"
          }}
        >
          {/* Using regular img tag as fallback in case Next.js Image has configuration issues */}
          <img
            src={imageUrl}
            alt="Bot Icon"
            width={size}
            height={size}
            className="object-cover w-full h-full"
            style={{ width: '100%', height: '100%' }}
          />
        </motion.div>
      </div>
    );
  }
  return (
    <div className={`relative ${className}`} style={{ width: size, height: size }}>
      {/* Main face container - blue circle */}
      <motion.div
        className="w-full h-full rounded-full flex items-center justify-center"
        style={{
          backgroundColor: '#4169E1',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
          willChange: 'transform'
        }}
        animate={animated ? {
          scale: [1, 1.03, 1],
        } : {}}
        transition={{
          duration: 2,
          ease: "easeInOut",
          repeat: Infinity,
          repeatType: "reverse"
        }}
      >
        {/* Bot face - white rectangle with antenna */}
        <div
          className="relative"
          style={{
            width: size * 0.5,
            height: size * 0.6,
            backgroundColor: 'white',
            borderRadius: size * 0.05
          }}
        >
          {/* Antenna */}
          <div
            className="absolute left-1/2 -top-1/3"
            style={{
              width: size * 0.05,
              height: size * 0.15,
              backgroundColor: 'white',
              borderRadius: size * 0.025,
              marginLeft: -size * 0.025
            }}
          />

          {/* Happy eyes with curved bottom for a smiling look */}
          <div className="absolute" style={{ top: size * 0.15, left: size * 0.1 }}>
            <div
              style={{
                width: size * 0.1,
                height: size * 0.1,
                backgroundColor: '#4169E1',
                borderRadius: '50%',
                position: 'relative',
                overflow: 'hidden'
              }}
            >
              {/* White reflection in eye */}
              <div
                style={{
                  width: size * 0.04,
                  height: size * 0.04,
                  backgroundColor: 'white',
                  borderRadius: '50%',
                  position: 'absolute',
                  top: size * 0.02,
                  left: size * 0.02,
                  opacity: 0.7
                }}
              />
            </div>
          </div>
          <div className="absolute" style={{ top: size * 0.15, right: size * 0.1 }}>
            <div
              style={{
                width: size * 0.1,
                height: size * 0.1,
                backgroundColor: '#4169E1',
                borderRadius: '50%',
                position: 'relative',
                overflow: 'hidden'
              }}
            >
              {/* White reflection in eye */}
              <div
                style={{
                  width: size * 0.04,
                  height: size * 0.04,
                  backgroundColor: 'white',
                  borderRadius: '50%',
                  position: 'absolute',
                  top: size * 0.02,
                  left: size * 0.02,
                  opacity: 0.7
                }}
              />
            </div>
          </div>

          {/* Happy Smiling Mouth - wider and more curved */}
          <div
            className="absolute"
            style={{
              width: size * 0.35,
              height: size * 0.2,
              backgroundColor: '#4169E1',
              borderRadius: '50%',
              bottom: size * 0.08,
              left: '50%',
              transform: 'translateX(-50%)',
              clipPath: `polygon(0% 0%, 100% 0%, 100% 50%, 0% 50%)`
            }}
          />

          {/* Rosy cheeks for extra happiness */}
          <div
            className="absolute"
            style={{
              width: size * 0.08,
              height: size * 0.08,
              backgroundColor: '#FF9999',
              borderRadius: '50%',
              opacity: 0.6,
              top: size * 0.25,
              left: size * 0.05
            }}
          />
          <div
            className="absolute"
            style={{
              width: size * 0.08,
              height: size * 0.08,
              backgroundColor: '#FF9999',
              borderRadius: '50%',
              opacity: 0.6,
              top: size * 0.25,
              right: size * 0.05
            }}
          />
        </div>
      </motion.div>
    </div>
  );
}
