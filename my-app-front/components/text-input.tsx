"use client";

import { useState, KeyboardEvent, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Send, Trash2, Code, Mic, MicOff } from "lucide-react";
import { useConversation } from "@/hooks/use-conversation";
import { CodeEditorModal } from "./code-editor-modal";
import { useLocalParticipant } from "@livekit/components-react";

/**
 * Text input component props
 */
export interface TextInputProps {
  isConnected: boolean; // WebRTC connection status
}

/**
 * Text Input Component - handles text/voice input with microphone controls
 */
export function TextInput({ isConnected }: TextInputProps) {
  const [inputText, setInputText] = useState("");              // Current input text
  const [isSubmitting, setIsSubmitting] = useState(false);    // Submission loading state
  const [isCodeEditorOpen, setIsCodeEditorOpen] = useState(false); // Code editor modal state
  const [isMicMuted, setIsMicMuted] = useState(true);          // Microphone mute state
  const [isSpacePressed, setIsSpacePressed] = useState(false); // Spacebar press state

  const { addUserMessage, clearMessages } = useConversation(); // Conversation functions
  const { localParticipant } = useLocalParticipant();          // LiveKit participant

  /**
   * Sync microphone state with LiveKit hardware
   */
  useEffect(() => {
    if (localParticipant && typeof localParticipant.isMicrophoneEnabled !== 'undefined') {
      // Set initial state (inverted because we track "muted" not "enabled")
      setIsMicMuted(!localParticipant.isMicrophoneEnabled);

      // Update state when microphone changes
      const handleMicrophoneUpdate = () => {
        setIsMicMuted(!localParticipant.isMicrophoneEnabled);
      };

      // Listen for mute/unmute events
      localParticipant.on('trackMuted', handleMicrophoneUpdate);
      localParticipant.on('trackUnmuted', handleMicrophoneUpdate);

      // Cleanup listeners
      return () => {
        localParticipant.off('trackMuted', handleMicrophoneUpdate);
        localParticipant.off('trackUnmuted', handleMicrophoneUpdate);
      };
    }
  }, [localParticipant]);

  /**
   * Effect hook to track spacebar press for voice input visual feedback.
   * Provides global spacebar detection while avoiding interference with text input.
   */
  useEffect(() => {
    /**
     * Event handler for keydown events to detect spacebar press.
     * Only triggers when not typing in input fields to avoid conflicts.
     *
     * @param {KeyboardEvent} e - Keyboard event from window
     */
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle spacebar key
      if (e.code === 'Space') {
        const target = e.target as HTMLElement;

        // Check if user is currently typing in an input field
        const isInputElement =
          target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable;

        // Only set pressed state if not typing in input field
        if (!isInputElement) {
          setIsSpacePressed(true); // Trigger visual feedback for voice input
        }
      }
    };

    /**
     * Event handler for keyup events to detect spacebar release.
     * Always resets the pressed state regardless of target element.
     *
     * @param {KeyboardEvent} e - Keyboard event from window
     */
    const handleKeyUp = (e: KeyboardEvent) => {
      // Reset pressed state when spacebar is released
      if (e.code === 'Space') {
        setIsSpacePressed(false); // Remove visual feedback
      }
    };

    // Type cast for addEventListener compatibility
    const keyDownHandler = handleKeyDown as any;
    const keyUpHandler = handleKeyUp as any;

    // Add global event listeners for spacebar detection
    window.addEventListener('keydown', keyDownHandler);
    window.addEventListener('keyup', keyUpHandler);

    // Cleanup event listeners to prevent memory leaks
    return () => {
      window.removeEventListener('keydown', keyDownHandler);
      window.removeEventListener('keyup', keyUpHandler);
    };
  }, []); // Empty dependency array - run once on mount

  /**
   * Handles text message submission from the input field.
   * Validates input, manages loading state, and provides user feedback.
   */
  const handleSubmit = async () => {
    // Validate input and connection state before proceeding
    if (!inputText.trim() || !isConnected) return;

    // Set loading state to prevent double submission and show feedback
    setIsSubmitting(true);

    try {
      // Send trimmed message to conversation system
      await addUserMessage(inputText.trim());

      // Clear the input field immediately for better user experience
      setInputText("");
    } catch (error) {
      // Log error for debugging but don't show to user (handled by conversation system)
      console.error("Error sending text input:", error);
    } finally {
      // Always clear loading state regardless of success/failure
      setIsSubmitting(false);
    }
  };

  /**
   * Handles code submission from the code editor modal.
   * Formats code with markdown syntax highlighting and sends as message.
   *
   * @param {string} code - The code content to submit
   * @param {string} language - Programming language for syntax highlighting
   */
  const handleCodeSubmit = async (code: string, language: string) => {
    // Validate code input and connection state before proceeding
    if (!code.trim() || !isConnected) return;

    // Set loading state to prevent double submission
    setIsSubmitting(true);

    try {
      // Format code with markdown code block syntax for proper rendering
      const messageToSend = `\`\`\`${language}\n${code}\n\`\`\``;

      // Send formatted code message to conversation system
      await addUserMessage(messageToSend);
    } catch (error) {
      // Log error for debugging but don't show to user
      console.error("Error sending code:", error);
    } finally {
      // Always clear loading state regardless of success/failure
      setIsSubmitting(false);
    }
  };

  /**
   * Handles keyboard events for the text input field.
   * Enables Enter key submission while preserving Shift+Enter for new lines.
   *
   * @param {KeyboardEvent<HTMLInputElement>} e - Keyboard event from input field
   */
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    // Submit on Enter key, but allow Shift+Enter for multi-line input
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault(); // Prevent default form submission behavior
      handleSubmit(); // Submit the message
    }
  };

  /**
   * Opens the code editor modal for syntax-highlighted code input.
   */
  const openCodeEditor = () => {
    setIsCodeEditorOpen(true); // Show code editor modal
  };

  /**
   * Handles message clearing with user confirmation.
   * Prompts user before clearing to prevent accidental data loss.
   */
  const handleClearMessages = () => {
    // Show confirmation dialog before clearing messages
    if (window.confirm('Are you sure you want to clear all messages?')) {
      clearMessages(); // Clear all conversation messages
    }
  };

  /**
   * Toggles microphone state through LiveKit participant.
   * Directly controls hardware microphone enable/disable.
   */
  const toggleMicrophone = () => {
    // Only proceed if localParticipant exists and has microphone control
    if (localParticipant && localParticipant.setMicrophoneEnabled) {
      const currentState = localParticipant.isMicrophoneEnabled; // Get current state
      localParticipant.setMicrophoneEnabled(!currentState); // Toggle state
    }
  };

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
              placeholder={isConnected ? "Enter your question or topic to begin exploring..." : "Connect to access your personalized learning environment"}
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
            <div className="flex items-center gap-1.5 text-xs text-text-tertiary bg-bg-tertiary/10 px-3 py-1 rounded-full">
              <span className="opacity-80">Press</span>
              <kbd className="px-1.5 py-0.5 rounded bg-bg-tertiary/40 text-text-secondary text-xs font-mono shadow-sm">Space</kbd>
              <span className="opacity-80">for voice input</span>
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
