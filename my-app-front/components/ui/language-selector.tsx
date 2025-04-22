"use client";

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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

  const languages: Language[] = [
    { value: 'javascript', label: 'JavaScript', color: '#f7df1e' },
    { value: 'typescript', label: 'TypeScript', color: '#3178c6' },
    { value: 'python', label: 'Python', color: '#3776ab' },
    { value: 'html', label: 'HTML', color: '#e34c26' },
    { value: 'css', label: 'CSS', color: '#264de4' },
    { value: 'jsx', label: 'JSX', color: '#61dafb' },
    { value: 'tsx', label: 'TSX', color: '#3178c6' },
    { value: 'json', label: 'JSON', color: '#8bc34a' },
  ];

  const selectedLanguage = languages.find(lang => lang.value === value) || languages[0];

  // Close dropdown when clicking outside
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
        className="flex items-center gap-2 px-3 py-2 rounded-full bg-bg-tertiary/50 hover:bg-bg-tertiary transition-colors text-sm font-medium shadow-sm"
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
          className={`text-text-secondary transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="absolute z-10 mt-1 w-full bg-bg-primary rounded-md shadow-lg overflow-hidden"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
          >
            <ul
              className="py-1 max-h-60 overflow-auto"
              role="listbox"
              aria-activedescendant={selectedLanguage.value}
            >
              {languages.map((language) => (
                <li
                  key={language.value}
                  role="option"
                  aria-selected={value === language.value}
                  className={`
                    flex items-center gap-2 px-3 py-2 cursor-pointer
                    ${value === language.value ? 'bg-bg-tertiary' : 'hover:bg-bg-tertiary'}
                    transition-colors
                  `}
                  onClick={() => handleSelect(language.value)}
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
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
