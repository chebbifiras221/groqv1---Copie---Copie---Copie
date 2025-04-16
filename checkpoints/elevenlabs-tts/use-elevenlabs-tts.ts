import { useState, useCallback, useEffect } from 'react';

// ElevenLabs API key
const ELEVENLABS_API_KEY = 'sk_130f021b52362c4ead667df9990294150f0e7725ba38c354';

// Default voice ID for a female voice (Rachel - warm, natural female voice)
const DEFAULT_VOICE_ID = '21m00Tcm4TlvDq8ikWAM';

// Alternative female voices if you want to try different ones:
// Nova (professional, versatile): 'pNInz6obpgDQGcFmaJgB'
// Bella (soft, gentle): 'EXAVITQu4vr4xnSDxMaL'
// Elli (young, bright): 'MF3mGyEYCl7XYWbV9V6O'
// Grace (mature, authoritative): 'oWAxZDx7w5VEj9dCyTzz'

interface ElevenLabsTTSOptions {
  voiceId?: string;
  stability?: number;
  similarityBoost?: number;
  modelId?: string;
}

export function useElevenLabsTTS() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);

  // Initialize audio element
  useEffect(() => {
    if (typeof window !== 'undefined' && !audioElement) {
      const audio = new Audio();
      audio.onended = () => setIsPlaying(false);
      audio.onpause = () => setIsPlaying(false);
      audio.onplay = () => setIsPlaying(true);
      setAudioElement(audio);
    }
  }, [audioElement]);

  // Function to stop playing
  const stopSpeaking = useCallback(() => {
    // Stop any existing audio
    if (audioElement) {
      // Remove any existing audio sources
      audioElement.pause();
      audioElement.src = '';
      audioElement.currentTime = 0;
      setIsPlaying(false);
    }

    // Clean up any existing audio URLs
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
    }
  }, [audioElement, audioUrl]);

  // Function to generate speech from text
  const generateSpeech = useCallback(async (
    text: string,
    options: ElevenLabsTTSOptions = {},
    onError?: (error: string) => void
  ) => {
    if (!text.trim()) {
      if (onError) onError('Empty text provided');
      return false;
    }

    // Limit text length to avoid API errors
    const maxLength = 1000;
    if (text.length > maxLength) {
      text = text.substring(0, maxLength) + '...';
    }

    // Stop any existing audio and clean up
    stopSpeaking();

    setIsLoading(true);
    setError(null);

    try {
      // For debugging
      console.log('ElevenLabs TTS: Starting with API key present:', !!ELEVENLABS_API_KEY);

      const voiceId = options.voiceId || DEFAULT_VOICE_ID;
      const stability = options.stability || 0.5;
      const similarityBoost = options.similarityBoost || 0.75;
      const modelId = options.modelId || 'eleven_monolingual_v1';

      // Validate API key
      if (!ELEVENLABS_API_KEY) {
        throw new Error('ElevenLabs API key is missing');
      }

      // Prepare request body
      const requestBody = {
        text,
        model_id: modelId,
        voice_settings: {
          stability,
          similarity_boost: similarityBoost
        }
      };

      console.log('ElevenLabs TTS: Sending request for voice', voiceId);

      // Make the API request
      const response = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'xi-api-key': ELEVENLABS_API_KEY
          },
          body: JSON.stringify(requestBody)
        }
      );

      if (!response.ok) {
        let errorMessage = `HTTP error ${response.status}`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.detail || errorMessage;
        } catch (e) {
          // If we can't parse the error response, just use the HTTP error
        }
        throw new Error(errorMessage);
      }

      // Get the audio blob
      const audioBlob = await response.blob();
      if (!audioBlob || audioBlob.size === 0) {
        throw new Error('Received empty audio response');
      }

      console.log('ElevenLabs TTS: Received audio blob of size', audioBlob.size);

      // Create a URL for the audio blob
      const url = URL.createObjectURL(audioBlob);
      setAudioUrl(url);

      // Play the audio
      if (audioElement) {
        audioElement.src = url;
        await audioElement.play();
        setIsPlaying(true);
      } else if (typeof window !== 'undefined') {
        const audio = new Audio(url);
        audio.onended = () => setIsPlaying(false);
        audio.onpause = () => setIsPlaying(false);
        audio.onplay = () => setIsPlaying(true);
        audio.onerror = (e) => {
          console.error('Audio element error:', e);
          setIsPlaying(false);
          if (onError) onError('Audio playback error');
        };
        setAudioElement(audio);
        await audio.play();
        setIsPlaying(true);
      }

      return true; // Success
    } catch (err) {
      console.error('Error generating speech with ElevenLabs:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);

      // Call the onError callback if provided
      if (onError) {
        onError(errorMessage);
      }

      return false; // Failed
    } finally {
      setIsLoading(false);
    }
  }, [audioElement, audioUrl, stopSpeaking]);



  // Clean up audio URL when component unmounts
  const cleanup = useCallback(() => {
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
    }
    if (audioElement) {
      audioElement.pause();
      audioElement.src = '';
      setAudioElement(null);
    }
    setIsPlaying(false);
  }, [audioUrl, audioElement]);

  return {
    generateSpeech,
    stopSpeaking,
    cleanup,
    isLoading,
    isPlaying,
    error
  };
}
