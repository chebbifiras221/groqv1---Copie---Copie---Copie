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
  // Clear localStorage on component mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('conversation-messages');
      console.log('Cleared conversation history from localStorage on startup');
    }
  }, []);

  // Track the current conversation ID
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);

  // Update the current conversation ID when it changes in localStorage
  useEffect(() => {
    const checkForConversationChanges = () => {
      const newId = localStorage.getItem('current-conversation-id');
      if (newId !== currentConversationId) {
        setCurrentConversationId(newId);
      }
    };

    // Check for changes every 500ms
    const interval = setInterval(checkForConversationChanges, 500);

    return () => clearInterval(interval);
  }, [currentConversationId]);

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

    const handleDataReceived = (payload: Uint8Array, topic?: string) => {
      try {
        // Handle binary audio data with specific topic
        if (topic === "binary_audio") {
          console.log("Received binary audio data with topic 'binary_audio'", payload.length);
          // We'll let the use-ai-responses hook handle the audio playback
          return;
        }

        // Handle audio info with specific topic
        if (topic === "audio_info") {
          const dataString = new TextDecoder().decode(payload);
          const data = JSON.parse(dataString);
          console.log("Received audio info:", data);
          return;
        }

        // Try to decode as JSON for other messages
        const dataString = new TextDecoder().decode(payload);
        let data;

        try {
          data = JSON.parse(dataString);

          // Handle audio data info message
          if (data.type === "audio_data_info") {
            console.log("Received audio data info:", data);
            return;
          }

          // Handle audio data message
          if (data.type === "audio_data") {
            console.log("Received audio data info");
            return;
          }

          // Handle audio URL message
          if (data.type === "tts_audio_url") {
            console.log("Received TTS audio URL for text:", data.text);
            return;
          }
        } catch (e) {
          // If it's not valid JSON, it might be binary audio data without a topic
          console.log("Received possible binary audio data without topic", payload.length);
          // We'll let the use-ai-responses hook handle the audio playback
          return;
        }

        if (data.type === "conversation_data") {
          console.log("Received conversation data in conversation hook", data.conversation.id);

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

          // Reset tracking variables
          setLastProcessedTranscription('');
          setLastProcessedResponseId('');

          // Store the current conversation ID
          localStorage.setItem('current-conversation-id', data.conversation.id);
        } else if (data.type === "user_message_echo") {
          console.log("Received user message echo in conversation hook:", data.text);

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
          console.log("Received AI response in conversation hook:", data.text.substring(0, 30) + '...');

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

      // Get the current conversation ID
      const currentConversationId = localStorage.getItem('current-conversation-id');

      if (currentConversationId) {
        // Add user message to conversation history
        setMessages(prev => {
          const newMessages = [...prev, {
            type: 'user',
            text: transcriptionText,
            id: `user-voice-${Date.now()}`,
            timestamp: Date.now(),
            conversation_id: currentConversationId
          }];

          return newMessages;
        });
      }
    }
  }, [transcriptions, lastProcessedTranscription]);

  // Process AI responses and add them to messages
  useEffect(() => {
    if (responses.length > 0) {
      const lastResponse = responses[responses.length - 1];

      if (lastResponse.id !== lastProcessedResponseId) {
        setLastProcessedResponseId(lastResponse.id);

        // Get the current conversation ID
        const currentConversationId = localStorage.getItem('current-conversation-id');

        if (currentConversationId) {
          // Create the new message object
          const newMessage = {
            type: 'ai' as MessageType,
            text: lastResponse.text,
            id: `ai-${lastResponse.id}`,
            timestamp: lastResponse.receivedTime,
            conversation_id: currentConversationId
          };

          // Update messages state immediately
          setMessages(prev => [...prev, newMessage]);

          // Log for debugging
          console.log('Added AI response to messages:', newMessage.text.substring(0, 30) + '...');
        }
      }
    }
  }, [responses]);  // Removed lastProcessedResponseId from dependencies to ensure updates

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

  // Clear all messages
  const clearMessages = useCallback(() => {
    setMessages([]);
    setLastProcessedTranscription('');
    setLastProcessedResponseId('');

    // Clear localStorage
    if (typeof window !== 'undefined') {
      localStorage.removeItem('conversation-messages');
    }

    // Create a new conversation
    if (room) {
      const message = {
        type: "new_conversation",
        title: `New Conversation`
      };
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
