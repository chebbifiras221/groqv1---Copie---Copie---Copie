"use client";

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Settings, X, Volume2, VolumeX } from 'lucide-react';
import { useSettings } from '@/hooks/use-settings';
import { Button } from './button';
import { Slider } from './slider';

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsPanel({ isOpen, onClose }: SettingsPanelProps) {
  const { settings, updateSettings, resetSettings } = useSettings();
  
  const handleVolumeChange = (value: number) => {
    updateSettings({ volume: value });
  };
  
  const toggleAutoSpeak = () => {
    updateSettings({ autoSpeak: !settings.autoSpeak });
  };
  
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 bg-black/50 z-40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          
          {/* Panel */}
          <motion.div
            className="fixed right-0 top-0 h-full w-80 max-w-full bg-bg-secondary z-50 shadow-xl border-l border-bg-tertiary/30"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          >
            <div className="flex flex-col h-full">
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-bg-tertiary/30">
                <div className="flex items-center gap-2">
                  <Settings className="w-5 h-5 text-primary-DEFAULT" />
                  <h2 className="font-medium text-text-primary">Settings</h2>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onClose}
                  className="text-text-secondary hover:text-text-primary"
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>
              
              {/* Content */}
              <div className="flex-1 overflow-y-auto p-4">
                <div className="space-y-6">
                  {/* Volume Control */}
                  <div className="space-y-2">
                    <h3 className="text-sm font-medium text-text-primary">Voice Volume</h3>
                    <div className="flex items-center gap-3">
                      <VolumeX className="w-4 h-4 text-text-secondary" />
                      <Slider
                        value={settings.volume}
                        min={0}
                        max={1}
                        step={0.05}
                        onChange={handleVolumeChange}
                        className="flex-1"
                      />
                      <Volume2 className="w-4 h-4 text-text-secondary" />
                    </div>
                    <p className="text-xs text-text-tertiary">
                      Current: {Math.round(settings.volume * 100)}%
                    </p>
                  </div>
                  
                  {/* Auto-Speak Toggle */}
                  <div className="space-y-2">
                    <h3 className="text-sm font-medium text-text-primary">Auto-Speak Responses</h3>
                    <div className="flex items-center">
                      <label className="flex items-center cursor-pointer">
                        <div className="relative">
                          <input
                            type="checkbox"
                            className="sr-only"
                            checked={settings.autoSpeak}
                            onChange={toggleAutoSpeak}
                          />
                          <div className={`block w-10 h-6 rounded-full transition-colors ${
                            settings.autoSpeak ? 'bg-primary-DEFAULT' : 'bg-bg-tertiary'
                          }`} />
                          <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${
                            settings.autoSpeak ? 'transform translate-x-4' : ''
                          }`} />
                        </div>
                        <div className="ml-3 text-sm text-text-secondary">
                          {settings.autoSpeak ? 'Enabled' : 'Disabled'}
                        </div>
                      </label>
                    </div>
                    <p className="text-xs text-text-tertiary">
                      When enabled, AI responses will be automatically read aloud
                    </p>
                  </div>
                </div>
              </div>
              
              {/* Footer */}
              <div className="p-4 border-t border-bg-tertiary/30">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={resetSettings}
                  className="w-full"
                >
                  Reset to Defaults
                </Button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
