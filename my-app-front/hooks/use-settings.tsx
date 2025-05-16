"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

interface Settings {
  volume: number;
  autoSpeak: boolean;
  teachingMode: 'teacher' | 'qa'; // 'teacher' for structured teaching, 'qa' for direct Q&A
  ttsVerbalsOnly: boolean; // When true, TTS will only read verbal explanations
  showExplanations: boolean; // When true, show verbal explanations alongside board content
  // Add more settings as needed
}

interface SettingsContextType {
  settings: Settings;
  updateSettings: (newSettings: Partial<Settings>) => void;
  resetSettings: () => void;
}

const defaultSettings: Settings = {
  volume: 0.5, // Default volume is 50%
  autoSpeak: true, // Auto-speak AI responses by default
  teachingMode: 'teacher', // Default to structured teaching mode
  ttsVerbalsOnly: false, // Default to reading all content
  showExplanations: false, // Hide explanations by default
};

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<Settings>(defaultSettings);

  // Load settings from localStorage on mount
  useEffect(() => {
    const storedSettings = localStorage.getItem("app-settings");
    if (storedSettings) {
      try {
        const parsedSettings = JSON.parse(storedSettings);
        setSettings({ ...defaultSettings, ...parsedSettings });
      } catch (error) {
        console.error("Failed to parse stored settings:", error);
        setSettings(defaultSettings);
      }
    }
  }, []);

  // Update settings and save to localStorage
  const updateSettings = (newSettings: Partial<Settings>) => {
    setSettings((prevSettings) => {
      const updatedSettings = { ...prevSettings, ...newSettings };
      localStorage.setItem("app-settings", JSON.stringify(updatedSettings));
      return updatedSettings;
    });
  };

  // Reset settings to defaults
  const resetSettings = () => {
    setSettings(defaultSettings);
    localStorage.setItem("app-settings", JSON.stringify(defaultSettings));
  };

  return (
    <SettingsContext.Provider
      value={{
        settings,
        updateSettings,
        resetSettings,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error("useSettings must be used within a SettingsProvider");
  }
  return context;
}
