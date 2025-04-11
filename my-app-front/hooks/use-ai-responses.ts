import { useEffect, useState, useCallback } from "react";
import {
  useConnectionState,
  useMaybeRoomContext,
} from "@livekit/components-react";
import { RoomEvent } from "livekit-client";

// Initialize speech synthesis if available
const speechSynthesis = typeof window !== 'undefined' ? window.speechSynthesis : null;
const SpeechSynthesisUtterance = typeof window !== 'undefined' ? window.SpeechSynthesisUtterance : null;

export interface AIResponse {
  id: string;
  text: string;
  receivedTime: number;
}

// Track the last response to prevent duplicates
let lastResponseText = '';
let lastResponseTime = 0;

export function useAIResponses() {
  const state = useConnectionState();
  const room = useMaybeRoomContext();
  const [responses, setResponses] = useState<AIResponse[]>([]);
  const [isTtsSpeaking, setIsTtsSpeaking] = useState(false);
  const [isProcessingTTS, setIsProcessingTTS] = useState(false);

  // Function to get the best female voice
  const getBestFemaleVoice = useCallback(() => {
    if (!speechSynthesis) return null;

    // Get all available voices
    const voices = speechSynthesis.getVoices();

    // Define preferred voices in order (these are common high-quality female voices)
    const preferredVoices = [
      'Google UK English Female', // Chrome
      'Microsoft Zira Desktop',  // Windows
      'Samantha',                // macOS
      'Victoria',                // macOS
      'Karen',                   // macOS
      'Moira',                   // macOS
      'Tessa',                   // macOS
      'Samantha',                // iOS
      'Fiona',                   // macOS
      'Google español',          // Chrome
      'Google français',         // Chrome
    ];

    // Try to find one of our preferred voices
    for (const preferredVoice of preferredVoices) {
      const voice = voices.find(v => v.name === preferredVoice);
      if (voice) return voice;
    }

    // If no preferred voice is found, try to find any female voice
    // Female voices often have 'female', 'woman', or common female names in their name
    const femaleVoiceIndicators = ['female', 'woman', 'girl', 'samantha', 'karen', 'zira', 'victoria', 'moira'];

    for (const voice of voices) {
      const lowerName = voice.name.toLowerCase();
      if (femaleVoiceIndicators.some(indicator => lowerName.includes(indicator))) {
        return voice;
      }
    }

    // If no female voice is found, return the first voice or null
    return voices[0] || null;
  }, []);

  // Initialize voices when component mounts and fix Chrome TTS issues
  useEffect(() => {
    if (speechSynthesis) {
      // Load voices
      const loadVoices = () => {
        speechSynthesis.getVoices();
      };

      // Chrome loads voices asynchronously
      if (speechSynthesis.onvoiceschanged !== undefined) {
        speechSynthesis.onvoiceschanged = loadVoices;
      }

      // Try to load voices immediately (works in Firefox/Safari)
      loadVoices();

      // Fix for Chrome issue where speech synthesis stops after ~15 seconds
      const intervalId = setInterval(() => {
        if (speechSynthesis.speaking) {
          speechSynthesis.pause();
          speechSynthesis.resume();
        }
      }, 10000);

      return () => clearInterval(intervalId);
    }
  }, []);

  // Helper function to speak text using Web Speech API
  const speakWithWebSpeech = useCallback((text: string) => {
    if (!speechSynthesis || !SpeechSynthesisUtterance || !text.trim()) {
      return false;
    }

    try {
      // Set processing state to true
      setIsProcessingTTS(true);

      // Cancel any ongoing speech
      speechSynthesis.cancel();

      // Create and configure a new utterance
      const utterance = new SpeechSynthesisUtterance(text);

      // Set voice properties for a more natural sound
      utterance.rate = 0.95;     // Slightly slower for more natural sound
      utterance.pitch = 1.05;    // Slightly higher pitch for female voice
      utterance.volume = 1.0;    // Full volume

      // Get the best available female voice
      const femaleVoice = getBestFemaleVoice();
      if (femaleVoice) {
        utterance.voice = femaleVoice;
      }

      // Set event listeners
      utterance.onstart = () => {
        setIsTtsSpeaking(true);
        setIsProcessingTTS(false);
      };
      utterance.onend = () => {
        setIsTtsSpeaking(false);
        setIsProcessingTTS(false);
      };
      utterance.onerror = () => {
        setIsTtsSpeaking(false);
        setIsProcessingTTS(false);
      };

      // Start speaking
      speechSynthesis.speak(utterance);
      return true;
    } catch (error) {
      console.error('Error using Web Speech API:', error);
      setIsProcessingTTS(false);
      return false;
    }
  }, [getBestFemaleVoice]);

  // Function to restart TTS for the last response
  const speakLastResponse = useCallback(() => {
    if (responses.length > 0) {
      // Get the most recent response
      const lastResponse = responses[responses.length - 1];

      // Check for duplicate to prevent multiple voices
      const currentTime = Date.now();
      const isDuplicate =
        lastResponse.text === lastResponseText &&
        (currentTime - lastResponseTime) < 3000;

      if (!isDuplicate) {
        // Update last response tracking
        lastResponseText = lastResponse.text;
        lastResponseTime = currentTime;

        // Speak the text
        speakWithWebSpeech(lastResponse.text);
      } else {
        console.log('Skipping duplicate speak request');
      }
    }
  }, [responses, speakWithWebSpeech]);

  // Function to stop TTS
  const stopSpeaking = useCallback(() => {
    if (speechSynthesis) {
      speechSynthesis.cancel();
      setIsTtsSpeaking(false);
    }
  }, []);

  useEffect(() => {
    if (!room) {
      return;
    }

    const handleDataReceived = (payload: Uint8Array) => {
      try {
        const dataString = new TextDecoder().decode(payload);
        const data = JSON.parse(dataString);

        if (data.type === "ai_response") {
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

            // Speak the response using TTS
            speakWithWebSpeech(data.text);
            console.log('Processing AI response:', data.text.substring(0, 30) + '...');
          } else {
            console.log('Skipping duplicate AI response');
          }
        }
      } catch (error) {
        console.error("Error parsing data:", error);
      }
    };

    room.on(RoomEvent.DataReceived, handleDataReceived);

    return () => {
      room.off(RoomEvent.DataReceived, handleDataReceived);
    };
  }, [room, state, speakWithWebSpeech]);

  return {
    state,
    responses,
    isTtsSpeaking,
    isProcessingTTS,
    stopSpeaking,
    speakLastResponse
  };
}
