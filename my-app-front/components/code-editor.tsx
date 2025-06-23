"use client";

import React, { useState, useCallback, useMemo } from 'react';

interface CodeEditorProps {
  initialCode?: string;
  language?: string;
  placeholder?: string;
  onChange?: (code: string) => void;
}

export function CodeEditor({
  initialCode = '',
  language = 'javascript',
  placeholder = 'Type your code here...',
  onChange
}: CodeEditorProps) {
  const [code, setCode] = useState(initialCode);
  const [lineCount, setLineCount] = useState(initialCode.split('\n').length);

  /**
   * Debounced change handler to prevent excessive re-renders
   */
  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newCode = e.target.value;
    setCode(newCode);

    // Update line count and call onChange
    setLineCount(newCode.split('\n').length);
    if (onChange) {
      onChange(newCode);
    }
  }, [onChange]);

  // Generate line numbers
  const lineNumbers = useMemo(() => {
    return Array.from({ length: Math.max(1, lineCount) }, (_, i) => i + 1);
  }, [lineCount]);

  // Language colors
  const langColors = useMemo(() => {
    const colors = {
      javascript: { primary: '#f7df1e', secondary: '#323330', text: '#323330' },
      typescript: { primary: '#3178c6', secondary: '#235a97', text: '#ffffff' },
      python: { primary: '#3776ab', secondary: '#ffd343', text: '#ffffff' },
      html: { primary: '#e34c26', secondary: '#f06529', text: '#ffffff' },
      css: { primary: '#264de4', secondary: '#2965f1', text: '#ffffff' },
      jsx: { primary: '#61dafb', secondary: '#282c34', text: '#ffffff' },
      tsx: { primary: '#3178c6', secondary: '#61dafb', text: '#ffffff' },
      json: { primary: '#000000', secondary: '#8bc34a', text: '#ffffff' },
      default: { primary: '#6e40c9', secondary: '#5a32a3', text: '#ffffff' }
    };

    return colors[language as keyof typeof colors] || colors.default;
  }, [language]);

  return (
    <div
      className="code-editor-container"
      style={{
        contain: 'content',
        transform: 'translateZ(0)' // Force GPU acceleration
      }}
    >
      <div className="code-editor-header">
        <div className="language-indicator">
          <div className="language-dot" style={{ backgroundColor: langColors.primary }}></div>
          <div className="language-tag">{language}</div>
        </div>

      </div>
      <div className="code-editor-content">
        <div className="line-numbers" style={{ contain: 'content' }}>
          {lineNumbers.map(num => (
            <div key={num} className="line-number" style={{ contain: 'content' }}>{num}</div>
          ))}
        </div>
        <textarea
          value={code}
          onChange={handleChange}
          placeholder={placeholder}
          className="code-textarea"
          spellCheck="false"
          autoCorrect="off"
          autoCapitalize="off"
          autoComplete="off"
          style={{
            contain: 'strict',
            transform: 'translateZ(0)',
            caretColor: langColors.primary
          }}
        />
      </div>
      <style jsx>{`
        .code-editor-container {
          margin: 0;
          border-radius: 8px;
          overflow: hidden;
          background-color: #1a1f24; /* Match app's dark theme */
          border: 1px solid #2d333b;
          font-family: var(--font-geist-mono), 'Consolas', 'Monaco', 'Andale Mono', monospace;
          font-size: 14px;
          line-height: 1.6;
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
          transition: all 0.2s ease;
          contain: layout style;
        }

        :global(.light-theme) .code-editor-container {
          background-color: #ffffff;
          border-color: #d0d7de;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
        }

        .code-editor-container:focus-within {
          border-color: ${langColors.primary}60;
          box-shadow: 0 0 0 1px ${langColors.primary}15;
        }

        .code-editor-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 16px;
          background-color: #242a33; /* Match app's dark theme */
          border-bottom: 1px solid #2d333b;
        }

        :global(.light-theme) .code-editor-header {
          background-color: #f3f3f3;
          border-bottom: 1px solid #d0d7de;
        }

        .language-indicator {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .language-dot {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background-color: ${langColors.primary};
          box-shadow: 0 0 8px ${langColors.primary}80;
        }

        .language-tag {
          color: #e6edf3; /* Brighter text for better contrast */
          font-size: 12px;
          font-weight: 500;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        :global(.light-theme) .language-tag {
          color: #57606a;
        }



        .code-editor-content {
          display: flex;
          height: 250px;
          contain: layout;
        }

        .line-numbers {
          display: flex;
          flex-direction: column;
          padding: 12px 12px 12px 16px;
          border-right: 1px solid #21262d;
          color: #6e7681;
          user-select: none;
          text-align: right;
          background-color: #0d1117;
          contain: content;
          width: 3em;
          flex-shrink: 0;
        }

        :global(.light-theme) .line-numbers {
          border-right: 1px solid #e2e8f0;
          color: #94a3b8;
          background-color: #f8fafc;
        }

        .line-number {
          font-size: 14px;
          line-height: 1.6;
          min-width: 1.5em;
        }

        .code-textarea {
          flex: 1;
          background-color: #1a1f24; /* Match app's dark theme */
          color: #e6edf3; /* Brighter text for better contrast */
          border: none;
          padding: 12px 16px;
          font-family: inherit;
          font-size: inherit;
          line-height: inherit;
          resize: none;
          outline: none;
          width: 100%;
          height: 100%;
          tab-size: 2;
          scrollbar-width: thin;
          scrollbar-color: #2d333b transparent;
          contain: strict;
          white-space: pre;
        }

        :global(.light-theme) .code-textarea {
          background-color: #ffffff;
          color: #24292f;
          scrollbar-color: #d0d7de transparent;
        }

        .code-textarea::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }

        .code-textarea::-webkit-scrollbar-track {
          background: transparent;
        }

        .code-textarea::-webkit-scrollbar-thumb {
          background-color: #2d333b;
          border-radius: 4px;
        }

        .code-textarea::-webkit-scrollbar-thumb:hover {
          background-color: #3a424e;
        }

        :global(.light-theme) .code-textarea::-webkit-scrollbar-thumb {
          background-color: #d0d7de;
          border-radius: 4px;
        }

        :global(.light-theme) .code-textarea::-webkit-scrollbar-thumb:hover {
          background-color: #bbc6d0;
        }

        .code-textarea::placeholder {
          color: #7d8590; /* Slightly brighter for better visibility */
          opacity: 0.6;
        }

        :global(.light-theme) .code-textarea::placeholder {
          color: #6e7781;
          opacity: 0.7;
        }
      `}</style>
    </div>
  );
}
