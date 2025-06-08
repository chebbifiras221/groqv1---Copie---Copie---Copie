"use client";

import { useState, useCallback, useEffect } from 'react';
import { useMaybeRoomContext } from '@livekit/components-react';
import { ConnectionState, Room } from 'livekit-client';
import { useAIResponses } from './use-ai-responses';
import { useTranscriber } from './use-transcriber';
import { useAuth } from './use-auth';

// Import isRoomConnected from conversation-utils to avoid duplication
import { isRoomConnected } from '@/utils/conversation-utils';

export type MessageType = 'user' | 'ai';

export interface Message {
  id: string;
  type: MessageType;
  text: string;
  timestamp: number;
  conversation_id?: string; // Optional to maintain compatibility with existing code
  // Properties for multi-part messages
  isPart?: boolean;
  partNumber?: number;
  totalParts?: number;
  isFinal?: boolean;
  // Property for error handling
  error?: boolean;
}

// We're not using localStorage for messages anymore as we clear on startup
// and rely on the backend for conversation storage

export function useConversation() {
  // Get the current user
  const { user } = useAuth();
  /**
   * Clear localStorage on component mount
   * We don't store messages in localStorage anymore as we rely on the backend
   */
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('conversation-messages');

      // Listen for user logout events
      const handleUserLogout = () => {
        // Clear messages when the user logs out
        setMessages([]);
        setCurrentConversationId(null);
      };

      window.addEventListener('user-logged-out', handleUserLogout);

      return () => {
        window.removeEventListener('user-logged-out', handleUserLogout);
      };
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

    // Listen for mode switch events to clear messages
    const handleModeSwitch = () => {
      // Clear messages when switching modes
      setMessages([]);
      setLastProcessedTranscription('');
      setLastProcessedResponseId('');

      // Clear the current conversation ID to force creating a new one
      setCurrentConversationId(null);
      localStorage.removeItem('current-conversation-id');
    };

    window.addEventListener('create-new-conversation-for-mode-switch', handleModeSwitch);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('create-new-conversation-for-mode-switch', handleModeSwitch);
      clearInterval(interval);
    };
  }, [currentConversationId]);

  const [messages, setMessages] = useState<Message[]>([]);
  const room = useMaybeRoomContext();
  const { responses } = useAIResponses();
  const { transcriptions } = useTranscriber();

  /**
   * We don't need to trigger conversation loading here anymore
   * The conversation-manager component handles this now
   * This hook just listens for changes to the current conversation ID
   */
  useEffect(() => {
    // This effect is intentionally empty
    // The conversation-manager component handles loading conversations
    // and creating a new conversation on initial connection
  }, [room]);

  // Track the last processed transcription and response
  const [lastProcessedTranscription, setLastProcessedTranscription] = useState<string>('');
  const [lastProcessedResponseId, setLastProcessedResponseId] = useState<string>('');

  // Helper function to get the current conversation's teaching mode
  const getCurrentConversationMode = useCallback((): string | null => {
    // Get the current conversation ID from localStorage
    const storedConversationId = localStorage.getItem('current-conversation-id');

    // Try to get the mode from the current conversation
    if (storedConversationId) {
      try {
        // First try to get it from the state if available
        if (currentConversationId === storedConversationId) {
          // Check localStorage for conversation data
          const conversationData = localStorage.getItem(`conversation-${storedConversationId}`);
          if (conversationData) {
            try {
              const parsedData = JSON.parse(conversationData);
              if (parsedData && parsedData.teaching_mode) {
                return parsedData.teaching_mode;
              }
            } catch (parseError) {
              // Silently handle parsing errors
            }
          }
        }

        // If we can't get it from state, try to infer it from settings
        // This is a fallback and might not be accurate
        const storedSettings = localStorage.getItem("app-settings");
        if (storedSettings) {
          const parsedSettings = JSON.parse(storedSettings);
          if (parsedSettings && parsedSettings.teachingMode) {
            return parsedSettings.teachingMode;
          }
        }
      } catch (e) {
        // Silently handle errors getting conversation mode
      }
    }

    // Default to teacher mode if we can't determine
    return 'teacher';
  }, [currentConversationId]);

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

          // Check if this is part of a multi-part message
          // Use optional chaining to safely access properties
          const isPart = data.is_part === true;
          const partNumber = data.part_number || 1;
          const totalParts = data.total_parts || 1;
          const isFinal = data.is_final === true;

          // Create a unique ID for this message
          // For multi-part messages, include the part number in the ID
          const messageId = isPart
            ? `ai-response-part-${partNumber}-of-${totalParts}-${Date.now()}`
            : `ai-response-${Date.now()}`;

          // Add the AI response to the conversation
          const newMessage: Message = {
            id: messageId,
            type: 'ai',
            text: data.text || '',
            timestamp: Date.now(),
            conversation_id: currentConversationId,
            // Add metadata for multi-part messages with default values
            isPart: isPart || false,
            partNumber: partNumber || 1,
            totalParts: totalParts || 1,
            isFinal: isFinal || true
          };

          // Add the AI response to the messages, but check for duplicates first
          setMessages(prev => {
            // Check if this is a duplicate message (same text content)
            const isDuplicate = prev.some(msg =>
              msg.type === 'ai' &&
              msg.text === data.text &&
              Date.now() - msg.timestamp < 5000 // Only check messages from the last 5 seconds
            );

            // If it's a duplicate, don't add it
            if (isDuplicate) {
              return prev;
            }

            // If the message is empty, add a placeholder
            if (!data.text || !data.text.trim()) {
              newMessage.text = ' '; // Add a space to prevent rendering issues
            }

            const newMessages = [...prev, newMessage];
            return newMessages;
          });
        }
      } catch (e) {
        // Silently handle data parsing errors
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
        // Get the current teaching mode from settings
        let teachingMode = 'teacher'; // Default to teacher mode
        try {
          const storedSettings = localStorage.getItem("app-settings");
          if (storedSettings) {
            const parsedSettings = JSON.parse(storedSettings);
            teachingMode = parsedSettings.teachingMode || 'teacher';
          }
        } catch (e) {
          // Silently handle settings parsing errors
        }

        // Get the current conversation ID from localStorage
        const storedConversationId = localStorage.getItem('current-conversation-id');

        // Check if we need to create a new conversation for this message
        // This happens when there's no conversation or the current conversation mode doesn't match the current teaching mode
        const currentMode = getCurrentConversationMode();

        // Always force a new conversation if we don't have a valid stored ID
        // This ensures we don't try to send messages to non-existent conversations
        const needsNewConversation = !storedConversationId ||
          storedConversationId === 'null' ||
          storedConversationId === 'undefined' ||
          (storedConversationId && teachingMode !== currentMode);



        const message = {
          type: "text_input",
          text: text.trim(),
          teaching_mode: teachingMode,
          new_conversation: needsNewConversation,
          user_id: user?.id // Include user ID for data isolation
        };

        // Check if the room is connected before attempting to publish
        if (room.state !== ConnectionState.Connected) {
          // Room not connected, attempting to reconnect

          // Wait for the room to reconnect (up to 5 seconds)
          for (let i = 0; i < 5; i++) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            if (isRoomConnected(room)) {
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
            // Publish attempt failed, will retry

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
        // Error sending text input - message will appear with error indicator
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
  }, [room, currentConversationId, getCurrentConversationMode, user]);

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
      // Get the current teaching mode from settings
      let teachingMode = 'teacher'; // Default to teacher mode
      try {
        const storedSettings = localStorage.getItem("app-settings");
        if (storedSettings) {
          const parsedSettings = JSON.parse(storedSettings);
          teachingMode = parsedSettings.teachingMode || 'teacher';
        }
      } catch (e) {
        // Silently handle settings parsing errors
      }

      const message = {
        type: "new_conversation",
        title: `New Conversation`,
        teaching_mode: teachingMode
      };

      // Use a safe approach with connection checking and retry logic
      const createNewConversation = async () => {
        try {
          // Check if the room is connected before attempting to publish
          if (room.state !== ConnectionState.Connected) {
            // Room not connected, waiting before creating new conversation
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
              break; // Success, exit the loop
            } catch (publishError) {
              retryCount++;
              // Publish attempt failed, will retry

              if (retryCount >= maxRetries) {
                throw publishError; // Rethrow after max retries
              }

              // Wait with exponential backoff before retrying
              const delay = 300 * Math.pow(2, retryCount - 1);
              await new Promise(resolve => setTimeout(resolve, delay));
            }
          }
        } catch (error) {
          // Silently handle conversation creation errors
        }
      };

      // Start the process
      createNewConversation();
    }
  }, [room]);

  // Function to send a hidden instruction to the AI without showing it in the chat
  const sendHiddenInstruction = useCallback((text: string) => {
    if (!room) return;

    try {
      // Get the current teaching mode from settings
      let teachingMode = 'teacher'; // Default to teacher mode
      try {
        const storedSettings = localStorage.getItem("app-settings");
        if (storedSettings) {
          const parsedSettings = JSON.parse(storedSettings);
          teachingMode = parsedSettings.teachingMode || 'teacher';
        }
      } catch (e) {
        // Silently handle settings parsing errors
      }

      // Get the current conversation ID from localStorage
      const storedConversationId = localStorage.getItem('current-conversation-id');

      // Check if we need to create a new conversation for this message
      // This happens when there's no conversation or the current conversation mode doesn't match the current teaching mode
      const currentMode = getCurrentConversationMode();

      // Always force a new conversation if we don't have a valid stored ID
      // This ensures we don't try to send messages to non-existent conversations
      const needsNewConversation = !storedConversationId ||
        storedConversationId === 'null' ||
        storedConversationId === 'undefined' ||
        (storedConversationId && teachingMode !== currentMode);



      // Create a message with a special flag indicating it's a hidden instruction
      const message = {
        type: "text_input",
        text: text.trim(),
        teaching_mode: teachingMode,
        hidden: true, // This flag tells the backend not to echo the message back
        new_conversation: needsNewConversation,
        user_id: user?.id // Include user ID for data isolation
      };

      // Send the message to the backend
      if (room.state === ConnectionState.Connected) {
        room.localParticipant.publishData(
          new TextEncoder().encode(JSON.stringify(message))
        );
      }
    } catch (error) {
      // Silently handle hidden instruction errors
    }
  }, [room, currentConversationId, getCurrentConversationMode, user]);

  return {
    messages,
    addUserMessage,
    sendTextMessage: addUserMessage, // Export addUserMessage as sendTextMessage for backward compatibility
    sendHiddenInstruction, // Export the new function
    clearMessages,
    currentConversationId
  };
}
