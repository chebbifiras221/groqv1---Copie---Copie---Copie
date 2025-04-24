"use client";

import React, { useState, useEffect, useRef } from 'react';

interface SliderProps {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  className?: string;
}

export function Slider({ value, min, max, step = 0.1, onChange, className = '' }: SliderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const sliderRef = useRef<HTMLDivElement>(null);
  
  // Calculate the percentage for the thumb position
  const percentage = ((value - min) / (max - min)) * 100;
  
  // Handle mouse/touch down on the slider
  const handleMouseDown = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    setIsDragging(true);
    
    // Get the initial position
    if (sliderRef.current) {
      const rect = sliderRef.current.getBoundingClientRect();
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      updateValue(clientX, rect);
    }
  };
  
  // Update the value based on mouse/touch position
  const updateValue = (clientX: number, rect: DOMRect) => {
    const position = (clientX - rect.left) / rect.width;
    const newValue = min + position * (max - min);
    
    // Clamp the value between min and max, and apply step
    const steppedValue = Math.round(Math.max(min, Math.min(max, newValue)) / step) * step;
    
    // Ensure the value is within the valid range after stepping
    const clampedValue = Math.max(min, Math.min(max, steppedValue));
    
    onChange(clampedValue);
  };
  
  // Handle mouse/touch move
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent | TouchEvent) => {
      if (!isDragging || !sliderRef.current) return;
      
      const rect = sliderRef.current.getBoundingClientRect();
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      updateValue(clientX, rect);
    };
    
    // Handle mouse/touch up
    const handleMouseUp = () => {
      setIsDragging(false);
    };
    
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('touchmove', handleMouseMove as any);
      document.addEventListener('mouseup', handleMouseUp);
      document.addEventListener('touchend', handleMouseUp);
    }
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('touchmove', handleMouseMove as any);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('touchend', handleMouseUp);
    };
  }, [isDragging, min, max, step, onChange]);
  
  return (
    <div 
      ref={sliderRef}
      className={`relative h-2 bg-bg-tertiary rounded-full cursor-pointer ${className}`}
      onMouseDown={handleMouseDown}
      onTouchStart={handleMouseDown}
      role="slider"
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      tabIndex={0}
      onKeyDown={(e) => {
        // Handle keyboard navigation
        if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
          e.preventDefault();
          const newValue = Math.min(max, value + step);
          onChange(newValue);
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
          e.preventDefault();
          const newValue = Math.max(min, value - step);
          onChange(newValue);
        } else if (e.key === 'Home') {
          e.preventDefault();
          onChange(min);
        } else if (e.key === 'End') {
          e.preventDefault();
          onChange(max);
        }
      }}
    >
      {/* Track fill */}
      <div 
        className="absolute h-full bg-primary-DEFAULT rounded-full"
        style={{ width: `${percentage}%` }}
      />
      
      {/* Thumb */}
      <div 
        className={`absolute w-4 h-4 bg-white rounded-full shadow-md transform -translate-y-1/2 -translate-x-1/2 top-1/2 ${
          isDragging ? 'scale-110' : ''
        }`}
        style={{ left: `${percentage}%` }}
      />
    </div>
  );
}
