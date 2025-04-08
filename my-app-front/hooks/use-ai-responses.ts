import { useEffect, useState, useCallback } from "react";
import {
  useConnectionState,
  useMaybeRoomContext,
} from "@livekit/components-react";
import {
  ConnectionState,
  RoomEvent,
} from "livekit-client";

// Initialize speech synthesis if available
const speechSynthesis = typeof window !== 'undefined' ? window.speechSynthesis : null;
const SpeechSynthesisUtterance = typeof window !== 'undefined' ? window.SpeechSynthesisUtterance : null;

export interface AIResponse {
  id: string;
  text: string;
  receivedTime: number;
}

export function useAIResponses() {
  const state = useConnectionState();
  const room = useMaybeRoomContext();
  const [responses, setResponses] = useState<AIResponse[]>([]);
  const [isTtsSpeaking, setIsTtsSpeaking] = useState(false);

  useEffect(() => {
    if (state === ConnectionState.Disconnected) {
      setResponses([]);
    }
  }, [state]);

  useEffect(() => {
    if (!room) {
      return;
    }

    const handleDataReceived = (payload: Uint8Array) => {
      try {
        const dataString = new TextDecoder().decode(payload);
        const data = JSON.parse(dataString);
        
        if (data.type === "ai_response") {
          const newResponse = {
            id: Date.now().toString(),
            text: data.text,
            receivedTime: Date.now(),
          };
          
          setResponses((prev) => [...prev, newResponse]);
          
          // Speak the response using TTS
          if (speechSynthesis && SpeechSynthesisUtterance) {
            // Cancel any ongoing speech
            speechSynthesis.cancel();
            
            // Create and configure a new utterance
            const utterance = new SpeechSynthesisUtterance(data.text);
            utterance.rate = 1.0;
            utterance.pitch = 1.0;
            utterance.volume = 1.0;
            
            // Set event listeners
            utterance.onstart = () => setIsTtsSpeaking(true);
            utterance.onend = () => setIsTtsSpeaking(false);
            utterance.onerror = () => setIsTtsSpeaking(false);
            
            // Start speaking
            speechSynthesis.speak(utterance);
          }
        }
      } catch (e) {
        console.error("Error parsing data message:", e);
      }
    };

    room.on(RoomEvent.DataReceived, handleDataReceived);
    return () => {
      room.off(RoomEvent.DataReceived, handleDataReceived);
    };
  }, [room, state]);

  // Function to stop TTS
  const stopSpeaking = useCallback(() => {
    if (speechSynthesis) {
      speechSynthesis.cancel();
      setIsTtsSpeaking(false);
    }
  }, []);

  // Function to restart TTS for the last response
  const speakLastResponse = useCallback(() => {
    if (speechSynthesis && SpeechSynthesisUtterance && responses.length > 0) {
      // Cancel any ongoing speech
      speechSynthesis.cancel();
      
      // Get the most recent response
      const lastResponse = responses[responses.length - 1];
      
      // Create and configure a new utterance
      const utterance = new SpeechSynthesisUtterance(lastResponse.text);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;
      
      // Set event listeners
      utterance.onstart = () => setIsTtsSpeaking(true);
      utterance.onend = () => setIsTtsSpeaking(false);
      utterance.onerror = () => setIsTtsSpeaking(false);
      
      // Start speaking
      speechSynthesis.speak(utterance);
    }
  }, [responses]);

  return { 
    state, 
    responses, 
    isTtsSpeaking,
    stopSpeaking,
    speakLastResponse 
  };
}
