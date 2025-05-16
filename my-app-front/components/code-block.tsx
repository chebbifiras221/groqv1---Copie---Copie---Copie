"use client";

import React, { useState } from 'react';
import { motion } from 'framer-motion';

interface CodeBlockProps {
  code: string;
  language?: string;
}

export function CodeBlock({ code, language = 'javascript' }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  // Check for theme changes
  const [isDarkTheme, setIsDarkTheme] = useState(true);

  React.useEffect(() => {
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

  const copyToClipboard = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Function to detect the language from code if not provided
  const detectLanguage = (code: string): string => {
    if (code.includes('import React') || code.includes('export default') || code.includes('const [')) {
      return 'jsx';
    }
    if (code.includes('function') || code.includes('const ') || code.includes('let ')) {
      return 'javascript';
    }
    if (code.includes('import ') && code.includes('from ')) {
      return 'typescript';
    }
    if (code.includes('<html>') || code.includes('<div>')) {
      return 'html';
    }
    if (code.includes('.class') || code.includes('#id') || code.includes('@media')) {
      return 'css';
    }
    if (code.includes('def ') || code.includes('import ') && !code.includes('from ')) {
      return 'python';
    }
    return language;
  };

  const detectedLanguage = language || detectLanguage(code);

  // Function to highlight syntax (basic implementation)
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
            {applyBasicHighlighting(code, language)}
          </code>
        </pre>
      </div>
    );
  };

  // Basic syntax highlighting function
  const applyBasicHighlighting = (code: string, language: string): React.ReactNode => {
    // Let's take a completely different approach to avoid HTML tag issues

    // Import the utility functions for HTML entity handling
    // First, decode any HTML entities that might already be in the code
    const decodeHtmlEntities = (text: string): string => {
      if (!text) return '';

      return text
        .replace(/&quot;/g, '"')
        .replace(/&#039;/g, "'")
        .replace(/&#x27;/g, "'")
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .replace(/&nbsp;/g, ' ');
    };

    // Then escape HTML entities to prevent XSS and rendering issues
    const escapeHtml = (text: string): string => {
      if (!text) return '';

      return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, "&#039;");
    };

    // First decode any existing entities, then escape for safe HTML
    // Make sure to decode multiple times to handle double-encoded entities
    let decodedCode = code;

    // Log the original code to debug
    console.log("Original code:", decodedCode);

    // Decode multiple times to handle nested encodings
    for (let i = 0; i < 3; i++) {
      decodedCode = decodeHtmlEntities(decodedCode);
    }

    // Log the decoded code to debug
    console.log("Decoded code:", decodedCode);

    // IMPORTANT: We're skipping the HTML escaping step for the actual display
    // This is the key fix - we want to show the actual characters, not their HTML entity representations
    let escapedCode = decodedCode;

    // Create a structure to hold our tokens
    type Token = {
      text: string;
      type: string;
    };

    const tokens: Token[] = [];

    // Function to add a token
    const addToken = (text: string, type: string) => {
      tokens.push({ text, type });
    };

    // Now let's tokenize the code based on language
    if (['javascript', 'typescript', 'jsx', 'tsx'].includes(language)) {
      // Define patterns for different token types
      const patterns = [
        { type: 'keyword', regex: /\b(const|let|var|function|return|if|else|for|while|class|import|export|from|default|async|await)\b/g },
        { type: 'boolean', regex: /\b(true|false|null|undefined)\b/g },
        { type: 'string', regex: /(".*?"|'.*?'|`.*?`)/g },
        { type: 'number', regex: /\b(\d+)\b/g },
        { type: 'comment', regex: /(\/\/.*|\/\*[\s\S]*?\*\/)/g }
      ];

      // Tokenize the code
      let remainingCode = escapedCode;
      let lastIndex = 0;

      while (remainingCode.length > 0) {
        let earliestMatch = { index: Infinity, length: 0, type: '' };

        // Find the earliest match among all patterns
        for (const pattern of patterns) {
          pattern.regex.lastIndex = 0;
          const match = pattern.regex.exec(remainingCode);
          if (match && match.index < earliestMatch.index) {
            earliestMatch = {
              index: match.index,
              length: match[0].length,
              type: pattern.type
            };
          }
        }

        if (earliestMatch.index < Infinity) {
          // Add any text before the match as plain text
          if (earliestMatch.index > 0) {
            addToken(remainingCode.substring(0, earliestMatch.index), 'plain');
          }

          // Add the matched token
          addToken(
            remainingCode.substring(earliestMatch.index, earliestMatch.index + earliestMatch.length),
            earliestMatch.type
          );

          // Update the remaining code
          remainingCode = remainingCode.substring(earliestMatch.index + earliestMatch.length);
        } else {
          // No more matches, add the rest as plain text
          addToken(remainingCode, 'plain');
          break;
        }
      }
    }
    // Python keywords
    else if (language === 'python') {
      // Define patterns for different token types
      const patterns = [
        { type: 'keyword', regex: /\b(def|class|import|from|return|if|elif|else|for|while|try|except|finally|with|as|lambda|None|True|False)\b/g },
        { type: 'string', regex: /(".*?"|'.*?'|"""[\s\S]*?"""|'''[\s\S]*?''')/g },
        { type: 'number', regex: /\b(\d+)\b/g },
        { type: 'comment', regex: /(#.*)/g }
      ];

      // Tokenize the code
      let remainingCode = escapedCode;

      while (remainingCode.length > 0) {
        let earliestMatch = { index: Infinity, length: 0, type: '' };

        // Find the earliest match among all patterns
        for (const pattern of patterns) {
          pattern.regex.lastIndex = 0;
          const match = pattern.regex.exec(remainingCode);
          if (match && match.index < earliestMatch.index) {
            earliestMatch = {
              index: match.index,
              length: match[0].length,
              type: pattern.type
            };
          }
        }

        if (earliestMatch.index < Infinity) {
          // Add any text before the match as plain text
          if (earliestMatch.index > 0) {
            addToken(remainingCode.substring(0, earliestMatch.index), 'plain');
          }

          // Add the matched token
          addToken(
            remainingCode.substring(earliestMatch.index, earliestMatch.index + earliestMatch.length),
            earliestMatch.type
          );

          // Update the remaining code
          remainingCode = remainingCode.substring(earliestMatch.index + earliestMatch.length);
        } else {
          // No more matches, add the rest as plain text
          addToken(remainingCode, 'plain');
          break;
        }
      }
    }
    // HTML keywords
    else if (language === 'html') {
      // Define patterns for different token types
      const patterns = [
        { type: 'keyword', regex: /(&lt;[\/]?[a-zA-Z0-9]+(&gt;)?)/g },
        { type: 'string', regex: /("[^"]*")/g },
        { type: 'comment', regex: /(&lt;!--[\s\S]*?--&gt;)/g }
      ];

      // Tokenize the code
      let remainingCode = escapedCode;

      while (remainingCode.length > 0) {
        let earliestMatch = { index: Infinity, length: 0, type: '' };

        // Find the earliest match among all patterns
        for (const pattern of patterns) {
          pattern.regex.lastIndex = 0;
          const match = pattern.regex.exec(remainingCode);
          if (match && match.index < earliestMatch.index) {
            earliestMatch = {
              index: match.index,
              length: match[0].length,
              type: pattern.type
            };
          }
        }

        if (earliestMatch.index < Infinity) {
          // Add any text before the match as plain text
          if (earliestMatch.index > 0) {
            addToken(remainingCode.substring(0, earliestMatch.index), 'plain');
          }

          // Add the matched token
          addToken(
            remainingCode.substring(earliestMatch.index, earliestMatch.index + earliestMatch.length),
            earliestMatch.type
          );

          // Update the remaining code
          remainingCode = remainingCode.substring(earliestMatch.index + earliestMatch.length);
        } else {
          // No more matches, add the rest as plain text
          addToken(remainingCode, 'plain');
          break;
        }
      }
    }
    // CSS keywords
    else if (language === 'css') {
      // Define patterns for different token types
      const patterns = [
        { type: 'comment', regex: /(\/\*[\s\S]*?\*\/)/g },
        { type: 'selector', regex: /([.#][a-zA-Z0-9_-]+)/g },
        { type: 'bracket', regex: /(\{|\})/g },
        { type: 'property', regex: /([a-zA-Z-]+)(?=\s*:)/g },
        { type: 'colon', regex: /(:)/g },
        { type: 'semicolon', regex: /(;)/g },
        // For values, we'll handle them specially in the tokenization loop
      ];

      // Tokenize the code
      let remainingCode = escapedCode;
      let lastTokenType = '';

      while (remainingCode.length > 0) {
        let earliestMatch = { index: Infinity, length: 0, type: '' };

        // Find the earliest match among all patterns
        for (const pattern of patterns) {
          pattern.regex.lastIndex = 0;
          const match = pattern.regex.exec(remainingCode);
          if (match && match.index < earliestMatch.index) {
            earliestMatch = {
              index: match.index,
              length: match[0].length,
              type: pattern.type
            };
          }
        }

        if (earliestMatch.index < Infinity) {
          // Add any text before the match as plain text or as a value if after a colon
          if (earliestMatch.index > 0) {
            const textBefore = remainingCode.substring(0, earliestMatch.index);

            // If the last token was a colon and the next token is a semicolon,
            // then this text is a CSS value
            if (lastTokenType === 'colon' && earliestMatch.type === 'semicolon') {
              addToken(textBefore, 'value');
            } else {
              addToken(textBefore, 'plain');
            }
          }

          // Add the matched token
          addToken(
            remainingCode.substring(earliestMatch.index, earliestMatch.index + earliestMatch.length),
            earliestMatch.type
          );

          // Remember the type of this token for context
          lastTokenType = earliestMatch.type;

          // Update the remaining code
          remainingCode = remainingCode.substring(earliestMatch.index + earliestMatch.length);
        } else {
          // No more matches, add the rest as plain text
          addToken(remainingCode, 'plain');
          break;
        }
      }
    }
    // For any other language, just add the entire code as plain text
    else {
      addToken(escapedCode, 'plain');
    }

    // Now render the tokens directly as React components
    // This completely avoids any HTML tag issues
    return (
      <div className="code-content">
        {tokens.map((token, index) => {
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
    );
  };

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
          background-color: #1a1f24; /* Match app's dark theme */
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
          background-color: #242a33; /* Match app's dark theme */
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
          color: #e6edf3; /* Brighter text for better contrast */
          font-size: 12px;
          font-weight: 500;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        :global(.light-theme) .language-tag {
          color: #57606a;
        }

        .copy-button {
          background-color: #2188ff; /* Match app's primary color */
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
          background-color: #1f6feb; /* Match app's hover color */
          transform: translateY(-1px);
        }

        .copy-button:active {
          transform: translateY(0);
        }

        .code-content {
          padding: 16px;
          overflow-x: auto;
          background-color: #1a1f24; /* Match app's dark theme */
          scrollbar-width: thin;
          scrollbar-color: #2d333b transparent;
          color: #e6edf3; /* Brighter text for better contrast */
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
          color: #7d8590; /* Slightly brighter for better visibility */
          user-select: none;
          text-align: right;
          min-width: 40px;
          background-color: #1a1f24; /* Match app's dark theme */
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
          color: #e6edf3; /* Brighter text for better contrast */
        }

        :global(.light-theme) pre {
          color: #24292f;
        }

        code {
          font-family: inherit;
        }

        /* Syntax highlighting with GitHub Dark colors */
        .keyword {
          color: #ff7b72; /* GitHub syntax theme */
          font-weight: 500;
          display: inline; /* Ensure inline display */
        }

        .string {
          color: #a5d6ff; /* GitHub syntax theme */
          display: inline; /* Ensure inline display */
        }

        .boolean {
          color: #d2a8ff; /* GitHub syntax theme */
          font-weight: 500;
          display: inline; /* Ensure inline display */
        }

        .number {
          color: #79c0ff; /* GitHub syntax theme */
          display: inline; /* Ensure inline display */
        }

        .comment {
          color: #8b949e; /* GitHub syntax theme */
          font-style: italic;
          display: inline; /* Ensure inline display */
        }

        .selector {
          color: #7ee787; /* GitHub syntax theme */
          display: inline; /* Ensure inline display */
        }

        .property {
          color: #d2a8ff; /* GitHub syntax theme */
          display: inline; /* Ensure inline display */
        }

        .value {
          color: #a5d6ff; /* GitHub syntax theme */
          display: inline; /* Ensure inline display */
        }

        .bracket {
          color: #e6edf3; /* GitHub syntax theme */
          display: inline; /* Ensure inline display */
        }

        /* Light theme syntax highlighting - VS Code Light+ theme */
        :global(.light-theme) .keyword {
          color: #0000ff;
          font-weight: 500;
          display: inline; /* Ensure inline display */
        }

        :global(.light-theme) .string {
          color: #a31515;
          display: inline; /* Ensure inline display */
        }

        :global(.light-theme) .boolean {
          color: #0000ff;
          font-weight: 500;
          display: inline; /* Ensure inline display */
        }

        :global(.light-theme) .number {
          color: #098658;
          display: inline; /* Ensure inline display */
        }

        :global(.light-theme) .comment {
          color: #008000;
          font-style: italic;
          display: inline; /* Ensure inline display */
        }

        :global(.light-theme) .selector {
          color: #800000;
          display: inline; /* Ensure inline display */
        }

        :global(.light-theme) .property {
          color: #795e26;
          display: inline; /* Ensure inline display */
        }

        :global(.light-theme) .value {
          color: #a31515;
          display: inline; /* Ensure inline display */
        }

        :global(.light-theme) .bracket {
          color: #000000;
          display: inline; /* Ensure inline display */
        }
      `}</style>
    </motion.div>
  );
}
