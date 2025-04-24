"use client";

import React, { useState, useEffect, useCallback, memo } from 'react';

import { Send, Code } from 'lucide-react';
import { Modal } from './ui/modal';
import { Button } from './ui/button';
import { CodeEditor } from './code-editor';
import { LanguageSelector } from './ui/language-selector';

// Memoize components to prevent unnecessary re-renders
const MemoizedCodeEditor = memo(CodeEditor);
const MemoizedLanguageSelector = memo(LanguageSelector);

interface CodeEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (code: string, language: string) => void;
  isSubmitting?: boolean;
  isConnected?: boolean;
}

export function CodeEditorModal({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting = false,
  isConnected = true
}: CodeEditorModalProps) {
  const [codeText, setCodeText] = useState('');
  const [codeLanguage, setCodeLanguage] = useState('javascript');

  /**
   * Reset state when modal opens
   * Uses requestAnimationFrame to avoid blocking the main thread
   */
  useEffect(() => {
    if (isOpen) {
      // Use requestAnimationFrame to avoid blocking the main thread
      requestAnimationFrame(() => {
        setCodeText('');
        setCodeLanguage('javascript');
      });
    }
  }, [isOpen]);

  /**
   * Memoized handlers to prevent unnecessary re-renders
   * These functions are wrapped in useCallback to maintain referential equality
   */
  const handleCodeChange = useCallback((code: string) => {
    setCodeText(code);
  }, []);

  const handleLanguageChange = useCallback((language: string) => {
    setCodeLanguage(language);
  }, []);

  const handleSubmit = useCallback(() => {
    if (!codeText.trim() || !isConnected || isSubmitting) return;
    onSubmit(codeText, codeLanguage);
    onClose();
  }, [codeText, codeLanguage, isConnected, isSubmitting, onSubmit, onClose]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Code Editor"
      maxWidth="max-w-4xl"
      aria-labelledby="code-editor-title"
    >
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Code className="text-primary-DEFAULT" size={20} aria-hidden="true" />
            <h3 className="text-lg font-medium text-text-primary" id="code-editor-title">Write Code</h3>
          </div>
          <MemoizedLanguageSelector
            value={codeLanguage}
            onChange={handleLanguageChange}
          />
        </div>

        <div className="mb-6">
          <MemoizedCodeEditor
            initialCode={codeText}
            language={codeLanguage}
            placeholder="Write your code here..."
            onChange={handleCodeChange}
          />
        </div>

        <div className="flex justify-end gap-3">
          <Button
            variant="outline"
            onClick={onClose}
            className="rounded-full shadow-none"
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            disabled={!isConnected || !codeText.trim() || isSubmitting}
            isLoading={isSubmitting}
            className="px-4 py-2 flex items-center gap-2 rounded-full shadow-none"
            aria-label="Send code to AI assistant"
          >
            <Send size={16} aria-hidden="true" />
            <span>Send Code</span>
          </Button>
        </div>
      </div>
    </Modal>
  );
}
