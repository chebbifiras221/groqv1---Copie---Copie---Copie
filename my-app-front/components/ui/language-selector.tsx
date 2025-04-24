"use client";

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDown, Check } from 'lucide-react';

interface Language {
  value: string;
  label: string;
  color: string;
}

interface LanguageSelectorProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export function LanguageSelector({ value, onChange, className = '' }: LanguageSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  /**
   * Memoize languages array to prevent unnecessary re-renders
   * This improves performance by avoiding recreating the array on every render
   */
  const languages = useMemo<Language[]>(() => [
    { value: 'javascript', label: 'JavaScript', color: '#f7df1e' },
    { value: 'typescript', label: 'TypeScript', color: '#3178c6' },
    { value: 'python', label: 'Python', color: '#3776ab' },
    { value: 'html', label: 'HTML', color: '#e34c26' },
    { value: 'css', label: 'CSS', color: '#264de4' },
    { value: 'jsx', label: 'JSX', color: '#61dafb' },
    { value: 'tsx', label: 'TSX', color: '#3178c6' },
    { value: 'json', label: 'JSON', color: '#8bc34a' },
  ], []);

  /**
   * Memoize selected language to prevent unnecessary re-renders
   * This ensures we don't recalculate the selected language on every render
   */
  const selectedLanguage = useMemo(() => {
    return languages.find(lang => lang.value === value) || languages[0];
  }, [languages, value]);

  /**
   * Close dropdown when clicking outside
   * This improves user experience by allowing clicks outside to dismiss the dropdown
   */
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleSelect = (langValue: string) => {
    onChange(langValue);
    setIsOpen(false);
  };

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      <button
        type="button"
        className="flex items-center gap-2 px-3 py-2 rounded-full bg-bg-tertiary/50 hover:bg-bg-tertiary text-sm font-medium shadow-none"
        onClick={() => setIsOpen(!isOpen)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span
          className="w-3 h-3 rounded-full"
          style={{ backgroundColor: selectedLanguage.color }}
        />
        <span className="text-text-primary">{selectedLanguage.label}</span>
        <ChevronDown
          size={16}
          className={`text-text-secondary ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isOpen && (
          <div
            className="absolute z-10 mt-1 w-full bg-bg-primary rounded-md shadow-sm border border-border-DEFAULT/30 overflow-hidden"
            style={{ contain: 'content', transform: 'translateZ(0)' }}
          >
            <ul
              className="py-1 max-h-60 overflow-auto"
              role="listbox"
              aria-activedescendant={selectedLanguage.value}
              style={{ contain: 'content' }}
            >
              {languages.map((language) => (
                <li
                  key={language.value}
                  role="option"
                  aria-selected={value === language.value}
                  className={`
                    flex items-center gap-2 px-3 py-2 cursor-pointer
                    ${value === language.value ? 'bg-bg-tertiary/70' : 'hover:bg-bg-tertiary/30'}
                  `}
                  onClick={() => handleSelect(language.value)}
                  style={{ contain: 'layout' }}
                >
                  <span
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: language.color }}
                  />
                  <span className="text-text-primary">{language.label}</span>
                  {value === language.value && (
                    <Check size={16} className="ml-auto text-primary-DEFAULT" />
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
    </div>
  );
}
