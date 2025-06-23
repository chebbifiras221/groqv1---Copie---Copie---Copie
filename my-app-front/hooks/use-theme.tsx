"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

/**
 * Theme type definition for application color schemes.
 * Supports light and dark themes with comprehensive styling.
 */
type Theme = "light" | "dark";

/**
 * Theme context type definition providing theme state and management functions.
 *
 * @interface ThemeContextType
 * @property {Theme} theme - Current active theme ('light' or 'dark')
 * @property {Function} toggleTheme - Function to switch between light and dark themes
 * @property {Function} setTheme - Function to set a specific theme directly
 */
type ThemeContextType = {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
};

// Create React context for theme state management across the application
const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

/**
 * Theme Provider component that manages application theme state and DOM manipulation.
 * Provides theme context to all child components with localStorage persistence and SSR safety.
 *
 * Features:
 * - Persistent theme storage using localStorage
 * - SSR-safe theme initialization to prevent hydration mismatches
 * - Comprehensive CSS custom property management
 * - Graceful fallback for environments without localStorage
 * - Automatic DOM class and style application
 *
 * @param {Object} props - Component props
 * @param {React.ReactNode} props.children - Child components that will have access to theme context
 * @returns {JSX.Element} Provider component wrapping children with theme context
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Theme state initialized with dark theme as default
  const [theme, setTheme] = useState<Theme>("dark");

  // Mounted state to prevent SSR hydration mismatches
  const [mounted, setMounted] = useState(false);

  /**
   * Effect hook that runs on component mount to initialize theme from localStorage.
   * Handles SSR safety and localStorage availability gracefully.
   */
  useEffect(() => {
    // Set mounted flag to enable theme application
    setMounted(true);

    try {
      // Retrieve stored theme preference from localStorage
      const storedTheme = localStorage.getItem("theme") as Theme | null;

      if (storedTheme) {
        // Apply stored theme preference
        setTheme(storedTheme);
        applyTheme(storedTheme);
      } else {
        // Default to dark theme if no preference is stored
        setTheme("dark");
        applyTheme("dark");
      }
    } catch (e) {
      // If localStorage is not available (e.g., private browsing), default to dark theme
      setTheme("dark");
      applyTheme("dark");
    }
  }, []); // Empty dependency array - run only once on mount

  /**
   * Applies theme changes to the DOM by manipulating CSS classes and custom properties.
   * Handles both dark and light theme configurations with comprehensive styling.
   *
   * @param {Theme} newTheme - The theme to apply ('light' or 'dark')
   */
  const applyTheme = (newTheme: Theme) => {
    // Only proceed if running in browser environment
    if (typeof document === 'undefined') return;

    // Get reference to HTML document element for class manipulation
    const html = document.documentElement;

    if (newTheme === "dark") {
      // Apply dark theme configuration
      html.classList.remove("light-theme"); // Remove light theme class
      html.classList.add("dark"); // Add dark theme class

      // Set dark theme body styles
      document.body.style.backgroundColor = "#0d1117"; // GitHub dark background
      document.body.style.color = "#e6edf3"; // GitHub dark text color

      // Set dark theme shadow CSS custom properties
      document.documentElement.style.setProperty('--shadow-color', 'rgba(0, 0, 0, 0.3)');
      document.documentElement.style.setProperty('--shadow-sm', '0 1px 2px rgba(0, 0, 0, 0.05)');
      document.documentElement.style.setProperty('--shadow-md', '0 4px 6px rgba(0, 0, 0, 0.1)');
      document.documentElement.style.setProperty('--shadow-lg', '0 10px 15px rgba(0, 0, 0, 0.1)');
    } else {
      // Apply light theme configuration
      html.classList.add("light-theme"); // Add light theme class
      html.classList.remove("dark"); // Remove dark theme class

      // Set light theme body styles
      document.body.style.backgroundColor = "#ffffff"; // Pure white background
      document.body.style.color = "#24292f"; // GitHub light text color

      // Set light theme shadow CSS custom properties (more subtle)
      document.documentElement.style.setProperty('--shadow-color', 'rgba(0, 0, 0, 0.05)');
      document.documentElement.style.setProperty('--shadow-sm', '0 1px 2px rgba(0, 0, 0, 0.02)');
      document.documentElement.style.setProperty('--shadow-md', '0 2px 4px rgba(0, 0, 0, 0.03)');
      document.documentElement.style.setProperty('--shadow-lg', '0 4px 8px rgba(0, 0, 0, 0.04)');
    }

    // Persist the theme preference to localStorage
    try {
      localStorage.setItem("theme", newTheme);
    } catch (e) {
      // Handle localStorage errors gracefully (e.g., private browsing mode)
      console.error('Error storing theme preference:', e);
    }
  };

  /**
   * Toggles between light and dark themes.
   * Convenience function for switching themes without specifying the target theme.
   */
  const toggleTheme = () => {
    const newTheme = theme === "dark" ? "light" : "dark"; // Switch to opposite theme
    setTheme(newTheme); // Update state
    applyTheme(newTheme); // Apply DOM changes
  };

  /**
   * Sets a specific theme directly.
   * Used when you want to set a particular theme rather than toggle.
   *
   * @param {Theme} newTheme - The specific theme to apply
   */
  const updateTheme = (newTheme: Theme) => {
    setTheme(newTheme); // Update state
    applyTheme(newTheme); // Apply DOM changes
  };

  /**
   * Effect hook to apply theme changes when component mounts or theme changes.
   * Only applies theme after component is mounted to prevent SSR hydration issues.
   */
  useEffect(() => {
    // Only apply theme after component is mounted to prevent SSR mismatches
    if (mounted) {
      applyTheme(theme); // Apply current theme to DOM
    }
  }, [mounted, theme]); // Re-run when mounted state or theme changes

  // Return the ThemeContext.Provider with all theme state and functions
  return (
    <ThemeContext.Provider
      value={{
        theme, // Current active theme
        toggleTheme, // Function to toggle between themes
        setTheme: updateTheme, // Function to set specific theme
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

/**
 * Custom hook to access theme context from any component.
 * Must be used within a ThemeProvider component tree.
 *
 * @returns {ThemeContextType} Theme context containing current theme and management functions
 * @throws {Error} Throws error if used outside of ThemeProvider
 *
 * Usage:
 * const { theme, toggleTheme, setTheme } = useTheme();
 */
export function useTheme() {
  // Get the theme context from React context
  const context = useContext(ThemeContext);

  // Ensure hook is used within ThemeProvider
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }

  // Return the theme context
  return context;
}
