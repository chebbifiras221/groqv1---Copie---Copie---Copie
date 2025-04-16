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

  return (
    <motion.div 
      className="code-editor-container"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="code-editor-header">
        <div className="language-tag">{language}</div>
        <div className="editor-actions">
          <button className="run-button">Run</button>
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
          margin: 1rem 0;
          border-radius: 6px;
          overflow: hidden;
          background-color: #1e1e1e;
          border: 1px solid #333;
          font-family: 'Consolas', 'Monaco', 'Andale Mono', monospace;
          font-size: 14px;
          line-height: 1.5;
        }
        
        .code-editor-header {
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
        
        .editor-actions {
          display: flex;
          gap: 8px;
        }
        
        .run-button {
          background-color: #3c873a;
          color: white;
          border: none;
          border-radius: 4px;
          padding: 4px 8px;
          font-size: 12px;
          cursor: pointer;
          transition: background-color 0.2s;
        }
        
        .run-button:hover {
          background-color: #4cae4c;
        }
        
        .code-editor-content {
          display: flex;
          height: 200px;
        }
        
        .line-numbers {
          display: flex;
          flex-direction: column;
          padding: 8px 8px 8px 16px;
          border-right: 1px solid #333;
          color: #858585;
          user-select: none;
          text-align: right;
          background-color: #1e1e1e;
        }
        
        .line-number {
          font-size: 14px;
          line-height: 1.5;
        }
        
        .code-textarea {
          flex: 1;
          background-color: #1e1e1e;
          color: #d4d4d4;
          border: none;
          padding: 8px 16px;
          font-family: inherit;
          font-size: inherit;
          line-height: inherit;
          resize: none;
          outline: none;
          width: 100%;
          height: 100%;
          tab-size: 2;
        }
        
        .code-textarea::placeholder {
          color: #6a9955;
          opacity: 0.6;
        }
      `}</style>
    </motion.div>
  );
}
