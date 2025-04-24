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
      content: "The AI's responses can be read aloud using text-to-speech. Click the 'Speak' button on any AI response to hear it. You can adjust the volume and voice in the settings."
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
            <p>For the best experience, speak clearly and ask specific questions. You can also use the code editor to share code snippets for more targeted assistance.</p>
          </div>
        </div>
      </div>
    </Modal>
  );
}
