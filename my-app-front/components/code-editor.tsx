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
  const [isFormatting, setIsFormatting] = useState(false);

  /**
   * Debounced change handler to prevent excessive re-renders
   * Uses requestAnimationFrame to optimize performance
   */
  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newCode = e.target.value;
    setCode(newCode);

    // Use requestAnimationFrame to debounce line count updates
    requestAnimationFrame(() => {
      setLineCount(newCode.split('\n').length);
      if (onChange) {
        onChange(newCode);
      }
    });
  }, [onChange]);

  /**
   * Format code based on language with performance optimizations
   *
   * This function applies basic formatting to the code based on the selected language.
   * It handles indentation, spacing, and other formatting rules.
   * Uses requestAnimationFrame to avoid blocking the main thread.
   */
  const formatCode = useCallback(() => {
    setIsFormatting(true);

    // Use requestAnimationFrame to avoid blocking the main thread
    requestAnimationFrame(() => {
      try {
        let formattedCode = code;

        // Basic indentation for JavaScript/TypeScript
        if (['javascript', 'typescript', 'jsx', 'tsx'].includes(language)) {
          // Replace multiple spaces with a single space
          formattedCode = formattedCode.replace(/\s{2,}/g, ' ');

          // Add proper indentation after opening braces
          formattedCode = formattedCode.replace(/{\s*\n/g, '{\n  ');

          // Add proper indentation for nested blocks
          let lines = formattedCode.split('\n');
          let indentLevel = 0;

          formattedCode = lines.map(line => {
            // Adjust indent level based on braces
            const openBraces = (line.match(/{/g) || []).length;
            const closeBraces = (line.match(/}/g) || []).length;

            // Calculate the indent for this line (before adjusting indentLevel)
            const indent = '  '.repeat(Math.max(0, indentLevel));

            // Update indent level for the next line
            indentLevel += openBraces - closeBraces;

            return indent + line.trim();
          }).join('\n');
        }

        // Update the code state
        setCode(formattedCode);
        setLineCount(formattedCode.split('\n').length);

        if (onChange) {
          onChange(formattedCode);
        }
      } catch (error) {
        console.error('Error formatting code:', error);
      } finally {
        setIsFormatting(false);
      }
    });
  }, [code, language, onChange]);

  // Generate line numbers - memoize this to avoid unnecessary re-renders
  const lineNumbers = React.useMemo(() => {
    return Array.from({ length: Math.max(1, lineCount) }, (_, i) => i + 1);
  }, [lineCount]);

  /**
   * Memoize language colors to prevent unnecessary calculations
   * This improves performance by avoiding recalculating colors on every render
   */
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
        <div className="editor-actions">
          <button
            className={`format-button ${isFormatting || !code.trim() ? 'disabled' : ''}`}
            onClick={formatCode}
            disabled={isFormatting || !code.trim()}
            title="Format code with proper indentation"
          >
            {isFormatting ? 'Formatting...' : 'Format'}
          </button>
        </div>
      </div>
      <div className="code-editor-content">
        <div className="line-numbers" style={{ contain: 'content' }}>
          {/* Render line numbers with optimized rendering */}
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
          background-color: #0d1117;
          border: 1px solid #30363d;
          font-family: var(--font-geist-mono), 'Consolas', 'Monaco', 'Andale Mono', monospace;
          font-size: 14px;
          line-height: 1.6;
          box-shadow: none;
          transition: none;
          contain: layout style;
        }

        :global(.light-theme) .code-editor-container {
          background-color: #f8fafc;
          border-color: #e2e8f0;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
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
          background-color: #161b22;
          border-bottom: 1px solid #21262d;
        }

        :global(.light-theme) .code-editor-header {
          background-color: #f1f5f9;
          border-bottom: 1px solid #e2e8f0;
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
          color: #e6edf3;
          font-size: 12px;
          font-weight: 500;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        :global(.light-theme) .language-tag {
          color: #334155;
        }

        .editor-actions {
          display: flex;
          gap: 8px;
        }

        .format-button {
          background-color: var(--secondary);
          color: white;
          border: none;
          border-radius: 4px;
          padding: 6px 12px;
          font-size: 12px;
          font-weight: 500;
          cursor: pointer;
          transition: none;
        }

        :global(.light-theme) .format-button {
          background-color: var(--secondary);
        }

        .format-button:hover {
          background-color: var(--secondary-hover);
          opacity: 0.95;
        }

        :global(.light-theme) .format-button:hover {
          background-color: var(--secondary-hover);
        }

        .format-button.disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .format-button:active {
          transform: translateY(1px);
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
          background-color: #0d1117;
          color: #e6edf3;
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
          scrollbar-color: #30363d transparent;
          contain: strict;
          white-space: pre;
        }

        :global(.light-theme) .code-textarea {
          background-color: #f8fafc;
          color: #334155;
          scrollbar-color: #cbd5e1 transparent;
        }

        .code-textarea::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }

        .code-textarea::-webkit-scrollbar-track {
          background: transparent;
        }

        .code-textarea::-webkit-scrollbar-thumb {
          background-color: #30363d;
          border-radius: 4px;
        }

        .code-textarea::-webkit-scrollbar-thumb:hover {
          background-color: #6e7681;
        }

        :global(.light-theme) .code-textarea::-webkit-scrollbar-thumb {
          background-color: #cbd5e1;
          border-radius: 4px;
        }

        :global(.light-theme) .code-textarea::-webkit-scrollbar-thumb:hover {
          background-color: #94a3b8;
        }

        .code-textarea::placeholder {
          color: #6e7681;
          opacity: 0.6;
        }

        :global(.light-theme) .code-textarea::placeholder {
          color: #94a3b8;
          opacity: 0.7;
        }
      `}</style>
    </div>
  );
}
