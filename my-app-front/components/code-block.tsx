"use client";

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  detectLanguage,
  getLanguageColors,
  tokenizeCode
} from '@/utils/code-highlighting';
import { useThemeDetector } from '@/utils/theme-utils';

interface CodeBlockProps {
  code: string;
  language?: string;
}

export function CodeBlock({ code, language = 'javascript' }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const isDarkTheme = useThemeDetector();

  const copyToClipboard = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const detectedLanguage = language || detectLanguage(code, language);

  // Function to highlight syntax
  const highlightSyntax = (code: string, language: string): React.ReactNode => {
    if (!code) return null;

    // Split the code into lines for line numbers
    const lines = code.split('\n');

    return (
      <div className="code-container">
        <div className="line-numbers">
          {lines.map((_, i) => (
            <div key={i} className="line-number">{i + 1}</div>
          ))}
        </div>
        <pre className={`language-${language}`}>
          <code className={`language-${language}`}>
            <div className="code-content">
              {tokenizeCode(code, language).map((token, index) => {
                // For plain text, just render it as is
                if (token.type === 'plain') {
                  // Use dangerouslySetInnerHTML to preserve HTML entities
                  return <span key={index} dangerouslySetInnerHTML={{ __html: token.text }} />;
                }

                // For other token types, apply the appropriate class
                return (
                  <span key={index} className={token.type} dangerouslySetInnerHTML={{ __html: token.text }} />
                );
              })}
            </div>
          </code>
        </pre>
      </div>
    );
  };

  const langColors = getLanguageColors(detectedLanguage);

  return (
    <motion.div
      className="code-block-container"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="code-header">
        <div className="language-indicator">
          <div className="language-dot" style={{ backgroundColor: langColors.primary }}></div>
          <div className="language-tag">{detectedLanguage}</div>
        </div>
        <button
          className="copy-button"
          onClick={copyToClipboard}
        >
          {copied ? '✓ Copied!' : 'Copy code'}
        </button>
      </div>
      <div className="code-content">
        {highlightSyntax(code, detectedLanguage)}
      </div>
      <style jsx>{`
        .code-block-container {
          margin: 1.5rem 0;
          border-radius: 8px;
          overflow: hidden;
          background-color: #1a1f24;
          border: 1px solid #2d333b;
          font-family: var(--font-geist-mono), 'Consolas', 'Monaco', 'Andale Mono', monospace;
          font-size: 14px;
          line-height: 1.6;
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
          transition: all 0.2s ease;
        }

        :global(.light-theme) .code-block-container {
          background-color: #ffffff;
          border: 1px solid #d0d7de;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
        }

        .code-block-container:hover {
          box-shadow: 0 6px 16px rgba(0, 0, 0, 0.12);
          transform: translateY(-1px);
          border-color: #6e76811a;
        }

        .code-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 16px;
          background-color: #242a33;
          border-bottom: 1px solid #2d333b;
        }

        :global(.light-theme) .code-header {
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
          color: #e6edf3;
          font-size: 12px;
          font-weight: 500;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        :global(.light-theme) .language-tag {
          color: #57606a;
        }

        .copy-button {
          background-color: #2188ff;
          color: white;
          border: none;
          border-radius: 4px;
          padding: 4px 10px;
          font-size: 12px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          gap: 4px;
        }

        :global(.light-theme) .copy-button {
          background-color: #0969da;
          color: white;
        }

        .copy-button:hover {
          background-color: #1f6feb;
          transform: translateY(-1px);
        }

        .copy-button:active {
          transform: translateY(0);
        }

        .code-content {
          padding: 16px;
          overflow-x: auto;
          background-color: #1a1f24;
          scrollbar-width: thin;
          scrollbar-color: #2d333b transparent;
          color: #e6edf3;
        }

        :global(.light-theme) .code-content {
          background-color: #ffffff;
          scrollbar-color: #d4d4d4 transparent;
          color: #24292f;
        }

        .code-content::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }

        .code-content::-webkit-scrollbar-track {
          background: transparent;
        }

        .code-content::-webkit-scrollbar-thumb {
          background-color: #2d333b;
          border-radius: 4px;
        }

        .code-content::-webkit-scrollbar-thumb:hover {
          background-color: #3a424e;
        }

        .code-container {
          display: flex;
        }

        .line-numbers {
          display: flex;
          flex-direction: column;
          padding-right: 16px;
          border-right: 1px solid #2d333b;
          color: #7d8590;
          user-select: none;
          text-align: right;
          min-width: 40px;
          background-color: #1a1f24;
        }

        :global(.light-theme) .line-numbers {
          border-right: 1px solid #d4d4d4;
          color: #6e7781;
          background-color: #ffffff;
        }

        pre {
          margin: 0;
          padding: 0;
          background-color: transparent;
          color: #e6edf3;
        }

        :global(.light-theme) pre {
          color: #24292f;
        }

        code {
          font-family: inherit;
        }

        /* Syntax highlighting with GitHub Dark colors */
        .keyword {
          color: #ff7b72;
          font-weight: 500;
          display: inline;
        }

        .string {
          color: #a5d6ff;
          display: inline;
        }

        .boolean {
          color: #d2a8ff;
          font-weight: 500;
          display: inline;
        }

        .number {
          color: #79c0ff;
          display: inline;
        }

        .comment {
          color: #8b949e;
          font-style: italic;
          display: inline;
        }

        .selector {
          color: #7ee787;
          display: inline;
        }

        .property {
          color: #d2a8ff;
          display: inline;
        }

        .value {
          color: #a5d6ff;
          display: inline;
        }

        .bracket {
          color: #e6edf3;
          display: inline;
        }

        /* Light theme syntax highlighting - VS Code Light+ theme */
        :global(.light-theme) .keyword {
          color: #0000ff;
          font-weight: 500;
          display: inline;
        }

        :global(.light-theme) .string {
          color: #a31515;
          display: inline;
        }

        :global(.light-theme) .boolean {
          color: #0000ff;
          font-weight: 500;
          display: inline;
        }

        :global(.light-theme) .number {
          color: #098658;
          display: inline;
        }

        :global(.light-theme) .comment {
          color: #008000;
          font-style: italic;
          display: inline;
        }

        :global(.light-theme) .selector {
          color: #800000;
          display: inline;
        }

        :global(.light-theme) .property {
          color: #795e26;
          display: inline;
        }

        :global(.light-theme) .value {
          color: #a31515;
          display: inline;
        }

        :global(.light-theme) .bracket {
          color: #000000;
          display: inline;
        }
      `}</style>
    </motion.div>
  );
}
