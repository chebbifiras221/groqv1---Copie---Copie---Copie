"use client";

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Send, Code } from 'lucide-react';
import { Modal } from './ui/modal';
import { Button } from './ui/button';
import { CodeEditor } from './code-editor';
import { LanguageSelector } from './ui/language-selector';

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
  
  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setCodeText('');
      setCodeLanguage('javascript');
    }
  }, [isOpen]);
  
  const handleCodeChange = (code: string) => {
    setCodeText(code);
  };
  
  const handleLanguageChange = (language: string) => {
    setCodeLanguage(language);
  };
  
  const handleSubmit = () => {
    if (!codeText.trim() || !isConnected || isSubmitting) return;
    onSubmit(codeText, codeLanguage);
    onClose();
  };
  
  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose}
      title="Code Editor"
      maxWidth="max-w-4xl"
    >
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Code className="text-primary-DEFAULT" size={20} />
            <h3 className="text-lg font-medium text-text-primary">Write Code</h3>
          </div>
          <LanguageSelector
            value={codeLanguage}
            onChange={handleLanguageChange}
          />
        </div>
        
        <div className="mb-6">
          <CodeEditor
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
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            disabled={!isConnected || !codeText.trim() || isSubmitting}
            isLoading={isSubmitting}
            className="px-4 py-2 flex items-center gap-2"
          >
            <Send size={16} />
            <span>Send Code</span>
          </Button>
        </div>
      </div>
    </Modal>
  );
}
