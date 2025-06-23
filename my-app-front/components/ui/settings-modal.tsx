"use client";

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Settings, Volume2, RefreshCw, Mic } from 'lucide-react';
import { Modal } from './modal';
import { Button } from './button';
import { useSettings } from '@/hooks/use-settings';
import { DeviceSelector } from '@/components/device-selector';

// Default settings for reference
const defaultSettings = {
  volume: 0.5, // 50%
  autoSpeak: true, // Auto-speak AI responses by default
  teachingMode: 'teacher', // Default to structured teaching mode
  ttsVerbalsOnly: false, // Default to reading all content
  ttsSkipExplanations: false, // Default to reading explanations
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
      // Accessing voices to ensure they're loaded for future utterances
      window.speechSynthesis.getVoices();
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

          {/* Auto-Speak Toggle */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-text-primary">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-message-square-text">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                  <path d="M13 8H7"/>
                  <path d="M17 12H7"/>
                </svg>
                <span>Auto-Speak Responses</span>
              </label>
              <div className="relative inline-block w-10 align-middle select-none">
                <input
                  type="checkbox"
                  id="auto-speak"
                  name="auto-speak"
                  className="sr-only"
                  checked={settings.autoSpeak}
                  onChange={() => updateSettings({ autoSpeak: !settings.autoSpeak })}
                />
                <label
                  htmlFor="auto-speak"
                  className={`block overflow-hidden h-6 rounded-full cursor-pointer transition-colors duration-200 ease-in-out ${settings.autoSpeak ? 'bg-primary-DEFAULT' : 'bg-bg-tertiary'}`}
                >
                  <span
                    className={`block h-4 w-4 rounded-full bg-white transform transition-transform duration-200 ease-in-out ${settings.autoSpeak ? 'translate-x-5' : 'translate-x-1'} mt-1`}
                  ></span>
                </label>
              </div>
            </div>
            <p className="text-text-tertiary text-xs mt-1">
              When enabled, AI responses will be automatically read aloud
            </p>
          </div>

          {/* TTS Verbals Only Toggle */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-text-primary">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
                  <path d="m19 10-1.5-1.5M5 10l1.5-1.5"></path>
                  <path d="M12 16v5"></path>
                  <path d="M8 21h8"></path>
                </svg>
                <span>TTS Verbal Focus</span>
              </label>
              <div className="relative inline-block w-10 align-middle select-none">
                <input
                  type="checkbox"
                  id="tts-verbals-only"
                  name="tts-verbals-only"
                  className="sr-only"
                  checked={settings.ttsVerbalsOnly}
                  onChange={() => updateSettings({ ttsVerbalsOnly: !settings.ttsVerbalsOnly })}
                />
                <label
                  htmlFor="tts-verbals-only"
                  className={`block overflow-hidden h-6 rounded-full cursor-pointer transition-colors duration-200 ease-in-out ${settings.ttsVerbalsOnly ? 'bg-primary-DEFAULT' : 'bg-bg-tertiary'}`}
                >
                  <span
                    className={`block h-4 w-4 rounded-full bg-white transform transition-transform duration-200 ease-in-out ${settings.ttsVerbalsOnly ? 'translate-x-5' : 'translate-x-1'} mt-1`}
                  ></span>
                </label>
              </div>
            </div>
            <p className="text-text-tertiary text-xs mt-1">
              When enabled, TTS will only read verbal explanations (content in [EXPLAIN] blocks)
            </p>
          </div>

          {/* TTS Skip Explanations Toggle */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-text-primary">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                  <circle cx="12" cy="12" r="3"></circle>
                  <path d="M12 1v6m0 10v6"></path>
                </svg>
                <span>TTS Skip Explanations</span>
              </label>
              <div className="relative inline-block w-10 align-middle select-none">
                <input
                  type="checkbox"
                  id="tts-skip-explanations"
                  name="tts-skip-explanations"
                  className="sr-only"
                  checked={settings.ttsSkipExplanations}
                  onChange={() => updateSettings({ ttsSkipExplanations: !settings.ttsSkipExplanations })}
                />
                <label
                  htmlFor="tts-skip-explanations"
                  className={`block overflow-hidden h-6 rounded-full cursor-pointer transition-colors duration-200 ease-in-out ${settings.ttsSkipExplanations ? 'bg-primary-DEFAULT' : 'bg-bg-tertiary'}`}
                >
                  <span
                    className={`block h-4 w-4 rounded-full bg-white transform transition-transform duration-200 ease-in-out ${settings.ttsSkipExplanations ? 'translate-x-5' : 'translate-x-1'} mt-1`}
                  ></span>
                </label>
              </div>
            </div>
            <p className="text-text-tertiary text-xs mt-1">
              When enabled, TTS will skip reading explanation content (content in [EXPLAIN] blocks)
            </p>
          </div>

          {/* Microphone Device Selector */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-text-primary">
                <Mic size={18} />
                <span>Microphone Device</span>
              </label>
            </div>
            <div className="flex items-center justify-between p-2 bg-bg-tertiary/30 rounded-md">
              <div className="flex-1 text-sm text-text-secondary">
                Select your microphone
              </div>
              <div className="relative z-10">
                <DeviceSelector kind="audioinput" />
              </div>
            </div>
            <p className="text-text-tertiary text-xs mt-1">
              Choose which microphone to use for voice input
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
