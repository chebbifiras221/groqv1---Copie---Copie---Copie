"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

type Theme = "light" | "dark";

type ThemeContextType = {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>("dark");
  const [mounted, setMounted] = useState(false);

  // Initialize theme from localStorage on mount
  useEffect(() => {
    setMounted(true);
    try {
      const storedTheme = localStorage.getItem("theme") as Theme | null;
      if (storedTheme) {
        setTheme(storedTheme);
        applyTheme(storedTheme);
      } else {
        // Default to dark theme if no preference is stored
        setTheme("dark");
        applyTheme("dark");
      }
    } catch (e) {
      // If localStorage is not available, default to dark theme
      setTheme("dark");
      applyTheme("dark");
    }
  }, []);

  const applyTheme = (newTheme: Theme) => {
    if (typeof document === 'undefined') return;

    const html = document.documentElement;

    if (newTheme === "dark") {
      // Apply dark theme
      html.classList.remove("light-theme");
      html.classList.add("dark");
      document.body.style.backgroundColor = "#0d1117";
      document.body.style.color = "#e6edf3";
      document.documentElement.style.setProperty('--shadow-color', 'rgba(0, 0, 0, 0.3)');
      document.documentElement.style.setProperty('--shadow-sm', '0 1px 2px rgba(0, 0, 0, 0.05)');
      document.documentElement.style.setProperty('--shadow-md', '0 4px 6px rgba(0, 0, 0, 0.1)');
      document.documentElement.style.setProperty('--shadow-lg', '0 10px 15px rgba(0, 0, 0, 0.1)');
    } else {
      // Apply light theme
      html.classList.add("light-theme");
      html.classList.remove("dark");
      document.body.style.backgroundColor = "#ffffff";
      document.body.style.color = "#24292f";
      document.documentElement.style.setProperty('--shadow-color', 'rgba(0, 0, 0, 0.05)');
      document.documentElement.style.setProperty('--shadow-sm', '0 1px 2px rgba(0, 0, 0, 0.02)');
      document.documentElement.style.setProperty('--shadow-md', '0 2px 4px rgba(0, 0, 0, 0.03)');
      document.documentElement.style.setProperty('--shadow-lg', '0 4px 8px rgba(0, 0, 0, 0.04)');
    }

    // Store the theme preference
    try {
      localStorage.setItem("theme", newTheme);
    } catch (e) {
      console.error('Error storing theme preference:', e);
    }
  };

  const toggleTheme = () => {
    const newTheme = theme === "dark" ? "light" : "dark";
    setTheme(newTheme);
    applyTheme(newTheme);
  };

  const updateTheme = (newTheme: Theme) => {
    setTheme(newTheme);
    applyTheme(newTheme);
  };

  // Apply theme class on initial render
  useEffect(() => {
    if (mounted) {
      applyTheme(theme);
    }
  }, [mounted, theme]);

  return (
    <ThemeContext.Provider
      value={{
        theme,
        toggleTheme,
        setTheme: updateTheme,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
