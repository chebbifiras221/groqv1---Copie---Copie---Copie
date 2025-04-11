"use client";

import { useEffect, useState, useRef } from "react";
import { motion } from "framer-motion";
import { ConnectionState } from "livekit-client";
import { useTranscriber } from "@/hooks/use-transcriber";
import { useAIResponses } from "@/hooks/use-ai-responses";
import { useConversation } from "@/hooks/use-conversation";

export interface TypewriterProps {
  typingSpeed?: number;
}

const emptyText =
  "Voice transcription will appear after you connect and start talking";

export function Typewriter({ typingSpeed = 50 }: TypewriterProps) {
  const { state } = useTranscriber();
  const { isTtsSpeaking, isProcessingTTS, stopSpeaking, speakLastResponse } = useAIResponses();

  // Get conversation messages and current conversation ID from our hook
  const { messages, currentConversationId } = useConversation();
  const conversationContainerRef = useRef<HTMLDivElement>(null);
  const transcriptionEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messages.length > 0 && conversationContainerRef.current) {
      if (transcriptionEndRef.current) {
        transcriptionEndRef.current.scrollIntoView({ behavior: "smooth" });
      }
    }
  }, [messages]);

  // Force re-render when messages change
  useEffect(() => {
    // This is just to force a re-render when messages change
    console.log('Messages updated, total count:', messages.length);
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
    <div className="relative h-full text-lg font-mono pl-4 pr-4 relative pt-4 pb-20">
      <div className="pointer-events-none h-1/4 absolute top-0 left-0 w-full bg-gradient-to-b from-accent-bg to-transparent z-10"></div>
      {state === ConnectionState.Disconnected && (
        <div className="text-white/40 h-full items-center pb-16 max-w-md flex">
          <p>{emptyTextAnimation}</p>
        </div>
      )}
      {state !== ConnectionState.Disconnected && (
        <div className="h-full overflow-y-auto" ref={conversationContainerRef}>
          <div className="h-48" />
          {/* Conversation History */}
          <div className="flex flex-col gap-4">
            {messages.length === 0 || !currentConversationId ? (
              <div className="text-white/50">No messages yet</div>
            ) : (
              messages
                .filter(item => !item.conversation_id || item.conversation_id === currentConversationId)
                .map((item) => (
                <motion.div
                  key={item.id}
                  className={`mb-6 whitespace-pre-wrap ${item.type === "ai" ? "p-4 bg-white/5 rounded-lg" : ""}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="text-sm text-white/50 mb-2 font-semibold">{item.type === "user" ? "You:" : "AI:"}</div>
                  <p className="leading-relaxed">{item.text}</p>
                  {item.type === "ai" && (
                    <div className="flex justify-end mt-3">
                      {isTtsSpeaking ? (
                        <button
                          onClick={stopSpeaking}
                          className="text-xs text-white/50 hover:text-white/80 transition-colors px-2 py-1 rounded hover:bg-white/10"
                        >
                          Stop TTS
                        </button>
                      ) : isProcessingTTS ? (
                        <button
                          disabled
                          className="text-xs text-white/30 px-2 py-1 rounded bg-white/5 cursor-wait"
                        >
                          Loading...
                        </button>
                      ) : (
                        <button
                          onClick={speakLastResponse}
                          className="text-xs text-white/50 hover:text-white/80 transition-colors px-2 py-1 rounded hover:bg-white/10"
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
