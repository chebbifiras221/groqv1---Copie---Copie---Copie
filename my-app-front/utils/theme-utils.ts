import { useState, useEffect } from 'react';

/**
 * Hook to detect and track theme changes
 * @returns {boolean} Whether the current theme is dark
 */
const checkIsDarkTheme = (): boolean => {
  if (typeof document === 'undefined') return true;
  return !document.documentElement.classList.contains('light-theme');
};

export const useThemeDetector = (): boolean => {
  const [isDarkTheme, setIsDarkTheme] = useState(true);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Initial theme check
    setIsDarkTheme(checkIsDarkTheme());

    // Listen for theme changes
    const observer = new MutationObserver((mutations) => {
      const hasClassChange = mutations.some(mutation => mutation.attributeName === 'class');
      if (hasClassChange) {
        setIsDarkTheme(checkIsDarkTheme());
      }
    });

    if (typeof document !== 'undefined') {
      observer.observe(document.documentElement, { attributes: true });
    }

    return () => {
      observer.disconnect();
    };
  }, []);

  return isDarkTheme;
};
