"use client";

import { useState, useCallback, useEffect } from 'react';
import { useMaybeRoomContext } from '@livekit/components-react';
import { ConnectionState, Room } from 'livekit-client';
import { useAIResponses } from './use-ai-responses';
import { useTranscriber } from './use-transcriber';

// Helper function to check if a room is connected
// This avoids TypeScript errors with ConnectionState comparison
function isRoomConnected(room: Room): boolean {
  return room.state === ConnectionState.Connected;
}

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

      // Use a safe approach with connection checking and error handling
      const loadConversations = async () => {
        try {
          // Check if the room is connected before attempting to publish
          if (room.state !== ConnectionState.Connected) {
            console.log('Room not connected, waiting before loading conversations...');
            // Wait for the room to connect before trying to load conversations
            setTimeout(loadConversations, 1000);
            return;
          }

          // Safely publish the data
          await room.localParticipant.publishData(
            new TextEncoder().encode(JSON.stringify(message))
          );
          console.log('Successfully requested conversation list');
        } catch (error) {
          console.error('Error requesting conversation list:', error);
          // Retry after a delay if there was an error
          setTimeout(loadConversations, 2000);
        }
      };

      // Start the process with a small delay to ensure connection is stable
      setTimeout(loadConversations, 500);
    }
  }, [room]);

  // Track the last processed transcription and response
  const [lastProcessedTranscription, setLastProcessedTranscription] = useState<string>('');
  const [lastProcessedResponseId, setLastProcessedResponseId] = useState<string>('');

  // Listen for user message echoes from the backend
  useEffect(() => {
    if (!room) return;

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const handleDataReceived = (payload: any, _participant?: any, _kind?: any, topic?: any) => {
      try {
        // Handle binary audio data with specific topic
        if (topic === "binary_audio") {
          // Received binary audio data with topic 'binary_audio'
          // We'll let the use-ai-responses hook handle the audio playback
          return;
        }

        // Handle audio info with specific topic
        if (topic === "audio_info") {
          // Just decode the data but don't process it further
          // We're just acknowledging we received it
          new TextDecoder().decode(payload);
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
    if (room) {
      try {
        const message = {
          type: "text_input",
          text: text.trim()
        };

        // Check if the room is connected before attempting to publish
        if (room.state !== ConnectionState.Connected) {
          console.warn('Room not connected, attempting to reconnect...');

          // Wait for the room to reconnect (up to 5 seconds)
          for (let i = 0; i < 5; i++) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            if (isRoomConnected(room)) {
              console.log('Room reconnected successfully');
              break;
            }

            // If we've waited 5 seconds and still not connected, throw an error
            if (i === 4) {
              throw new Error('Room failed to reconnect after 5 seconds');
            }
          }
        }

        // We'll wait for the echo from the server to add the message to the conversation
        // Use a try-catch with retry logic for more robust publishing
        let retryCount = 0;
        const maxRetries = 3;

        while (retryCount < maxRetries) {
          try {
            await room.localParticipant.publishData(new TextEncoder().encode(JSON.stringify(message)));
            break; // Success, exit the loop
          } catch (publishError) {
            retryCount++;
            console.warn(`Publish attempt ${retryCount} failed:`, publishError);

            if (retryCount >= maxRetries) {
              throw publishError; // Rethrow after max retries
            }

            // Wait with exponential backoff before retrying
            const delay = 300 * Math.pow(2, retryCount - 1);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }

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
        // Add user-visible error handling here if needed
        // The message will still appear in the UI but with an error indicator
        const currentConversationId = localStorage.getItem('current-conversation-id');
        return {
          id: `user-error-${Date.now()}`,
          type: 'user' as MessageType,
          text: text.trim(),
          timestamp: Date.now(),
          conversation_id: currentConversationId || undefined,
          error: true
        };
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

      // Use a safe approach with connection checking and retry logic
      const createNewConversation = async () => {
        try {
          // Check if the room is connected before attempting to publish
          if (room.state !== ConnectionState.Connected) {
            console.warn('Room not connected, waiting before creating new conversation...');
            // Wait for the room to connect before trying to create a new conversation
            setTimeout(createNewConversation, 1000);
            return;
          }

          // Use a try-catch with retry logic for more robust publishing
          let retryCount = 0;
          const maxRetries = 3;

          while (retryCount < maxRetries) {
            try {
              await room.localParticipant.publishData(new TextEncoder().encode(JSON.stringify(message)));
              console.log('Successfully created new conversation');
              break; // Success, exit the loop
            } catch (publishError) {
              retryCount++;
              console.warn(`Publish attempt ${retryCount} failed:`, publishError);

              if (retryCount >= maxRetries) {
                throw publishError; // Rethrow after max retries
              }

              // Wait with exponential backoff before retrying
              const delay = 300 * Math.pow(2, retryCount - 1);
              await new Promise(resolve => setTimeout(resolve, delay));
            }
          }
        } catch (error) {
          console.error('Error creating new conversation:', error);
        }
      };

      // Start the process
      createNewConversation();
    }
  }, [room]);

  return {
    messages,
    addUserMessage,
    clearMessages,
    currentConversationId
  };
}
