"use client";

import React, { useState } from 'react';
import { motion } from 'framer-motion';

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

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newCode = e.target.value;
    setCode(newCode);
    setLineCount(newCode.split('\n').length);
    if (onChange) {
      onChange(newCode);
    }
  };

  // Generate line numbers
  const lineNumbers = Array.from({ length: Math.max(1, lineCount) }, (_, i) => i + 1);

  // Get language-specific colors
  const getLanguageColors = (lang: string) => {
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

    return colors[lang as keyof typeof colors] || colors.default;
  };

  const langColors = getLanguageColors(language);

  return (
    <motion.div
      className="code-editor-container"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="code-editor-header">
        <div className="language-indicator">
          <div className="language-dot" style={{ backgroundColor: langColors.primary }}></div>
          <div className="language-tag">{language}</div>
        </div>
        <div className="editor-actions">
          <button className="format-button">Format</button>
        </div>
      </div>
      <div className="code-editor-content">
        <div className="line-numbers">
          {lineNumbers.map(num => (
            <div key={num} className="line-number">{num}</div>
          ))}
        </div>
        <textarea
          value={code}
          onChange={handleChange}
          placeholder={placeholder}
          className="code-textarea"
          spellCheck="false"
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
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
          transition: all 0.3s ease;
        }

        .light-theme .code-editor-container {
          background-color: #f6f8fa;
          border-color: #d0d7de;
        }

        .code-editor-container:focus-within {
          border-color: ${langColors.primary}80;
          box-shadow: 0 0 0 2px ${langColors.primary}20;
        }

        .code-editor-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 16px;
          background: #161b22;
          border-bottom: 1px solid #21262d;
        }

        .light-theme .code-editor-header {
          background: #eaeef2;
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
          color: #e6edf3;
          font-size: 12px;
          font-weight: 500;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .light-theme .language-tag {
          color: #24292f;
        }

        .editor-actions {
          display: flex;
          gap: 8px;
        }

        .format-button {
          background: linear-gradient(to right, #6e40c9, #5a32a3);
          color: white;
          border: none;
          border-radius: 4px;
          padding: 6px 12px;
          font-size: 12px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .format-button:hover {
          background: linear-gradient(to right, #5a32a3, #4c2889);
          transform: translateY(-1px);
          box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2);
        }

        .format-button:active {
          transform: translateY(1px);
        }

        .code-editor-content {
          display: flex;
          height: 250px;
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
        }

        .light-theme .line-numbers {
          border-right: 1px solid #d0d7de;
          color: #6e7781;
          background-color: #f6f8fa;
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
        }

        .light-theme .code-textarea {
          background-color: #f6f8fa;
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
          background-color: #30363d;
          border-radius: 4px;
        }

        .code-textarea::-webkit-scrollbar-thumb:hover {
          background-color: #6e7681;
        }

        .light-theme .code-textarea::-webkit-scrollbar-thumb {
          background-color: #d0d7de;
          border-radius: 4px;
        }

        .light-theme .code-textarea::-webkit-scrollbar-thumb:hover {
          background-color: #6e7781;
        }

        .code-textarea::placeholder {
          color: #6e7681;
          opacity: 0.6;
        }

        .light-theme .code-textarea::placeholder {
          color: #6e7781;
          opacity: 0.6;
        }
      `}</style>
    </motion.div>
  );
}
