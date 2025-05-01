"use client";

import React from 'react';
import { HelpCircle, Mic, Keyboard, Code, MessageSquare, BookOpen, HelpCircle as HelpIcon } from 'lucide-react';
import { Modal } from './modal';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function HelpModal({ isOpen, onClose }: HelpModalProps) {
  const helpSections = [
    {
      title: "Teaching Modes",
      icon: <BookOpen className="text-primary-DEFAULT" size={20} />,
      content: "The Programming Teacher has two modes: Teacher Mode and Q&A Mode. In Teacher Mode, it provides structured learning with chapters and exercises. In Q&A Mode, it answers direct questions about programming. You can switch between modes by clicking the mode button in the top navigation bar."
    },
    {
      title: "Voice Interaction",
      icon: <Mic className="text-primary-DEFAULT" size={20} />,
      content: "Click the microphone button or press and hold the spacebar to speak to the AI assistant. Release to stop recording. The AI will automatically respond to your questions about programming."
    },
    {
      title: "Text Input",
      icon: <Keyboard className="text-secondary-DEFAULT" size={20} />,
      content: "Type your message in the text input field at the bottom of the screen and press Enter or click the send button. This is useful for precise questions or when you're in a quiet environment."
    },
    {
      title: "Code Editor",
      icon: <Code className="text-success-DEFAULT" size={20} />,
      content: "Click the code button to open the code editor. Write your code, select the appropriate language from the dropdown, and click 'Send Code' to submit it to the AI assistant. The AI will help debug, explain, or improve your code."
    },
    {
      title: "Conversations",
      icon: <MessageSquare className="text-warning-DEFAULT" size={20} />,
      content: "Your conversations are saved automatically. You can view, rename, or delete them from the sidebar. On mobile devices, click the conversation icon in the top-left corner to access your saved conversations."
    },
    {
      title: "Text-to-Speech",
      icon: <HelpCircle className="text-info-DEFAULT" size={20} />,
      content: "The AI's responses can be read aloud using text-to-speech. You can adjust the volume and auto-speak settings in the Settings panel."
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
          <h2 className="text-xl font-medium text-text-primary">How to Use the Programming Teacher</h2>
        </div>

        <div className="space-y-6">
          {helpSections.map((section, index) => (
            <div key={index} className="bg-bg-secondary rounded-lg p-4 border border-border-DEFAULT/30">
              <div className="flex items-center gap-2 mb-2">
                {section.icon}
                <h3 className="text-lg font-medium text-text-primary">{section.title}</h3>
              </div>
              <p className="text-text-secondary">{section.content}</p>
            </div>
          ))}

          <div className="mt-6 text-text-tertiary text-sm space-y-2">
            <p>This Programming Teacher is powered by LiveKit and Groq. It uses speech recognition to transcribe your voice and generate responses.</p>
            <p>The Programming Teacher is designed to help you learn programming concepts, debug code, and answer technical questions. It can explain complex topics in simple terms and provide code examples in various programming languages.</p>
            <p>In <strong>Teacher Mode</strong>, ask the AI to teach you a programming language (e.g., "Teach me Python") and it will create a structured learning path with chapters and exercises. In <strong>Q&A Mode</strong>, it will directly answer your programming questions without the structured approach.</p>
            <p>For the best experience, speak clearly and ask specific questions. You can also use the code editor to share code snippets for more targeted assistance.</p>
          </div>
        </div>
      </div>
    </Modal>
  );
}
