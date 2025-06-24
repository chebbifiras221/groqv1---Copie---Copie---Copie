"use client";                                                    // Run this component on the client side

import React, { useState } from 'react';                        // React hooks for state management
import { motion } from 'framer-motion';                         // Animation library for smooth transitions
import {
  detectLanguage,                                               // Function to auto-detect programming language
  getLanguageColors,                                            // Function to get color scheme for language
  tokenizeCode                                                  // Function to break code into syntax tokens
} from '@/utils/code-highlighting';                             // Code highlighting utilities

interface CodeBlockProps {                                      // TypeScript interface for component props
  code: string;                                                 // The code content to display
  language?: string;                                            // Optional programming language (defaults to 'javascript')
}

export function CodeBlock({ code, language = 'javascript' }: CodeBlockProps) { // Main code block component
  const [copied, setCopied] = useState(false);                 // State to track if code was copied to clipboard

  const copyToClipboard = () => {                               // Function to copy code to user's clipboard
    navigator.clipboard.writeText(code);                       // Use browser API to copy text
    setCopied(true);                                            // Show "copied" feedback to user
    setTimeout(() => setCopied(false), 2000);                  // Reset feedback after 2 seconds
  };

  const detectedLanguage = language || detectLanguage(code, language); // Auto-detect language if not provided

  // Function to highlight syntax and add line numbers
  const highlightSyntax = (code: string, language: string): React.ReactNode => { // Function to process and highlight code
    if (!code) return null;                                     // Return nothing if no code provided

    // Split the code into lines for line numbers
    const lines = code.split('\n');                            // Break code into individual lines

    return (
      <div className="code-container">                          {/* Container for line numbers and code */}
        <div className="line-numbers">                          {/* Left column showing line numbers */}
          {lines.map((_, i) => (                                // Create line number for each line
            <div key={i} className="line-number">{i + 1}</div> // Display line number (starting from 1)
          ))}
        </div>
        <pre className={`language-${language}`}>               {/* Preformatted text container with language class */}
          <code className={`language-${language}`}>            {/* Code container with language class for styling */}
            <div className="code-content">                     {/* Wrapper for the actual code content */}
              {tokenizeCode(code, language).map((token, index) => { // Break code into syntax tokens and render each
                // For plain text, just render it as is
                if (token.type === 'plain') {                  // If token is plain text (no special syntax)
                  // Use dangerouslySetInnerHTML to preserve HTML entities
                  return <span key={index} dangerouslySetInnerHTML={{ __html: token.text }} />; // Render as plain span
                }

                // For other token types, apply the appropriate class
                return (
                  <span key={index} className={token.type} dangerouslySetInnerHTML={{ __html: token.text }} /> // Render with syntax highlighting class
                );
              })}
            </div>
          </code>
        </pre>
      </div>
    );
  };

  const langColors = getLanguageColors(detectedLanguage);      // Get color scheme for the detected language

  return (
    <motion.div                                                 // Animated container using Framer Motion
      className="code-block-container"                         // CSS class for styling the entire code block
      initial={{ opacity: 0, y: 10 }}                         // Start animation: invisible and slightly below
      animate={{ opacity: 1, y: 0 }}                          // End animation: fully visible and in position
      transition={{ duration: 0.3 }}                          // Animation duration of 0.3 seconds
    >
      <div className="code-header">                            {/* Header section with language info and copy button */}
        <div className="language-indicator">                   {/* Left side: language information */}
          <div className="language-dot" style={{ backgroundColor: langColors.primary }}></div> {/* Colored dot indicating language */}
          <div className="language-tag">{detectedLanguage}</div> {/* Language name display */}
        </div>
        <button                                                 // Copy to clipboard button
          className="copy-button"                              // CSS class for button styling
          onClick={copyToClipboard}                            // Click handler to copy code
        >
          {copied ? '✓ Copied!' : 'Copy code'}                 {/* Button text changes when copied */}
        </button>
      </div>
      <div className="code-content">                           {/* Main content area containing the highlighted code */}
        {highlightSyntax(code, detectedLanguage)}              {/* Render the syntax-highlighted code */}
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
