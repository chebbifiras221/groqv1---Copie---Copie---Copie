import { useState, useEffect } from 'react';

/**
 * Hook to detect and track theme changes
 * @returns {boolean} Whether the current theme is dark
 */
export const useThemeDetector = (): boolean => {
  const [isDarkTheme, setIsDarkTheme] = useState(true);

  useEffect(() => {
    // Initial theme check
    if (typeof window !== 'undefined') {
      setIsDarkTheme(!document.documentElement.classList.contains('light-theme'));
    }

    // Listen for theme changes
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'class') {
          setIsDarkTheme(!document.documentElement.classList.contains('light-theme'));
        }
      });
    });

    if (typeof window !== 'undefined') {
      observer.observe(document.documentElement, { attributes: true });
    }

    return () => {
      observer.disconnect();
    };
  }, []);

  return isDarkTheme;
};
