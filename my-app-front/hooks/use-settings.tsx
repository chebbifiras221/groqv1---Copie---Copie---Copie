"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

/**
 * App settings interface
 */
interface Settings {
  volume: number;                    // Audio volume (0.0 to 1.0)
  autoSpeak: boolean;               // Auto-speak AI responses
  teachingMode: 'teacher' | 'qa';   // Teaching style
  ttsVerbalsOnly: boolean;          // TTS reads only verbal content
  ttsSkipExplanations: boolean;     // TTS skips explanations
  sidebarVisible: boolean;          // Show conversation sidebar
}

/**
 * Settings context interface
 */
interface SettingsContextType {
  settings: Settings;                                    // Current settings
  updateSettings: (newSettings: Partial<Settings>) => void; // Update function
  resetSettings: () => void;                            // Reset to defaults
  toggleSidebar: () => void;                           // Toggle sidebar
}

/**
 * Default settings values
 */
const defaultSettings: Settings = {
  volume: 0.5,              // 50% volume
  autoSpeak: true,          // Auto-speak enabled
  teachingMode: 'teacher',  // Structured teaching mode
  ttsVerbalsOnly: false,    // Read all content
  ttsSkipExplanations: false, // Read explanations
  sidebarVisible: true,     // Show sidebar
};

// React context for settings state
const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

/**
 * Settings Provider component that manages application settings state and persistence.
 * Provides settings context to all child components with localStorage synchronization.
 *
 * Features:
 * - Persistent settings storage using localStorage
 * - Graceful error handling for corrupted settings data
 * - Partial settings updates while preserving other values
 * - Settings reset functionality
 * - Convenience functions for common operations
 *
 * @param {Object} props - Component props
 * @param {React.ReactNode} props.children - Child components that will have access to settings context
 * @returns {JSX.Element} Provider component wrapping children with settings context
 */
export function SettingsProvider({ children }: { children: React.ReactNode }) {
  // Settings state initialized with default values
  const [settings, setSettings] = useState<Settings>(defaultSettings);

  /**
   * Effect hook that runs on component mount to load saved settings from localStorage.
   * Handles JSON parsing errors gracefully by falling back to default settings.
   */
  useEffect(() => {
    // Retrieve stored settings from browser localStorage
    const storedSettings = localStorage.getItem("app-settings");

    if (storedSettings) {
      try {
        // Parse JSON settings data
        const parsedSettings = JSON.parse(storedSettings);

        // Merge with defaults to ensure all required properties exist
        setSettings({ ...defaultSettings, ...parsedSettings });
      } catch (error) {
        // Handle corrupted or invalid JSON data
        console.error("Failed to parse stored settings:", error);
        setSettings(defaultSettings); // Fall back to defaults
      }
    }
  }, []); // Empty dependency array - run only once on mount

  /**
   * Updates specific settings while preserving existing values.
   * Automatically saves updated settings to localStorage for persistence.
   *
   * @param {Partial<Settings>} newSettings - Object containing settings to update
   */
  const updateSettings = (newSettings: Partial<Settings>) => {
    setSettings((prevSettings) => {
      // Merge new settings with existing settings
      const updatedSettings = { ...prevSettings, ...newSettings };

      // Persist updated settings to localStorage
      localStorage.setItem("app-settings", JSON.stringify(updatedSettings));

      // Return updated settings for state update
      return updatedSettings;
    });
  };

  /**
   * Resets all settings to their default values.
   * Clears any customizations and restores original configuration.
   */
  const resetSettings = () => {
    setSettings(defaultSettings); // Reset state to defaults
    localStorage.setItem("app-settings", JSON.stringify(defaultSettings)); // Persist reset
  };

  /**
   * Convenience function to toggle sidebar visibility.
   * Uses updateSettings to ensure proper persistence and state management.
   */
  const toggleSidebar = () => {
    updateSettings({ sidebarVisible: !settings.sidebarVisible }); // Toggle current state
  };

  // Return the SettingsContext.Provider with all settings state and functions
  return (
    <SettingsContext.Provider
      value={{
        settings, // Current settings object with all user preferences
        updateSettings, // Function to update specific settings
        resetSettings, // Function to reset all settings to defaults
        toggleSidebar, // Convenience function to toggle sidebar visibility
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

/**
 * Custom hook to access settings context from any component.
 * Must be used within a SettingsProvider component tree.
 *
 * @returns {SettingsContextType} Settings context containing current settings and management functions
 * @throws {Error} Throws error if used outside of SettingsProvider
 *
 * Usage:
 * const { settings, updateSettings, resetSettings, toggleSidebar } = useSettings();
 */
export function useSettings() {
  // Get the settings context from React context
  const context = useContext(SettingsContext);

  // Ensure hook is used within SettingsProvider
  if (context === undefined) {
    throw new Error("useSettings must be used within a SettingsProvider");
  }

  // Return the settings context
  return context;
}
