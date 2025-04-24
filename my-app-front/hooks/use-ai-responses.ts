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
  const [isProcessingTTS] = useState(false); // For future use with loading states
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
          console.log(`Successfully selected voice containing: ${voiceName}`);
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
   */
  const speakLastResponse = useCallback(() => {
    if (responses.length > 0) {
      // Get the most recent response
      const lastResponse = responses[responses.length - 1];

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
            console.log('Speaking last response with Web TTS (manual) with hash:', messageHash);
          } catch (error) {
            handleError(error, 'audio', 'Failed to play text-to-speech');
          }
        }, 100);
      } else {
        console.log('Skipping duplicate manual speak request');
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
    console.log('Cleared spoken messages tracking');
  }, []);

  useEffect(() => {
    if (!room) {
      return;
    }

    const handleDataReceived = (payload: Uint8Array, _participant?: RemoteParticipant, _kind?: DataPacket_Kind, topic?: string) => {
      try {
        // Handle binary audio data with specific topic
        if (topic === "binary_audio") {
          console.log("Received binary audio data with topic 'binary_audio'", payload.length);
          // Only play audio if it's not a web TTS message (which is handled separately)
          if (payload.length > 100) { // Assuming web TTS messages are small JSON
            // Create a blob from the binary data
            const audioBlob = new Blob([payload], { type: "audio/mp3" });
            // Create a URL for the audio blob
            const audioUrl = URL.createObjectURL(audioBlob);
            // Play the audio
            const audio = new Audio(audioUrl);
            audio.play();
            // Clean up the URL when done
            audio.onended = () => URL.revokeObjectURL(audioUrl);
          }
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
        try {
          const dataString = new TextDecoder().decode(payload);
          const data = JSON.parse(dataString);

          if (data.type === "web_tts") {
            // This is a web TTS message from the server
            console.log('Received web TTS message:', data.text.substring(0, 30) + '...');

            // Create a hash of the message to track if we've spoken it before
            const messageHash = createMessageHash(data.text);
            const currentTime = Date.now();

            // Check if we've spoken this message recently (within 5 seconds)
            const lastSpokenTime = spokenMessages.get(messageHash);
            const isRecentlySpoken = lastSpokenTime && (currentTime - lastSpokenTime < 5000);

            if (isRecentlySpoken) {
              console.log('Skipping recently spoken message:', messageHash);
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
              console.log('Speaking web TTS message with hash:', messageHash);
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
              };

              setResponses((prev) => [...prev, newResponse]);
              console.log('Processing AI response:', data.text.substring(0, 30) + '...');

              // Auto-speak if enabled in settings
              if (webTTS && settings.autoSpeak) {
                try {
                  // Create a hash for tracking
                  const messageHash = createMessageHash(data.text);
                  spokenMessages.set(messageHash, currentTime);

                  // Add a small delay to ensure any other audio has stopped
                  setTimeout(() => {
                    webTTS.speak(data.text);
                    console.log('Auto-speaking AI response with hash:', messageHash.substring(0, 8));
                  }, 100);
                } catch (speakError) {
                  handleError(speakError, 'audio', 'Failed to auto-speak response');
                }
              }
            } else {
              console.log('Skipping duplicate AI response');
            }
          }
        } catch (error) {
          // If it's not valid JSON, it might be binary audio data without a topic
          console.log("Received possible binary audio data without topic", payload.length);
          // Only play audio if it's not a web TTS message (which is handled separately)
          if (payload.length > 100) { // Assuming web TTS messages are small JSON
            // Create a blob from the binary data
            const audioBlob = new Blob([payload], { type: "audio/mp3" });
            // Create a URL for the audio blob
            const audioUrl = URL.createObjectURL(audioBlob);
            // Play the audio
            const audio = new Audio(audioUrl);
            audio.play();
            // Clean up the URL when done
            audio.onended = () => URL.revokeObjectURL(audioUrl);
          }
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
  }, [room, state, webTTS, settings, handleError]);

  // Clear spoken messages when the room changes
  useEffect(() => {
    if (room) {
      // Clear spoken messages when room changes
      clearSpokenMessages();
    }
  }, [room, clearSpokenMessages]);

  return {
    state,
    responses,
    isTtsSpeaking,
    isProcessingTTS,
    stopSpeaking,
    speakLastResponse,
    clearSpokenMessages
  };
}
