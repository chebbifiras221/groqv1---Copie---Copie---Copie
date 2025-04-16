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

  return (
    <motion.div 
      className="code-block-container"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="code-header">
        <div className="language-tag">{detectedLanguage}</div>
        <button 
          className="copy-button"
          onClick={copyToClipboard}
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      <div className="code-content">
        {highlightSyntax(code, detectedLanguage)}
      </div>
      <style jsx>{`
        .code-block-container {
          margin: 1rem 0;
          border-radius: 6px;
          overflow: hidden;
          background-color: #1e1e1e;
          border: 1px solid #333;
          font-family: 'Consolas', 'Monaco', 'Andale Mono', monospace;
          font-size: 14px;
          line-height: 1.5;
        }
        
        .code-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 16px;
          background-color: #252526;
          border-bottom: 1px solid #333;
        }
        
        .language-tag {
          color: #d4d4d4;
          font-size: 12px;
          text-transform: uppercase;
        }
        
        .copy-button {
          background-color: #0e639c;
          color: white;
          border: none;
          border-radius: 4px;
          padding: 4px 8px;
          font-size: 12px;
          cursor: pointer;
          transition: background-color 0.2s;
        }
        
        .copy-button:hover {
          background-color: #1177bb;
        }
        
        .code-content {
          padding: 16px;
          overflow-x: auto;
        }
        
        .code-container {
          display: flex;
        }
        
        .line-numbers {
          display: flex;
          flex-direction: column;
          padding-right: 16px;
          border-right: 1px solid #333;
          color: #858585;
          user-select: none;
          text-align: right;
          min-width: 40px;
        }
        
        pre {
          margin: 0;
          padding: 0;
          background-color: transparent;
          color: #d4d4d4;
        }
        
        code {
          font-family: inherit;
        }
        
        /* Syntax highlighting */
        .keyword {
          color: #569cd6;
        }
        
        .string {
          color: #ce9178;
        }
        
        .boolean {
          color: #569cd6;
        }
        
        .number {
          color: #b5cea8;
        }
        
        .comment {
          color: #6a9955;
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
      `}</style>
    </motion.div>
  );
}
