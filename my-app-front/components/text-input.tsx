"use client";

import { useState, KeyboardEvent, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Send, Trash2, Code, Mic, MicOff } from "lucide-react";
import { useConversation } from "@/hooks/use-conversation";
import { CodeEditorModal } from "./code-editor-modal";
import { useLocalParticipant } from "@livekit/components-react";

export interface TextInputProps {
  isConnected: boolean;
}

export function TextInput({ isConnected }: TextInputProps) {
  const [inputText, setInputText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCodeEditorOpen, setIsCodeEditorOpen] = useState(false);
  const [isMicMuted, setIsMicMuted] = useState(true);
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const { addUserMessage, clearMessages } = useConversation();
  const { localParticipant } = useLocalParticipant();

  // Keep track of microphone state
  useEffect(() => {
    if (localParticipant && typeof localParticipant.isMicrophoneEnabled !== 'undefined') {
      setIsMicMuted(!localParticipant.isMicrophoneEnabled);

      // Add event listener for microphone state changes
      const handleMicrophoneUpdate = () => {
        setIsMicMuted(!localParticipant.isMicrophoneEnabled);
      };

      // Listen for track mute/unmute events
      localParticipant.on('trackMuted', handleMicrophoneUpdate);
      localParticipant.on('trackUnmuted', handleMicrophoneUpdate);

      return () => {
        // Clean up event listeners
        localParticipant.off('trackMuted', handleMicrophoneUpdate);
        localParticipant.off('trackUnmuted', handleMicrophoneUpdate);
      };
    }
  }, [localParticipant]);

  // Track spacebar press for animation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        const target = e.target as HTMLElement;
        const isInputElement =
          target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable;

        if (!isInputElement) {
          setIsSpacePressed(true);
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setIsSpacePressed(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown as any);
    window.addEventListener('keyup', handleKeyUp as any);

    return () => {
      window.removeEventListener('keydown', handleKeyDown as any);
      window.removeEventListener('keyup', handleKeyUp as any);
    };
  }, []);

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

  const toggleMicrophone = () => {
    if (localParticipant && localParticipant.setMicrophoneEnabled) {
      const currentState = localParticipant.isMicrophoneEnabled;
      localParticipant.setMicrophoneEnabled(!currentState);
    }
  };

  // Removed createNewConversation function as it's already in ConversationManager

  return (
    <div className="flex flex-col w-full px-6 py-4 gap-2 relative">

      <div className="flex items-center gap-3 w-full max-w-4xl mx-auto flex-nowrap">
        {/* Animated microphone button on the left */}
        <div className="relative">
          {/* Ping animation when mic is active */}
          {!isMicMuted && (
            <div className="absolute inset-0 rounded-full bg-primary-DEFAULT/10 animate-ping-slow" />
          )}

          <div
            className={`relative z-10 transition-all duration-200 ${
              isSpacePressed || !isMicMuted ? 'scale-95' : 'scale-100'
            }`}
          >
            <Button
              onClick={toggleMicrophone}
              variant="ghost"
              size="icon"
              className={`h-10 w-10 rounded-full transition-all duration-200 ${
                !isMicMuted
                  ? "bg-primary-DEFAULT text-white shadow-md"
                  : isSpacePressed
                    ? "bg-bg-tertiary/80"
                    : "bg-bg-tertiary/50 hover:bg-bg-tertiary/70"
              }`}
              title="Toggle microphone"
            >
              {isMicMuted ? (
                <MicOff size={18} className="text-text-secondary" />
              ) : (
                <div className="animate-pulse-slow">
                  <Mic size={18} className="text-white" />
                </div>
              )}
            </Button>
          </div>
        </div>

        <div className="relative flex-1 rounded-lg overflow-hidden shadow-sm bg-bg-primary/90 border border-bg-tertiary/20 hover:border-bg-tertiary/30 transition-all duration-200">
          <div className="flex items-center">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={isConnected ? "What would you like to learn about today?" : "Connect to start your learning session"}
              disabled={!isConnected || isSubmitting}
              className="w-full bg-transparent px-4 py-3.5 text-text-primary placeholder:text-text-tertiary focus:outline-none"
              aria-label="Message input"
              autoComplete="off"
            />

            <div className="flex items-center gap-1 pr-2">
              <Button
                onClick={openCodeEditor}
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-full text-text-secondary hover:text-primary-DEFAULT hover:bg-bg-tertiary/30 transition-colors"
                title="Open code editor"
              >
                <Code size={18} />
              </Button>

              <Button
                onClick={handleSubmit}
                disabled={!isConnected || !inputText.trim() || isSubmitting}
                isLoading={isSubmitting}
                variant="ghost"
                size="icon"
                className={`h-9 w-9 rounded-full flex items-center justify-center transition-colors ${
                  !isConnected || !inputText.trim() || isSubmitting
                    ? "text-text-tertiary"
                    : "text-primary-DEFAULT hover:bg-primary-DEFAULT/20"
                }`}
                title="Send message"
                aria-label="Send message"
              >
                <Send size={18} aria-hidden="true" />
              </Button>
            </div>
          </div>

          {/* Bottom action bar */}
          <div className="flex items-center justify-between px-3 py-1.5 border-t border-bg-tertiary/10 bg-bg-tertiary/5">
            <div className="flex-1"></div>

            {/* Centered Space to speak instruction */}
            <div className="flex items-center gap-1 text-xs text-text-tertiary">
              <span className="opacity-70">Press</span>
              <kbd className="px-1.5 py-0.5 rounded bg-bg-tertiary/30 text-text-secondary text-xs font-mono">Space</kbd>
              <span className="opacity-70">to speak</span>
            </div>

            <div className="flex-1 flex justify-end">
              <Button
                onClick={handleClearMessages}
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs text-text-secondary hover:text-danger-DEFAULT/90 hover:bg-bg-tertiary/30 rounded-md"
                title="Clear chat history"
              >
                <Trash2 size={14} className="mr-1" />
                <span>Clear</span>
              </Button>
            </div>
          </div>
        </div>
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
