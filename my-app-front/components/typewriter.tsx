"use client";

import { useEffect, useState, useRef } from "react";
import { motion } from "framer-motion";
import { ConnectionState } from "livekit-client";
import { MessageSquare } from "lucide-react";
import { useTranscriber } from "@/hooks/use-transcriber";
import { useAIResponses } from "@/hooks/use-ai-responses";
import { useConversation } from "@/hooks/use-conversation";
import { CodeBlock } from "./code-block";
import { CodeEditor } from "./code-editor";
import { SimpleBotFace } from "./ui/simple-bot-face";

export interface TypewriterProps {
  typingSpeed?: number;
}

const emptyText =
  "Voice transcription will appear after you connect and start talking";

// Regular expression to detect code blocks in markdown format
const codeBlockRegex = /```([\w-]*)?\n([\s\S]*?)\n```/g;

export function Typewriter({ typingSpeed = 50 }: TypewriterProps) {
  // Function to render AI responses with code blocks
  const renderAIResponseWithCodeBlocks = (text: string) => {
    if (!text) return null;

    // Reset regex lastIndex to ensure we start from the beginning
    codeBlockRegex.lastIndex = 0;

    const segments = [];
    let lastIndex = 0;
    let match;
    let segmentId = 0;

    // Find all code blocks in the text
    while ((match = codeBlockRegex.exec(text)) !== null) {
      // Add text before the code block
      if (match.index > lastIndex) {
        segments.push({
          type: 'text',
          content: text.substring(lastIndex, match.index),
          id: segmentId++
        });
      }

      // Add the code block
      segments.push({
        type: 'code',
        language: match[1]?.trim() || 'javascript',
        content: match[2].trim(),
        id: segmentId++
      });

      lastIndex = match.index + match[0].length;
    }

    // Add any remaining text after the last code block
    if (lastIndex < text.length) {
      segments.push({
        type: 'text',
        content: text.substring(lastIndex),
        id: segmentId++
      });
    }

    // If no code blocks were found, return the original text
    if (segments.length === 0) {
      return <p>{text}</p>;
    }

    // Render each segment
    return segments.map(segment => {
      if (segment.type === 'code') {
        return (
          <CodeBlock
            key={segment.id}
            code={segment.content}
            language={segment.language}
          />
        );
      } else {
        return <p key={segment.id}>{segment.content}</p>;
      }
    });
  };

  const { state } = useTranscriber();
  const { isTtsSpeaking, isProcessingTTS, stopSpeaking, speakLastResponse } = useAIResponses();

  // Get conversation messages and current conversation ID from our hook
  const { messages, currentConversationId } = useConversation();
  const conversationContainerRef = useRef<HTMLDivElement>(null);
  const transcriptionEndRef = useRef<HTMLDivElement>(null);

  /**
   * Auto-select the first conversation when the component mounts
   * This ensures that a conversation is loaded automatically when the user connects
   */
  useEffect(() => {
    // Only proceed if we're connected
    if (state !== ConnectionState.Connected) return;

    // Use a short delay to ensure everything is initialized
    const timer = setTimeout(() => {
      // Check if we have a conversation ID in localStorage
      const storedConversationId = localStorage.getItem('current-conversation-id');

      // If we don't have a conversation ID and we're connected, we need to trigger the conversation display
      if (!storedConversationId) {
        // This will force the conversation manager to load the most recent conversation
        // or create a new one if none exist
        const event = new Event('storage');
        window.dispatchEvent(event);
      }
    }, 1000); // 1 second delay

    return () => clearTimeout(timer);
  }, [state]);

  /**
   * Auto-scroll to bottom when new messages arrive
   * This ensures the user always sees the latest messages
   */
  useEffect(() => {
    if (messages.length > 0 && conversationContainerRef.current) {
      if (transcriptionEndRef.current) {
        // Use requestAnimationFrame for smoother scrolling
        requestAnimationFrame(() => {
          transcriptionEndRef.current?.scrollIntoView({ behavior: "smooth" });
        });
      }
    }
  }, [messages]);

  /**
   * Force re-render when messages change
   * This ensures the UI updates properly when new messages arrive
   */
  useEffect(() => {
    // This is just to force a re-render when messages change
    if (messages.length > 0) {
      // Use requestIdleCallback for non-critical updates
      if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
        // @ts-ignore - TypeScript doesn't recognize requestIdleCallback
        window.requestIdleCallback(() => {
          // Messages updated
        });
      }
    }
  }, [messages]);

  // Animation for empty state text
  const emptyTextAnimation = emptyText.split("").map((word, index) => {
    return (
      <motion.span
        initial={{
          opacity: 0,
        }}
        animate={{
          opacity: 1,
        }}
        transition={{
          duration: 0.2,
          delay: index * 0.015,
        }}
        key={index}
      >
        {word}
      </motion.span>
    );
  });

  return (
    <div className="relative h-full text-lg font-mono px-4 md:px-8 pt-6 pb-20 overflow-hidden">

      {state === ConnectionState.Disconnected && (
        <div className="text-text-secondary h-full flex items-center justify-center pb-16 max-w-md mx-auto">
          <p>{emptyTextAnimation}</p>
        </div>
      )}
      {state !== ConnectionState.Disconnected && (
        <div className="h-full overflow-y-auto" ref={conversationContainerRef}>
          <div className="h-12" />
          {/* Conversation History */}
          <div className="flex flex-col gap-8 max-w-4xl mx-auto">
            {messages.length === 0 || !currentConversationId ? (
              <div className="text-text-secondary text-center py-12">
                <div className="mb-4">
                  <MessageSquare className="w-12 h-12 mx-auto text-text-tertiary opacity-30" />
                </div>
                <p className="text-xl">No messages yet</p>
                <p className="text-sm mt-2 text-text-tertiary">Start a conversation by typing a message or using your microphone</p>
              </div>
            ) : (
              messages
                .filter(item => item.conversation_id === currentConversationId)
                .map((item) => (
                <motion.div
                  key={item.id}
                  className={`mb-6 whitespace-pre-wrap ${item.type === "ai" ? "p-6 bg-[#323a45]/40 rounded-lg border-l-2 border-primary-DEFAULT/20" : "px-2"}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.2, ease: "easeOut" }}
                  style={{
                    willChange: "opacity",
                    contain: "content",
                    contentVisibility: "auto"
                  }}
                >
                  <div className="flex items-center gap-2 mb-3">
                    {item.type === "user" ? (
                      <>
                        <div className="w-8 h-8 rounded-full flex items-center justify-center bg-primary-DEFAULT">
                          <span className="text-white font-bold text-xs">You</span>
                        </div>
                      </>
                    ) : (
                      <>
                        <SimpleBotFace size={32} animated={false} />
                        <div className="text-sm text-text-secondary font-medium">
                          Programming Teacher
                        </div>
                      </>
                    )}
                  </div>

                  {item.type === "user" ? (
                    <div className="leading-relaxed pl-10 text-text-primary">{item.text}</div>
                  ) : (
                    <div className="leading-relaxed pl-10 text-text-primary">
                      {renderAIResponseWithCodeBlocks(item.text)}
                    </div>
                  )}

                  {item.type === "ai" && (
                    <div className="flex justify-end mt-4">
                      {isTtsSpeaking ? (
                        <button
                          onClick={stopSpeaking}
                          className="text-xs bg-danger-DEFAULT/90 text-white px-3 py-1.5 rounded-full hover:opacity-90 flex items-center gap-1 border border-danger-DEFAULT/20 shadow-none"
                        >
                          <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>
                          Stop TTS
                        </button>
                      ) : isProcessingTTS ? (
                        <button
                          disabled
                          className="text-xs bg-bg-tertiary/80 text-text-secondary px-3 py-1.5 rounded-full cursor-wait flex items-center gap-1"
                        >
                          <span className="w-2 h-2 bg-text-tertiary rounded-full animate-pulse"></span>
                          Loading...
                        </button>
                      ) : (
                        <button
                          onClick={speakLastResponse}
                          className="text-xs bg-primary-DEFAULT/80 text-white px-3 py-1.5 rounded-full hover:opacity-90 border border-primary-DEFAULT/20 shadow-none"
                        >
                          Speak
                        </button>
                      )}
                    </div>
                  )}
                </motion.div>
              ))
            )}
          </div>
          <div ref={transcriptionEndRef} className="h-24" />
        </div>
      )}
    </div>
  );
}
