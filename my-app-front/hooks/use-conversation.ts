"use client";

import { useState, useCallback, useEffect } from 'react';
import { useMaybeRoomContext } from '@livekit/components-react';
import { useAIResponses } from './use-ai-responses';
import { useTranscriber } from './use-transcriber';

export type MessageType = 'user' | 'ai';

export interface Message {
  id: string;
  type: MessageType;
  text: string;
  timestamp: number;
}

// Helper to get messages from localStorage
const getStoredMessages = (): Message[] => {
  if (typeof window === 'undefined') return [];

  try {
    const stored = localStorage.getItem('conversation-messages');
    return stored ? JSON.parse(stored) : [];
  } catch (e) {
    console.error('Error reading messages from localStorage:', e);
    return [];
  }
};

// Helper to store messages in localStorage
const storeMessages = (messages: Message[]) => {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem('conversation-messages', JSON.stringify(messages));
  } catch (e) {
    console.error('Error storing messages in localStorage:', e);
  }
};

export function useConversation() {
  // Clear localStorage on component mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('conversation-messages');
      console.log('Cleared conversation history from localStorage on startup');
    }
  }, []);

  const [messages, setMessages] = useState<Message[]>([]);
  const room = useMaybeRoomContext();
  const { responses } = useAIResponses();
  const { transcriptions } = useTranscriber();

  // Track the last processed transcription and response
  const [lastProcessedTranscription, setLastProcessedTranscription] = useState<string>('');
  const [lastProcessedResponseId, setLastProcessedResponseId] = useState<string>('');

  // Listen for user message echoes from the backend
  useEffect(() => {
    if (!room) return;

    const handleDataReceived = (payload: Uint8Array) => {
      try {
        const dataString = new TextDecoder().decode(payload);
        const data = JSON.parse(dataString);

        if (data.type === "user_message_echo") {
          console.log("Received user message echo in conversation hook:", data.text);

          // Add the echoed message to the conversation
          const newMessage: Message = {
            id: `user-echo-${Date.now()}`,
            type: 'user',
            text: data.text,
            timestamp: Date.now()
          };

          // Always add the message - we're clearing history on startup so no need to check for duplicates
          setMessages(prev => {
            const newMessages = [...prev, newMessage];
            // No need to store in localStorage as we're clearing it on startup
            return newMessages;
          });
        }
      } catch (e) {
        console.error("Error parsing data message in conversation hook:", e);
      }
    };

    room.on('dataReceived', handleDataReceived);
    return () => {
      room.off('dataReceived', handleDataReceived);
    };
  }, [room]);

  // Process transcriptions and add them to messages
  useEffect(() => {
    const transcriptionText = Object.values(transcriptions)
      .toSorted((a, b) => a.firstReceivedTime - b.firstReceivedTime)
      .map((t) => t.text.trim())
      .join("\n");

    if (transcriptionText && transcriptionText !== lastProcessedTranscription) {
      setLastProcessedTranscription(transcriptionText);

      // Add user message to conversation history
      setMessages(prev => {
        const newMessages = [...prev, {
          type: 'user',
          text: transcriptionText,
          id: `user-voice-${Date.now()}`,
          timestamp: Date.now()
        }];

        return newMessages;
      });
    }
  }, [transcriptions, lastProcessedTranscription]);

  // Process AI responses and add them to messages
  useEffect(() => {
    if (responses.length > 0) {
      const lastResponse = responses[responses.length - 1];

      if (lastResponse.id !== lastProcessedResponseId) {
        setLastProcessedResponseId(lastResponse.id);

        setMessages(prev => {
          // Always add the message - we're clearing history on startup
          const newMessages = [...prev, {
            type: 'ai',
            text: lastResponse.text,
            id: `ai-${lastResponse.id}`,
            timestamp: lastResponse.receivedTime
          }];

          return newMessages;
        });
      }
    }
  }, [responses, lastProcessedResponseId]);

  // Add a user message to the conversation
  const addUserMessage = useCallback(async (text: string) => {
    if (!text.trim()) return;

    console.log('Sending text input to backend:', text.trim());

    // Send the message to the backend
    if (room) {
      try {
        const message = {
          type: "text_input",
          text: text.trim()
        };

        // We'll wait for the echo from the server to add the message to the conversation
        await room.localParticipant.publishData(new TextEncoder().encode(JSON.stringify(message)));

        // For better UX, we can still return a message object, but it won't be added to the state yet
        return {
          id: `user-pending-${Date.now()}`,
          type: 'user' as MessageType,
          text: text.trim(),
          timestamp: Date.now()
        };
      } catch (error) {
        console.error("Error sending text input:", error);
      }
    }

    return undefined;
  }, [room]);

  // Clear all messages
  const clearMessages = useCallback(() => {
    setMessages([]);
    setLastProcessedTranscription('');
    setLastProcessedResponseId('');

    // Clear localStorage
    if (typeof window !== 'undefined') {
      localStorage.removeItem('conversation-messages');
    }
  }, []);

  return {
    messages,
    addUserMessage,
    clearMessages
  };
}
