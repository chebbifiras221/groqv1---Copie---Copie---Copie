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
  conversation_id?: string; // Optional to maintain compatibility with existing code
}

// We're not using localStorage for messages anymore as we clear on startup
// and rely on the backend for conversation storage

export function useConversation() {
  /**
   * Clear localStorage on component mount
   * We don't store messages in localStorage anymore as we rely on the backend
   */
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('conversation-messages');
    }
  }, []);

  // Track the current conversation ID
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);

  // Update the current conversation ID when it changes in localStorage
  useEffect(() => {
    // Initial check
    const newId = localStorage.getItem('current-conversation-id');
    if (newId !== currentConversationId) {
      // Clear messages when switching conversations
      setMessages([]);
      setCurrentConversationId(newId);
      // Initial conversation ID set
    }

    // Set up event listener for storage changes
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'current-conversation-id') {
        const newId = e.newValue;
        if (newId !== currentConversationId) {
          // Clear messages when switching conversations
          setMessages([]);
          setCurrentConversationId(newId);
          // Conversation ID changed
        }
      }
    };

    // Also check periodically in case the storage event doesn't fire
    const checkForConversationChanges = () => {
      const newId = localStorage.getItem('current-conversation-id');
      if (newId !== currentConversationId) {
        // Clear messages when switching conversations
        setMessages([]);
        setCurrentConversationId(newId);
        // Conversation ID changed from interval check
      }
    };

    // Add event listener for storage changes
    window.addEventListener('storage', handleStorageChange);

    // Check for changes every 300ms as a fallback
    const interval = setInterval(checkForConversationChanges, 300);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, [currentConversationId]);

  const [messages, setMessages] = useState<Message[]>([]);
  const room = useMaybeRoomContext();
  const { responses } = useAIResponses();
  const { transcriptions } = useTranscriber();

  /**
   * Trigger conversation loading when room is available
   * This ensures we automatically load conversations when the connection is established
   */
  useEffect(() => {
    if (!room) return;

    // Check if we have a conversation ID in localStorage
    const currentId = localStorage.getItem('current-conversation-id');

    // If we don't have a conversation ID, we'll trigger the conversation manager
    // to load the most recent conversation or create a new one
    if (!currentId) {
      // Request the conversation list from the server
      // The conversation manager will handle creating a new conversation if none exist
      const message = {
        type: "list_conversations"
      };
      room.localParticipant.publishData(
        new TextEncoder().encode(JSON.stringify(message))
      );
    }
  }, [room]);

  // Track the last processed transcription and response
  const [lastProcessedTranscription, setLastProcessedTranscription] = useState<string>('');
  const [lastProcessedResponseId, setLastProcessedResponseId] = useState<string>('');

  // Listen for user message echoes from the backend
  useEffect(() => {
    if (!room) return;

    const handleDataReceived = (payload: Uint8Array, topic?: string) => {
      try {
        // Handle binary audio data with specific topic
        if (topic === "binary_audio") {
          // Received binary audio data with topic 'binary_audio'
          // We'll let the use-ai-responses hook handle the audio playback
          return;
        }

        // Handle audio info with specific topic
        if (topic === "audio_info") {
          const dataString = new TextDecoder().decode(payload);
          const data = JSON.parse(dataString);
          // Received audio info
          return;
        }

        // Try to decode as JSON for other messages
        const dataString = new TextDecoder().decode(payload);
        let data;

        try {
          data = JSON.parse(dataString);

          // Handle audio data info message
          if (data.type === "audio_data_info") {
            // Received audio data info
            return;
          }

          // Handle audio data message
          if (data.type === "audio_data") {
            // Received audio data info
            return;
          }

          // Handle audio URL message
          if (data.type === "tts_audio_url") {
            // Received TTS audio URL for text
            return;
          }
        } catch (e) {
          // If it's not valid JSON, it might be binary audio data without a topic
          // Received possible binary audio data without topic
          // We'll let the use-ai-responses hook handle the audio playback
          return;
        }

        if (data.type === "conversation_data") {
          // Received conversation data from server

          // Clear existing messages and load the conversation messages
          const conversationMessages: Message[] = data.conversation.messages.map((msg: any) => ({
            id: msg.id,
            type: msg.type as MessageType,
            text: msg.content,
            timestamp: new Date(msg.timestamp).getTime(),
            conversation_id: data.conversation.id // Add conversation_id to track which conversation this message belongs to
          }));

          // Replace all messages with the ones from the selected conversation
          setMessages(conversationMessages);

          // Directly update the current conversation ID in state
          setCurrentConversationId(data.conversation.id);

          // Reset tracking variables
          setLastProcessedTranscription('');
          setLastProcessedResponseId('');

          // Store the current conversation ID
          localStorage.setItem('current-conversation-id', data.conversation.id);
        } else if (data.type === "user_message_echo") {
          // Received user message echo from server

          // Get the current conversation ID
          const currentConversationId = localStorage.getItem('current-conversation-id') || data.conversation_id;

          // Add the echoed message to the conversation
          const newMessage: Message = {
            id: `user-echo-${Date.now()}`,
            type: 'user',
            text: data.text,
            timestamp: Date.now(),
            conversation_id: currentConversationId
          };

          // Always add the message - we're clearing history on startup so no need to check for duplicates
          setMessages(prev => {
            const newMessages = [...prev, newMessage];
            // No need to store in localStorage as we're clearing it on startup
            return newMessages;
          });
        } else if (data.type === "ai_response") {
          // Received AI response from server

          // Get the current conversation ID
          const currentConversationId = localStorage.getItem('current-conversation-id') || data.conversation_id;

          // Add the AI response to the conversation
          const newMessage: Message = {
            id: `ai-response-${Date.now()}`,
            type: 'ai',
            text: data.text,
            timestamp: Date.now(),
            conversation_id: currentConversationId
          };

          // Add the AI response to the messages
          setMessages(prev => {
            const newMessages = [...prev, newMessage];
            return newMessages;
          });
        }
      } catch (e) {
        console.error("Error parsing data message:", e);
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

      // We'll let the server handle adding the message to the conversation
      // The message will be added when we receive the echo from the server
      // Processed transcription, waiting for server echo
    }
  }, [transcriptions, lastProcessedTranscription]);

  // Process AI responses and add them to messages
  useEffect(() => {
    // We'll let the server handle adding AI responses to the conversation
    // The message will be added when we receive the AI response from the server
    if (responses.length > 0) {
      const lastResponse = responses[responses.length - 1];

      if (lastResponse.id !== lastProcessedResponseId) {
        setLastProcessedResponseId(lastResponse.id);
        // Processed AI response, waiting for server message
      }
    }
  }, [responses, lastProcessedResponseId]);

  // Add a user message to the conversation
  const addUserMessage = useCallback(async (text: string) => {
    if (!text.trim()) return;

    // Sending text input to backend

    // Send the message to the backend
    if (room) {
      try {
        const message = {
          type: "text_input",
          text: text.trim()
        };

        // We'll wait for the echo from the server to add the message to the conversation
        await room.localParticipant.publishData(new TextEncoder().encode(JSON.stringify(message)));

        // Get the current conversation ID
        const currentConversationId = localStorage.getItem('current-conversation-id');

        // For better UX, we can still return a message object, but it won't be added to the state yet
        return {
          id: `user-pending-${Date.now()}`,
          type: 'user' as MessageType,
          text: text.trim(),
          timestamp: Date.now(),
          conversation_id: currentConversationId || undefined
        };
      } catch (error) {
        console.error("Error sending text input:", error);
      }
    }

    return undefined;
  }, [room]);

  // Clear all messages and create a new conversation
  const clearMessages = useCallback(() => {
    setMessages([]);
    setLastProcessedTranscription('');
    setLastProcessedResponseId('');

    // Clear localStorage
    if (typeof window !== 'undefined') {
      localStorage.removeItem('conversation-messages');
      localStorage.removeItem('current-conversation-id');
    }

    // Reset the current conversation ID
    setCurrentConversationId(null);

    // Create a new conversation
    if (room) {
      const message = {
        type: "new_conversation",
        title: `New Conversation`
      };
      // Creating new conversation from clearMessages
      room.localParticipant.publishData(new TextEncoder().encode(JSON.stringify(message)));
    }
  }, [room]);

  return {
    messages,
    addUserMessage,
    clearMessages,
    currentConversationId
  };
}
