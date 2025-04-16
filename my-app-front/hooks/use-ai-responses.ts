import { useEffect, useState, useCallback } from "react";
import {
  useConnectionState,
  useMaybeRoomContext,
} from "@livekit/components-react";
import { RoomEvent } from "livekit-client";
import { useWebTTS } from "./use-web-tts";

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

export function useAIResponses() {
  const state = useConnectionState();
  const room = useMaybeRoomContext();
  const [responses, setResponses] = useState<AIResponse[]>([]);
  const [isTtsSpeaking, setIsTtsSpeaking] = useState(false);
  const [isProcessingTTS, setIsProcessingTTS] = useState(false);
  const webTTS = useWebTTS();



  // Sync isTtsSpeaking state with webTTS.isPlaying
  useEffect(() => {
    setIsTtsSpeaking(webTTS.isPlaying);
  }, [webTTS.isPlaying]);

  // Force a high-quality female voice when voices are loaded
  useEffect(() => {
    if (webTTS.voices && webTTS.voices.length > 0) {
      // List all available voices in the console
      webTTS.listAvailableVoices();

      // Try to select a high-quality female voice in this order
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



  // Function to restart TTS for the last response
  const speakLastResponse = useCallback(() => {
    if (responses.length > 0) {
      // Get the most recent response
      const lastResponse = responses[responses.length - 1];

      // Create a hash of the message
      const messageHash = createMessageHash(lastResponse.text);
      const currentTime = Date.now();

      // For manual speaking, we'll always allow it regardless of whether it was recently spoken
      // But we'll still check for rapid duplicate clicks
      const isDuplicate =
        lastResponse.text === lastResponseText &&
        (currentTime - lastResponseTime) < 1000; // Reduced to 1 second for manual clicks

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
          // Use web speech to speak the response
          webTTS.speak(lastResponse.text);
          console.log('Speaking last response with Web TTS (manual) with hash:', messageHash);
        }, 100);
      } else {
        console.log('Skipping duplicate manual speak request');
      }
    }
  }, [responses, webTTS]);

  // Function to stop TTS
  const stopSpeaking = useCallback(() => {
    webTTS.stopSpeaking();
    setIsTtsSpeaking(false);
  }, [webTTS]);

  // Function to clear the spoken messages tracking
  const clearSpokenMessages = useCallback(() => {
    spokenMessages.clear();
    console.log('Cleared spoken messages tracking');
  }, []);

  useEffect(() => {
    if (!room) {
      return;
    }

    const handleDataReceived = (payload: Uint8Array, topic?: string) => {
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
          } else if (data.type === "ai_response") {
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
                id: currentTime.toString(),
                text: data.text,
                receivedTime: currentTime,
              };

              setResponses((prev) => [...prev, newResponse]);
              console.log('Processing AI response:', data.text.substring(0, 30) + '...');
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
        console.error("Error handling data:", error);
      }
    };

    room.on(RoomEvent.DataReceived, handleDataReceived);

    return () => {
      room.off(RoomEvent.DataReceived, handleDataReceived);
    };
  }, [room, state, webTTS]);

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
