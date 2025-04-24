"use client";

import React, { useState } from 'react';
import { motion } from 'framer-motion';

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
    // This is a very basic implementation
    // In a real app, you'd use a proper syntax highlighting library

    // Replace keywords with spans
    let highlightedCode = code;

    // JavaScript/TypeScript keywords
    if (['javascript', 'typescript', 'jsx', 'tsx'].includes(language)) {
      highlightedCode = highlightedCode
        .replace(/\b(const|let|var|function|return|if|else|for|while|class|import|export|from|default|async|await)\b/g,
          '<span class="keyword">$1</span>')
        .replace(/\b(true|false|null|undefined)\b/g,
          '<span class="boolean">$1</span>')
        .replace(/(".*?"|'.*?'|`.*?`)/g,
          '<span class="string">$1</span>')
        .replace(/\b(\d+)\b/g,
          '<span class="number">$1</span>')
        .replace(/\/\/(.*)/g,
          '<span class="comment">//$1</span>')
        .replace(/\/\*([\s\S]*?)\*\//g,
          '<span class="comment">/*$1*/</span>');
    }

    // Python keywords
    if (language === 'python') {
      highlightedCode = highlightedCode
        .replace(/\b(def|class|import|from|return|if|elif|else|for|while|try|except|finally|with|as|lambda|None|True|False)\b/g,
          '<span class="keyword">$1</span>')
        .replace(/(".*?"|'.*?'|"""[\s\S]*?"""|'''[\s\S]*?''')/g,
          '<span class="string">$1</span>')
        .replace(/\b(\d+)\b/g,
          '<span class="number">$1</span>')
        .replace(/#(.*)/g,
          '<span class="comment">#$1</span>');
    }

    // HTML keywords
    if (language === 'html') {
      highlightedCode = highlightedCode
        .replace(/(&lt;[\/]?[a-zA-Z0-9]+(&gt;)?)/g,
          '<span class="keyword">$1</span>')
        .replace(/("[^"]*")/g,
          '<span class="string">$1</span>')
        .replace(/(&lt;!--[\s\S]*?--&gt;)/g,
          '<span class="comment">$1</span>');
    }

    // CSS keywords
    if (language === 'css') {
      highlightedCode = highlightedCode
        .replace(/([.#][a-zA-Z0-9_-]+)/g,
          '<span class="selector">$1</span>')
        .replace(/(\{|\})/g,
          '<span class="bracket">$1</span>')
        .replace(/([a-zA-Z-]+)(\s*:)/g,
          '<span class="property">$1</span>$2')
        .replace(/(:\s*)([^;]+)(;)/g,
          '$1<span class="value">$2</span>$3')
        .replace(/\/\*([\s\S]*?)\*\//g,
          '<span class="comment">/*$1*/</span>');
    }

    return <div dangerouslySetInnerHTML={{ __html: highlightedCode }} />;
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
          background-color: var(--bg-code);
          border: 1px solid var(--border-code);
          font-family: var(--font-geist-mono), 'Consolas', 'Monaco', 'Andale Mono', monospace;
          font-size: 14px;
          line-height: 1.6;
          box-shadow: var(--shadow-sm);
          transition: all 0.2s ease;
        }

        :global(.light-theme) .code-block-container {
          background-color: var(--bg-code-light);
          border: 1px solid var(--border-code-light);
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
          background-color: var(--bg-code-header);
          border-bottom: 1px solid var(--border-code);
        }

        :global(.light-theme) .code-header {
          background-color: var(--bg-code-header-light);
          border-bottom: 1px solid var(--border-code-light);
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
          color: var(--text-code-primary);
          font-size: 12px;
          font-weight: 500;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        :global(.light-theme) .language-tag {
          color: var(--text-code-primary-light);
        }

        .copy-button {
          background-color: var(--primary-button);
          color: white;
          border: none;
          border-radius: 3px;
          padding: 4px 8px;
          font-size: 12px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.15s ease;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        :global(.light-theme) .copy-button {
          background-color: var(--primary-button-light);
        }

        .copy-button:hover {
          background-color: #0062a3;
          opacity: 0.95;
        }

        .copy-button:active {
          transform: translateY(1px);
        }

        .code-content {
          padding: 16px;
          overflow-x: auto;
          background-color: #1e1e1e;
          scrollbar-width: thin;
          scrollbar-color: #3e3e42 transparent;
        }

        :global(.light-theme) .code-content {
          background-color: #ffffff;
          scrollbar-color: #d4d4d4 transparent;
        }

        .code-content::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }

        .code-content::-webkit-scrollbar-track {
          background: transparent;
        }

        .code-content::-webkit-scrollbar-thumb {
          background-color: #30363d;
          border-radius: 4px;
        }

        .code-content::-webkit-scrollbar-thumb:hover {
          background-color: #6e7681;
        }

        .code-container {
          display: flex;
        }

        .line-numbers {
          display: flex;
          flex-direction: column;
          padding-right: 16px;
          border-right: 1px solid #3e3e42;
          color: #858585;
          user-select: none;
          text-align: right;
          min-width: 40px;
        }

        :global(.light-theme) .line-numbers {
          border-right: 1px solid #d4d4d4;
          color: #858585;
        }

        pre {
          margin: 0;
          padding: 0;
          background-color: transparent;
          color: #d4d4d4;
        }

        :global(.light-theme) pre {
          color: #000000;
        }

        code {
          font-family: inherit;
        }

        /* Syntax highlighting with VS Code colors */
        .keyword {
          color: #569cd6;
          font-weight: 500;
        }

        .string {
          color: #ce9178;
        }

        .boolean {
          color: #569cd6;
          font-weight: 500;
        }

        .number {
          color: #b5cea8;
        }

        .comment {
          color: #6a9955;
          font-style: italic;
        }

        .selector {
          color: #d7ba7d;
        }

        .property {
          color: #9cdcfe;
        }

        .value {
          color: #ce9178;
        }

        .bracket {
          color: #d4d4d4;
        }

        /* Light theme syntax highlighting - VS Code Light+ theme */
        :global(.light-theme) .keyword {
          color: #0000ff;
          font-weight: 500;
        }

        :global(.light-theme) .string {
          color: #a31515;
        }

        :global(.light-theme) .boolean {
          color: #0000ff;
          font-weight: 500;
        }

        :global(.light-theme) .number {
          color: #098658;
        }

        :global(.light-theme) .comment {
          color: #008000;
          font-style: italic;
        }

        :global(.light-theme) .selector {
          color: #800000;
        }

        :global(.light-theme) .property {
          color: #795e26;
        }

        :global(.light-theme) .value {
          color: #a31515;
        }

        :global(.light-theme) .bracket {
          color: #000000;
        }
      `}</style>
    </motion.div>
  );
}
