"use client";

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  detectLanguage,
  getLanguageColors,
  tokenizeCode
} from '@/utils/code-highlighting';

interface CodeBlockProps {
  code: string;
  language?: string;
}

export function CodeBlock({ code, language = 'javascript' }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const detectedLanguage = language || detectLanguage(code, language);

  const highlightSyntax = (code: string, language: string): React.ReactNode => {
    if (!code) return null;

    const lines = code.split('\n');

    return (
      <div className="code-container">
        <div className="line-numbers">
          {lines.map((_, i) => (
            <div key={i} className="line-number">{i + 1}</div>
          ))}
        </div>
        <div className="code-lines">
          <pre className={`language-${language}`}>
            <code className={`language-${language}`}>
              {tokenizeCode(code, language).map((token, index) => {
                if (token.type === 'plain') {
                  return <span key={index} dangerouslySetInnerHTML={{ __html: token.text }} />;
                }

                return (
                  <span key={index} className={token.type} dangerouslySetInnerHTML={{ __html: token.text }} />
                );
              })}
            </code>
          </pre>
        </div>
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
    </motion.div>
  );
}
