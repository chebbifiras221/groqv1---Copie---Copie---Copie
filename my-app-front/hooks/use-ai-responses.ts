import { useEffect, useState, useCallback } from "react";
import {
  useConnectionState,
  useMaybeRoomContext,
} from "@livekit/components-react";
import { RoomEvent, RemoteParticipant, DataPacket_Kind } from "livekit-client";
import { useWebTTS } from "./use-web-tts";
import { useSettings } from "./use-settings";
import { useErrorHandler } from "./use-error-handler";

export interface AIResponse {
  id: string;
  text: string;
  receivedTime: number;
  conversationId?: string; // Track which conversation this response belongs to
}

// Track the last response to prevent duplicates
let lastResponseText = '';
let lastResponseTime = 0;

// Track which messages have been spoken to prevent repeats
let spokenMessages = new Map<string, number>();

// Function to create a unique hash for a message
const createMessageHash = (text: string): string => {
  // Use first 100 chars as a unique identifier
  return text.substring(0, 100);
};

/**
 * Custom hook for handling AI responses and text-to-speech functionality
 *
 * This hook manages the reception and processing of AI responses from the server,
 * as well as controlling text-to-speech playback for these responses.
 */
export function useAIResponses() {
  const state = useConnectionState();
  const room = useMaybeRoomContext();
  const { settings } = useSettings(); // Access settings for TTS configuration
  const [responses, setResponses] = useState<AIResponse[]>([]);
  const [isTtsSpeaking, setIsTtsSpeaking] = useState(false);
  const webTTS = useWebTTS();
  const { handleError } = useErrorHandler();

  // Sync isTtsSpeaking state with webTTS.isPlaying
  useEffect(() => {
    setIsTtsSpeaking(webTTS.isPlaying);
  }, [webTTS.isPlaying]);

  /**
   * Select a high-quality female voice for text-to-speech when voices are loaded
   *
   * This effect runs when the available voices list changes and attempts to select
   * the best available female voice based on a priority list.
   */
  useEffect(() => {
    if (webTTS.voices && webTTS.voices.length > 0) {
      // List all available voices in the console for debugging
      webTTS.listAvailableVoices();

      // Priority list of preferred female voices across different platforms
      const femaleVoices = [
        'Zira',       // Microsoft Zira (Windows)
        'Female',     // Any voice with 'Female' in the name
        'Samantha',   // macOS/iOS
        'Victoria',   // macOS
        'Karen',      // macOS
        'Moira',      // macOS
        'Aria',       // Microsoft
        'Jenny',      // Microsoft
        'Sarah'       // Microsoft
      ];

      // Try each voice in order until one is found
      for (const voiceName of femaleVoices) {
        if (webTTS.selectVoiceByName(voiceName)) {
          break;
        }
      }
    }
  }, [webTTS.voices, webTTS.listAvailableVoices, webTTS.selectVoiceByName]);

  /**
   * Function to manually speak the last AI response using text-to-speech
   *
   * This function is triggered when the user clicks the 'Speak' button for an AI response.
   * It includes logic to prevent duplicate speech requests and manages the TTS state.
   * Now conversation-aware to only speak responses from the current conversation.
   */
  const speakLastResponse = useCallback(() => {
    if (responses.length > 0) {
      // Get the current conversation ID
      const currentConversationId = localStorage.getItem('current-conversation-id');

      // Filter responses to only include those from the current conversation
      const currentConversationResponses = responses.filter(response =>
        response.conversationId === currentConversationId
      );

      if (currentConversationResponses.length > 0) {
        // Get the most recent response from the current conversation
        const lastResponse = currentConversationResponses[currentConversationResponses.length - 1];

        // Create a hash of the message for tracking
        const messageHash = createMessageHash(lastResponse.text);
        const currentTime = Date.now();

        // For manual speaking, we'll allow it even if it was recently spoken automatically
        // But we'll still check for rapid duplicate clicks (within 1 second)
        const isDuplicate =
          lastResponse.text === lastResponseText &&
          (currentTime - lastResponseTime) < 1000;

        if (!isDuplicate) {
          // Update last response tracking
          lastResponseText = lastResponse.text;
          lastResponseTime = currentTime;

          // Clear any existing speech
          webTTS.stopSpeaking();

          // Update the spoken messages map with this message and timestamp
          spokenMessages.set(messageHash, currentTime);

          // Add a small delay to ensure any other audio has stopped
          setTimeout(() => {
            try {
              // Use web speech to speak the response
              webTTS.speak(lastResponse.text);
            } catch (error) {
              handleError(error, 'audio', 'Failed to play text-to-speech');
            }
          }, 100);
        }
      }
    }
  }, [responses, webTTS, handleError]);

  /**
   * Function to stop any currently playing text-to-speech
   */
  const stopSpeaking = useCallback(() => {
    try {
      webTTS.stopSpeaking();
      setIsTtsSpeaking(false);
    } catch (error) {
      handleError(error, 'audio', 'Failed to stop text-to-speech');
    }
  }, [webTTS, handleError]);

  // Function to clear the spoken messages tracking
  const clearSpokenMessages = useCallback(() => {
    spokenMessages.clear();
  }, []);

  // Helper function to handle binary audio data
  const handleBinaryAudio = useCallback((payload: Uint8Array) => {
    // Only play audio if it's a substantial payload (not a small JSON message)
    if (payload.length > 100) {
      try {
        const audioBlob = new Blob([payload], { type: "audio/mp3" });
        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);
        audio.play().catch(() => {
          // Silently handle audio play errors
          URL.revokeObjectURL(audioUrl);
        });
        audio.onended = () => URL.revokeObjectURL(audioUrl);
      } catch (error) {
        handleError(error, 'audio', 'Failed to play binary audio');
      }
    }
  }, [handleError]);

  useEffect(() => {
    if (!room) {
      return;
    }

    const handleDataReceived = (payload: Uint8Array, _participant?: RemoteParticipant, _kind?: DataPacket_Kind, topic?: string) => {
      try {
        // Handle binary audio data with specific topic
        if (topic === "binary_audio") {
          handleBinaryAudio(payload);
          return;
        }

        // Handle audio info with specific topic - just acknowledge receipt
        if (topic === "audio_info") {
          return;
        }

        // Try to decode as JSON for other messages
        try {
          const dataString = new TextDecoder().decode(payload);
          const data = JSON.parse(dataString);

          if (data.type === "web_tts") {
            // This is a web TTS message from the server
            // Create a hash of the message to track if we've spoken it before
            const messageHash = createMessageHash(data.text);
            const currentTime = Date.now();

            // Check if we've spoken this message recently (within 5 seconds)
            const lastSpokenTime = spokenMessages.get(messageHash);
            const isRecentlySpoken = lastSpokenTime && (currentTime - lastSpokenTime < 5000);

            if (isRecentlySpoken) {
              return;
            }

            // Update the spoken messages map with this message and timestamp
            spokenMessages.set(messageHash, currentTime);

            // Clean up old messages from the map (older than 10 seconds)
            for (const [hash, timestamp] of spokenMessages.entries()) {
              if (currentTime - timestamp > 10000) {
                spokenMessages.delete(hash);
              }
            }

            // Stop any existing speech before starting new one
            webTTS.stopSpeaking();

            // Add a small delay to ensure any other audio has stopped
            setTimeout(() => {
              webTTS.speak(data.text);
            }, 100);
            return;
          } else if (data.type === "ai_response" && data.text) {
            const currentTime = Date.now();

            // Check for duplicate responses (same text within 3 seconds)
            const isDuplicate =
              data.text === lastResponseText &&
              (currentTime - lastResponseTime) < 3000;

            if (!isDuplicate) {
              // Update last response tracking
              lastResponseText = data.text;
              lastResponseTime = currentTime;

              const newResponse = {
                id: data.id || currentTime.toString(), // Use provided ID or fallback to timestamp
                text: data.text,
                receivedTime: currentTime,
                conversationId: data.conversation_id || localStorage.getItem('current-conversation-id'), // Track conversation context
              };

              setResponses((prev) => [...prev, newResponse]);

              // Auto-speak if enabled in settings
              if (webTTS && settings.autoSpeak) {
                try {
                  // Create a hash for tracking
                  const messageHash = createMessageHash(data.text);
                  spokenMessages.set(messageHash, currentTime);

                  // Add a small delay to ensure any other audio has stopped
                  setTimeout(() => {
                    webTTS.speak(data.text);
                  }, 100);
                } catch (speakError) {
                  handleError(speakError, 'audio', 'Failed to auto-speak response');
                }
              }
            }
          }
        } catch (error) {
          // If it's not valid JSON, it might be binary audio data
          handleBinaryAudio(payload);
        }
      } catch (error) {
        handleError(error, 'api', 'Error processing server data');
      }
    };

    // Safely add event listener
    try {
      room.on(RoomEvent.DataReceived, handleDataReceived);
    } catch (error) {
      handleError(error, 'connection', 'Error setting up data receiver');
    }

    return () => {
      // Safely remove event listener
      try {
        room.off(RoomEvent.DataReceived, handleDataReceived);
      } catch (error) {
        console.error('Error removing data receiver:', error);
      }
    };
  }, [room, state, webTTS, settings, handleError, handleBinaryAudio]);

  // Clear spoken messages when the room changes
  useEffect(() => {
    if (room) {
      // Clear spoken messages when room changes
      clearSpokenMessages();
    }
  }, [room, clearSpokenMessages]);

  // Clear responses when conversation changes and populate with loaded conversation data
  useEffect(() => {
    const handleConversationChange = () => {
      // Clear responses when switching conversations
      setResponses([]);
      clearSpokenMessages();
    };

    // Listen for conversation data being loaded
    const handleConversationDataLoaded = (event: Event) => {
      const customEvent = event as CustomEvent;
      try {
        const data = JSON.parse(customEvent.detail);
        if (data.type === "conversation_data" && data.conversation && data.conversation.messages) {
          // Extract AI messages from the loaded conversation and add them to responses
          const aiMessages = data.conversation.messages.filter((msg: any) => msg.type === 'ai');
          const aiResponses = aiMessages.map((msg: any, index: number) => ({
            id: msg.id || `loaded-${index}`,
            text: msg.content,
            receivedTime: new Date(msg.timestamp).getTime(),
            conversationId: data.conversation.id
          }));

          // Set the responses for this conversation
          setResponses(aiResponses);
        }
      } catch (error) {
        console.error('Error processing conversation data for TTS:', error);
      }
    };

    // Listen for storage changes to detect conversation switches
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'current-conversation-id') {
        handleConversationChange();
      }
    };

    // Also check periodically for conversation changes
    let lastConversationId = localStorage.getItem('current-conversation-id');
    const checkForConversationChanges = () => {
      const currentId = localStorage.getItem('current-conversation-id');
      if (currentId !== lastConversationId) {
        lastConversationId = currentId;
        handleConversationChange();
      }
    };

    // Add event listeners
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('data-message-received', handleConversationDataLoaded);
    const interval = setInterval(checkForConversationChanges, 300);

    // Listen for mode switch events
    const handleModeSwitch = () => {
      handleConversationChange();
    };

    window.addEventListener('teaching-mode-changed', handleModeSwitch);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('data-message-received', handleConversationDataLoaded);
      window.removeEventListener('teaching-mode-changed', handleModeSwitch);
      clearInterval(interval);
    };
  }, [clearSpokenMessages]);

  return {
    state,
    responses,
    isTtsSpeaking,
    stopSpeaking,
    speakLastResponse,
    clearSpokenMessages
  };
}
