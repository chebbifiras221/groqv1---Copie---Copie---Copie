"use client";

import React from 'react';

interface LoadingSVGProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
}

export function LoadingSVG({ 
  size = 16, 
  color = 'currentColor', 
  strokeWidth = 2 
}: LoadingSVGProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="animate-spin"
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}
