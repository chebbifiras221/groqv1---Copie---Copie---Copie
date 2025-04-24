"use client";

import { useState, KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { Send, Trash2, Code, MessageSquare } from "lucide-react";
import { useConversation } from "@/hooks/use-conversation";
import { useMaybeRoomContext } from "@livekit/components-react";
import { CodeEditorModal } from "./code-editor-modal";
import { motion } from "framer-motion";

export interface TextInputProps {
  isConnected: boolean;
}

export function TextInput({ isConnected }: TextInputProps) {
  const [inputText, setInputText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCodeEditorOpen, setIsCodeEditorOpen] = useState(false);
  const { addUserMessage, clearMessages } = useConversation();
  const room = useMaybeRoomContext();

  const handleSubmit = async () => {
    if (!inputText.trim() || !isConnected) return;

    setIsSubmitting(true);

    try {
      console.log('Sending text input:', inputText.trim());
      await addUserMessage(inputText.trim());

      // Clear the input field immediately for better UX
      setInputText("");
    } catch (error) {
      console.error("Error sending text input:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCodeSubmit = async (code: string, language: string) => {
    if (!code.trim() || !isConnected) return;

    setIsSubmitting(true);

    try {
      const messageToSend = `\`\`\`${language}\n${code}\n\`\`\``;
      console.log('Sending code:', messageToSend);
      await addUserMessage(messageToSend);
    } catch (error) {
      console.error("Error sending code:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const openCodeEditor = () => {
    setIsCodeEditorOpen(true);
  };

  const handleClearMessages = () => {
    if (window.confirm('Are you sure you want to clear all messages?')) {
      clearMessages();
    }
  };

  // Removed createNewConversation function as it's already in ConversationManager

  return (
    <div className="flex flex-col w-full px-6 py-4 gap-2 relative">

      <div className="flex items-center gap-5 w-full max-w-4xl mx-auto flex-nowrap">
        <Button
          onClick={openCodeEditor}
          variant="ghost"
          size="sm"
          className="text-text-secondary hover:text-primary-DEFAULT/90 hover:bg-bg-tertiary/50 inline-flex items-center gap-1.5 px-4 py-2 rounded-md transition-colors duration-150 whitespace-nowrap"
          title="Open code editor"
        >
          <Code size={16} className="flex-shrink-0" />
          <span className="sm:inline hidden">Code</span>
        </Button>

        <div className="relative flex-1">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isConnected ? "Type your message here..." : "Connect to start chatting"}
            disabled={!isConnected || isSubmitting}
            className="w-full bg-bg-primary/80 border border-bg-tertiary/10 rounded-full px-4 py-3.5 text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-1 focus:ring-primary-DEFAULT/30 shadow-none"
            aria-label="Message input"
            autoComplete="off"
          />
        </div>

        <Button
          onClick={handleSubmit}
          disabled={!isConnected || !inputText.trim() || isSubmitting}
          isLoading={isSubmitting}
          variant="primary"
          size="lg"
          className="rounded-full p-3 bg-primary-DEFAULT/80 hover:opacity-90 flex items-center justify-center border border-primary-DEFAULT/20 shadow-none"
          title="Send message"
          aria-label="Send message"
        >
          <Send size={20} aria-hidden="true" />
        </Button>

        <Button
          onClick={handleClearMessages}
          variant="ghost"
          size="sm"
          className="text-text-secondary hover:text-danger-DEFAULT/90 hover:bg-bg-tertiary/70 inline-flex items-center gap-1.5 px-4 py-2 rounded-md whitespace-nowrap"
          title="Clear chat history"
        >
          <Trash2 size={16} className="flex-shrink-0" />
          <span className="sm:inline hidden">Clear Chat</span>
        </Button>
      </div>

      {/* Code Editor Modal */}
      <CodeEditorModal
        isOpen={isCodeEditorOpen}
        onClose={() => setIsCodeEditorOpen(false)}
        onSubmit={handleCodeSubmit}
        isSubmitting={isSubmitting}
        isConnected={isConnected}
      />
    </div>
  );
}
