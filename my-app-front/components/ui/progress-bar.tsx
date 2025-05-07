"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";

interface ProgressBarProps {
  isLoading: boolean;
  duration?: number; // Duration in milliseconds
  className?: string;
}

export function ProgressBar({
  isLoading,
  duration = 2000,
  className = ""
}: ProgressBarProps) {
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isLoading) {
      setVisible(true);
      setProgress(0);

      // Animate progress from 0 to 90% over the specified duration
      // We leave the last 10% for when loading actually completes
      const interval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 90) {
            clearInterval(interval);
            return 90;
          }
          return prev + 1;
        });
      }, duration / 100);

      return () => clearInterval(interval);
    } else if (visible) {
      // When loading completes, quickly fill to 100% and then hide
      setProgress(100);
      const timeout = setTimeout(() => {
        setVisible(false);
      }, 300);

      return () => clearTimeout(timeout);
    }
  }, [isLoading, duration, visible]);

  if (!visible) return null;

  return (
    <div className={`w-full h-1.5 bg-bg-tertiary/30 overflow-hidden rounded-full ${className}`}>
      <motion.div
        className="h-full bg-primary-DEFAULT rounded-full"
        initial={{ width: 0 }}
        animate={{ width: `${progress}%` }}
        transition={{
          duration: progress === 100 ? 0.3 : 0.5,
          ease: progress === 100 ? "easeOut" : "linear"
        }}
      />
    </div>
  );
}
