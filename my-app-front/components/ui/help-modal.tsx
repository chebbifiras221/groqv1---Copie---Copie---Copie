"use client";

import React from 'react';
import { HelpCircle, Mic, Keyboard, Code, MessageSquare } from 'lucide-react';
import { Modal } from './modal';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function HelpModal({ isOpen, onClose }: HelpModalProps) {
  const helpSections = [
    {
      title: "Voice Interaction",
      icon: <Mic className="text-primary-DEFAULT" size={20} />,
      content: "Click the microphone button or press and hold the spacebar to speak to the AI assistant. Release to stop recording."
    },
    {
      title: "Text Input",
      icon: <Keyboard className="text-secondary-DEFAULT" size={20} />,
      content: "Type your message in the text input field at the bottom of the screen and press Enter or click the send button."
    },
    {
      title: "Code Editor",
      icon: <Code className="text-success-DEFAULT" size={20} />,
      content: "Click the code button to open the code editor. Write your code and select the language, then submit it to the AI assistant."
    },
    {
      title: "Conversations",
      icon: <MessageSquare className="text-warning-DEFAULT" size={20} />,
      content: "Your conversations are saved automatically. You can view, rename, or delete them from the sidebar."
    }
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Help"
      maxWidth="max-w-2xl"
    >
      <div className="p-6 bg-bg-primary">
        <div className="flex items-center gap-2 mb-6">
          <HelpCircle className="text-primary-DEFAULT" size={24} />
          <h2 className="text-xl font-medium text-text-primary">How to Use the Programming Teacher AI</h2>
        </div>

        <div className="space-y-6">
          {helpSections.map((section, index) => (
            <div key={index} className="bg-bg-tertiary rounded-lg p-4 border border-border-muted">
              <div className="flex items-center gap-2 mb-2">
                {section.icon}
                <h3 className="text-lg font-medium text-text-primary">{section.title}</h3>
              </div>
              <p className="text-text-secondary">{section.content}</p>
            </div>
          ))}

          <div className="mt-6 text-text-tertiary text-sm">
            <p>This Programming Teacher AI is powered by LiveKit and Groq. It uses speech recognition to transcribe your voice and AI to generate responses.</p>
          </div>
        </div>
      </div>
    </Modal>
  );
}
