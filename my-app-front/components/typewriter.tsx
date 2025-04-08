"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import { motion } from "framer-motion";
import { ConnectionState } from "livekit-client";
import { useTranscriber } from "@/hooks/use-transcriber";
import { useAIResponses, AIResponse } from "@/hooks/use-ai-responses";

export interface TypewriterProps {
  typingSpeed?: number;
}

const emptyText =
  "Voice transcription will appear after you connect and start talking";

export function Typewriter({ typingSpeed = 50 }: TypewriterProps) {
  const [isTyping, setIsTyping] = useState<boolean>(false);
  const { state, transcriptions } = useTranscriber();
  const [displayedText, setDisplayedText] = useState<string>("");
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  
  // AI response typing state
  const [isTypingAI, setIsTypingAI] = useState<boolean>(false);
  const [displayedAIText, setDisplayedAIText] = useState<string>("");
  const [currentAIIndex, setCurrentAIIndex] = useState<number>(0);
  const { responses, isTtsSpeaking, stopSpeaking, speakLastResponse } = useAIResponses();
  const aiText = useMemo(() => responses.length > 0 ? responses[responses.length - 1].text : "", [responses]);
  
  // Track conversation history
  const [conversationHistory, setConversationHistory] = useState<{ type: "user" | "ai", text: string }[]>([]);

  const transcriptionEndRef = useRef<HTMLDivElement>(null);
  const text = useMemo(() =>
    Object.values(transcriptions)
      .toSorted((a, b) => a.firstReceivedTime - b.firstReceivedTime)
      .map((t) => t.text.trim())
      .join("\n"),
    [transcriptions],
  );

  // Update conversation history when transcription changes
  useEffect(() => {
    if (text && text.trim() && text !== displayedText) {
      // Add user message to conversation history when it's complete
      if (!isTyping && currentIndex >= text.length) {
        setConversationHistory(prev => {
          // Check if we already have this text in history
          const exists = prev.some(item => item.type === "user" && item.text === text);
          if (exists) return prev;
          return [...prev, { type: "user", text }];
        });
      }
    }
  }, [text, isTyping, currentIndex, displayedText]);

  // Update conversation history when AI response changes
  useEffect(() => {
    if (responses.length > 0) {
      const lastResponse = responses[responses.length - 1];
      setConversationHistory(prev => {
        // Check if we already have this response in history
        const exists = prev.some(item => item.type === "ai" && item.text === lastResponse.text);
        if (exists) return prev;
        return [...prev, { type: "ai", text: lastResponse.text }];
      });
    }
  }, [responses]);

  useEffect(() => {
    if (text.length === 0) {
      setDisplayedText("");
      setCurrentIndex(0);
      return;
    }

    if (currentIndex < text.length) {
      if (!isTyping) {
        setIsTyping(true);
      }
      const timeout = setTimeout(() => {
        setDisplayedText(text.slice(0, currentIndex) + text[currentIndex]);
        setCurrentIndex((prev) => prev + 1);
        transcriptionEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, typingSpeed);
      return () => clearTimeout(timeout);
    } else {
      setIsTyping(false);
    }
  }, [currentIndex, text, typingSpeed, isTyping]);
  
  // Effect for AI response typing animation
  useEffect(() => {
    if (aiText.length === 0) {
      setDisplayedAIText("");
      setCurrentAIIndex(0);
      return;
    }

    if (currentAIIndex < aiText.length) {
      if (!isTypingAI) {
        setIsTypingAI(true);
      }
      const timeout = setTimeout(() => {
        setDisplayedAIText(aiText.slice(0, currentAIIndex) + aiText[currentAIIndex]);
        setCurrentAIIndex((prev) => prev + 1);
        transcriptionEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, typingSpeed);
      return () => clearTimeout(timeout);
    } else {
      setIsTypingAI(false);
    }
  }, [currentAIIndex, aiText, typingSpeed, isTypingAI]);

  const emptyTextIntro = useMemo(() => {
    return emptyText.split("").map((word, index) => {
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
  }, []);

  return (
    <div className="relative h-full text-lg font-mono pl-3 relative pt-2 pb-16">
      <div className="pointer-events-none h-1/4 absolute top-0 left-0 w-full bg-gradient-to-b from-accent-bg to-transparent"></div>
      {state === ConnectionState.Disconnected && (
        <div className="text-white/40 h-full items-center pb-16 max-w-md flex">
          <p>{emptyTextIntro}</p>
        </div>
      )}
      {state !== ConnectionState.Disconnected && (
        <div className="h-full overflow-y-auto">
          <div className="h-48" />
          {/* Conversation History */}
          <div className="flex flex-col gap-4">
            {conversationHistory.map((item, index) => (
              <motion.div
                key={index}
                className={`mr-2 whitespace-pre-wrap ${item.type === "ai" ? "p-3 bg-white/5 rounded-lg" : ""}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: index * 0.1 }}
              >
                <div className="text-sm text-white/50 mb-1">{item.type === "user" ? "You:" : "Assistant:"}</div>
                <p>{item.text}</p>
              </motion.div>
            ))}
          </div>
          
          {/* Current User transcription */}
          {displayedText && currentIndex < text.length && (
            <motion.div
              className="mr-2 whitespace-pre-wrap mb-4 mt-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.2 }}
            >
              <div className="text-sm text-white/50 mb-1">You:</div>
              <p>
                {displayedText}{" "}
                <motion.span
                  animate={!isTyping && { opacity: [1, 0, 1] }}
                  transition={{ duration: 0.5, delay: 0.2, repeat: Infinity }}
                  className="relative inline-block w-3 h-3 rounded-full bg-white"
                />
              </p>
            </motion.div>
          )}
          
          {/* Current AI response */}
          {aiText.length > 0 && currentAIIndex < aiText.length && (
            <motion.div
              className="mr-2 whitespace-pre-wrap mb-4 p-3 bg-white/5 rounded-lg"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.2 }}
            >
              <div className="flex justify-between items-center mb-1">
                <div className="text-sm text-white/50">Assistant:</div>
                {isTtsSpeaking ? (
                  <button 
                    onClick={stopSpeaking}
                    className="text-xs text-white/50 hover:text-white/80 transition-colors"
                  >
                    Stop TTS
                  </button>
                ) : (
                  <button 
                    onClick={speakLastResponse}
                    className="text-xs text-white/50 hover:text-white/80 transition-colors"
                  >
                    Speak
                  </button>
                )}
              </div>
              <p>
                {displayedAIText}{" "}
                <motion.span
                  animate={!isTypingAI && { opacity: [1, 0, 1] }}
                  transition={{ duration: 0.5, delay: 0.2, repeat: Infinity }}
                  className="relative inline-block w-3 h-3 rounded-full bg-blue-400"
                />
              </p>
            </motion.div>
          )}
          <div ref={transcriptionEndRef} className="h-1/2" />
        </div>
      )}
    </div>
  );
}
