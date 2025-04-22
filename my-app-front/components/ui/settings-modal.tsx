"use client";

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Settings, Volume2, RefreshCw } from 'lucide-react';
import { Modal } from './modal';
import { Button } from './button';
import { useSettings } from '@/hooks/use-settings';

// Default settings for reference
const defaultSettings = {
  volume: 0.5, // 50%
};

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { settings, updateSettings, resetSettings } = useSettings();
  const [volume, setVolume] = useState(settings.volume * 100); // Convert to percentage for UI

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseInt(e.target.value) / 100; // Convert back to 0-1 range
    setVolume(parseInt(e.target.value));
    updateSettings({ volume: newVolume });

    // Apply volume change to any active speech synthesis
    if (window.speechSynthesis) {
      // This will affect any future utterances
      window.speechSynthesis.getVoices().forEach(voice => {
        // Just accessing the voices to ensure they're loaded
      });
    }
  };

  const handleReset = () => {
    if (confirm('Are you sure you want to reset all settings to defaults?')) {
      resetSettings();
      setVolume(defaultSettings.volume * 100);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Settings"
      maxWidth="max-w-md"
    >
      <div className="p-6 bg-bg-primary">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Settings className="text-primary-DEFAULT" size={20} />
            <h3 className="text-lg font-medium text-text-primary">Application Settings</h3>
          </div>
        </div>

        <div className="space-y-6">
          {/* Volume Control */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-text-primary">
                <Volume2 size={18} />
                <span>TTS Volume</span>
              </label>
              <span className="text-text-secondary text-sm">{volume}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={volume}
              onChange={handleVolumeChange}
              className="w-full h-2 bg-bg-tertiary rounded-lg appearance-none cursor-pointer accent-primary-DEFAULT"
            />
            <p className="text-text-tertiary text-xs mt-1">
              Controls the volume of the text-to-speech output
            </p>
          </div>

          <div className="border-t border-border-DEFAULT my-4"></div>

          {/* Reset Button */}
          <div className="flex justify-end">
            <Button
              variant="outline"
              onClick={handleReset}
              className="flex items-center gap-2"
            >
              <RefreshCw size={16} />
              <span>Reset to Defaults</span>
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
