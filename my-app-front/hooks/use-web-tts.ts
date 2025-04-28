import { useState, useCallback, useEffect } from 'react';
import { useSettings } from './use-settings';

// Helper function to find the best voice
const getBestVoice = (availableVoices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null => {
  // Safety check
  if (!availableVoices || availableVoices.length === 0) {
    console.log('No voices available');
    return null;
  }

  try {
    // Define preferred high-quality female voices in order
    const preferredVoices = [
      // Microsoft high-quality voices
      'Microsoft Aria Online (Natural)', // Windows 11 high-quality
      'Microsoft Jessa Online (Natural)', // Windows 11 high-quality
      'Microsoft Zira Online (Natural)', // Windows 11 high-quality
      'Microsoft Jenny Online (Natural)', // Windows 11 high-quality
      'Microsoft Sarah Online (Natural)', // Windows 11 high-quality

      // Google high-quality voices
      'Google UK English Female', // Chrome
      'Google US English Female', // Chrome
      'Google US English', // Chrome (often female)

      // Apple high-quality voices
      'Samantha',                // macOS/iOS (high quality)
      'Ava (Premium)',           // macOS/iOS
      'Allison',                 // macOS/iOS
      'Victoria',                // macOS
      'Karen',                   // macOS
      'Moira',                   // macOS
      'Tessa',                   // macOS
      'Fiona',                   // macOS

      // Microsoft standard voices
      'Microsoft Zira Desktop',  // Windows
      'Microsoft Hazel Desktop', // Windows
      'Microsoft Heera Desktop', // Windows

      // Other languages as fallback
      'Google español femenino', // Chrome
      'Google français femenin', // Chrome
    ];

    // Try to find one of our preferred voices
    for (const preferredVoice of preferredVoices) {
      const voice = availableVoices.find(v => v && v.name === preferredVoice);
      if (voice) {
        console.log('Found preferred voice:', voice.name);
        return voice;
      }
    }

    // If no preferred voice is found, try to find any female voice
    // Female voices often have 'female', 'woman', or common female names in their name
    const femaleVoiceIndicators = [
      'female', 'woman', 'girl', 'feminine', 'femenin', 'femenino',
      // Common female names
      'samantha', 'karen', 'zira', 'victoria', 'moira', 'jenny', 'sarah',
      'aria', 'jessa', 'allison', 'ava', 'hazel', 'heera', 'tessa', 'fiona'
    ];

    // First try to find a high-quality voice
    for (const voice of availableVoices) {
      if (!voice || !voice.name) continue;

      const lowerName = voice.name.toLowerCase();
      // Look for indicators of high-quality voices
      if ((lowerName.includes('natural') || lowerName.includes('premium') || lowerName.includes('online')) &&
          femaleVoiceIndicators.some(indicator => lowerName.includes(indicator))) {
        console.log('Found high-quality female voice:', voice.name);
        return voice;
      }
    }

    // Then try to find any female voice
    for (const voice of availableVoices) {
      if (!voice || !voice.name) continue;

      const lowerName = voice.name.toLowerCase();
      if (femaleVoiceIndicators.some(indicator => lowerName.includes(indicator))) {
        console.log('Found female voice:', voice.name);
        return voice;
      }
    }

    // If no female voice is found, return the first valid voice
    for (const voice of availableVoices) {
      if (voice && voice.name) {
        console.log('Using fallback voice:', voice.name);
        return voice;
      }
    }

    // Last resort
    console.log('Using first available voice');
    return availableVoices[0];
  } catch (error) {
    console.log('Error finding best voice:', error);
    return null;
  }
};

export function useWebTTS() {
  const { settings } = useSettings();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<SpeechSynthesisVoice | null>(null);

  // Initialize speech synthesis and load voices
  useEffect(() => {
    if (typeof window === 'undefined') {
      console.log('Window is undefined, cannot initialize speech synthesis');
      return;
    }

    if (!window.speechSynthesis) {
      console.log('Speech synthesis not supported in this browser');
      return;
    }

    // Force a specific high-quality female voice if available
    const forceHighQualityFemaleVoice = (voices: SpeechSynthesisVoice[]) => {
      // Log all available voices for debugging
      console.log('Available voices:');
      voices.forEach((voice, index) => {
        console.log(`${index + 1}. ${voice.name} (${voice.lang}) ${voice.localService ? 'Local' : 'Network'}`);
      });

      // Try to find Microsoft Zira (high quality female voice on Windows)
      const msZira = voices.find(v => v.name.includes('Zira'));
      if (msZira) {
        console.log('Found Microsoft Zira voice:', msZira.name);
        return msZira;
      }

      // Try to find any Microsoft female voice
      const msFemale = voices.find(v =>
        v.name.includes('Microsoft') &&
        (v.name.includes('Female') ||
         v.name.includes('Aria') ||
         v.name.includes('Jenny') ||
         v.name.includes('Jessa') ||
         v.name.includes('Sarah')));
      if (msFemale) {
        console.log('Found Microsoft female voice:', msFemale.name);
        return msFemale;
      }

      // Try to find Google female voice
      const googleFemale = voices.find(v =>
        v.name.includes('Google') &&
        v.name.includes('Female'));
      if (googleFemale) {
        console.log('Found Google female voice:', googleFemale.name);
        return googleFemale;
      }

      // Try to find any female voice
      const femaleVoiceIndicators = [
        'female', 'woman', 'girl', 'feminine', 'femenin', 'femenino',
        'samantha', 'karen', 'zira', 'victoria', 'moira', 'jenny', 'sarah',
        'aria', 'jessa', 'allison', 'ava', 'hazel', 'heera', 'tessa', 'fiona'
      ];

      const anyFemale = voices.find(v => {
        if (!v || !v.name) return false;
        const lowerName = v.name.toLowerCase();
        return femaleVoiceIndicators.some(indicator => lowerName.includes(indicator));
      });

      if (anyFemale) {
        console.log('Found female voice:', anyFemale.name);
        return anyFemale;
      }

      // Fallback to first English voice
      const englishVoice = voices.find(v => v.lang.startsWith('en'));
      if (englishVoice) {
        console.log('Falling back to English voice:', englishVoice.name);
        return englishVoice;
      }

      // Last resort - first voice
      console.log('Falling back to first available voice:', voices[0]?.name);
      return voices[0];
    };

    // Load available voices
    const loadVoices = () => {
      try {
        const availableVoices = window.speechSynthesis.getVoices();

        if (availableVoices && availableVoices.length > 0) {
          setVoices(availableVoices);

          // Force a high-quality female voice
          const bestVoice = forceHighQualityFemaleVoice(availableVoices);
          if (bestVoice) {
            console.log('Selected voice:', bestVoice.name);
            setSelectedVoice(bestVoice);
          }
        } else {
          console.log('No voices available or voices array is empty');
        }
      } catch (error) {
        console.log('Error loading voices:', error);
      }
    };

    // Try to set up voice change listener
    try {
      // Chrome loads voices asynchronously
      if (window.speechSynthesis.onvoiceschanged !== undefined) {
        window.speechSynthesis.onvoiceschanged = loadVoices;
      }

      // Try to load voices immediately (works in Firefox/Safari)
      loadVoices();
    } catch (error) {
      console.log('Error setting up voice change listener:', error);
    }

    // Fix for Chrome issue where speech synthesis stops after ~15 seconds
    let intervalId: NodeJS.Timeout;
    try {
      intervalId = setInterval(() => {
        if (window.speechSynthesis && window.speechSynthesis.speaking) {
          try {
            window.speechSynthesis.pause();
            window.speechSynthesis.resume();
          } catch (e) {
            console.log('Error in speech synthesis resume workaround');
          }
        }
      }, 10000);
    } catch (error) {
      console.log('Error setting up speech synthesis resume interval:', error);
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [selectedVoice]);



  // Function to stop speaking
  const stopSpeaking = useCallback(() => {
    if (typeof window === 'undefined') return;

    try {
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    } catch (error) {
      console.log('Error stopping speech synthesis:', error);
    }

    setIsPlaying(false);
  }, []);

  // Function to speak text
  const speak = useCallback((text: string, voiceOverride?: SpeechSynthesisVoice) => {
    if (typeof window === 'undefined') {
      console.log('Window is undefined, cannot use speech synthesis');
      return false;
    }

    if (!window.speechSynthesis) {
      console.log('Speech synthesis not supported in this browser');
      return false;
    }

    if (!text || !text.trim()) {
      console.log('No text provided for speech synthesis');
      return false;
    }

    try {
      // Stop any ongoing speech
      stopSpeaking();

      setIsLoading(true);
      setError(null);

      // Simple text cleaning for speech synthesis
      // Just remove markdown formatting without adding complex markers
      let cleanedText = text
        // Remove markdown formatting
        .replace(/\*\*\*(.*?)\*\*\*/g, '$1') // Triple asterisks (bold+italic)
        .replace(/\*\*(.*?)\*\*/g, '$1')     // Double asterisks (bold)
        .replace(/\*(.*?)\*/g, '$1')         // Single asterisks (italic)
        .replace(/\*/g, ' ')                 // Any remaining asterisks

        // Handle markdown links
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Replace [text](url) with just text

        // Handle code blocks and inline code
        .replace(/```[\s\S]*?```/g, 'Code block omitted.') // Replace code blocks
        .replace(/`([^`]+)`/g, '$1')         // Replace inline code with just the code

        // Handle markdown headers
        .replace(/^#{1,6}\s+(.+)$/gm, '$1.') // Replace # Header with just Header

        // Handle markdown lists
        .replace(/^[\s]*[-*+]\s+/gm, '') // Replace bullet points
        .replace(/^[\s]*\d+\.\s+/gm, '') // Replace numbered lists

        // Handle special characters
        .replace(/&[a-z]+;/g, ' ')       // Replace HTML entities like &nbsp; with space
        .replace(/[_=+]/g, ' ')          // Replace underscores, equals, plus with spaces

        // Clean up extra whitespace
        .replace(/\s+/g, ' ')            // Replace multiple spaces with a single space
        .trim();                         // Remove leading/trailing whitespace

      console.log('Cleaned text for TTS:', cleanedText.substring(0, 50) + '...');

      // Create a new utterance with the cleaned text
      const utterance = new SpeechSynthesisUtterance(cleanedText);

      // Always set a voice - prioritize female voices
      const voiceToUse = voiceOverride || selectedVoice;

      if (voiceToUse && voiceToUse.voiceURI) {
        console.log('Using voice for speech:', voiceToUse.name);
        utterance.voice = voiceToUse;
        // Set language to match the voice
        utterance.lang = voiceToUse.lang;
      } else {
        // If we don't have a selected voice yet, try to get one now
        const availableVoices = window.speechSynthesis.getVoices();
        if (availableVoices && availableVoices.length > 0) {
          // Try to find a female voice
          const femaleVoice = availableVoices.find(v =>
            v.name.includes('Female') ||
            v.name.includes('Zira') ||
            v.name.includes('Samantha'));

          if (femaleVoice) {
            console.log('Found female voice on-the-fly:', femaleVoice.name);
            utterance.voice = femaleVoice;
            utterance.lang = femaleVoice.lang;
          }
        }
      }

      // Set speech parameters for a natural, pleasant voice
      utterance.rate = 0.95;     // Slightly slower for better clarity
      utterance.pitch = 1.0;     // Normal pitch
      utterance.volume = settings.volume;  // Use volume from settings (0-1 range)

      // Set event handlers with proper error handling
      utterance.onstart = () => {
        setIsPlaying(true);
        setIsLoading(false);
      };

      utterance.onend = () => {
        setIsPlaying(false);
        setIsLoading(false);
      };

      utterance.onerror = (event) => {
        // Handle the error more gracefully
        console.log('Speech synthesis error occurred, falling back to silent mode');
        setIsPlaying(false);
        setIsLoading(false);

        // After a short delay, simulate speech completion
        setTimeout(() => {
          setIsPlaying(false);
          setIsLoading(false);
        }, text.length * 50); // Rough estimate of speech duration
      };

      // Start speaking with a small delay to ensure browser is ready
      setTimeout(() => {
        try {
          window.speechSynthesis.speak(utterance);
        } catch (e) {
          console.log('Error starting speech synthesis, using fallback');
          // Simulate speech with a timer
          setIsPlaying(true);
          setTimeout(() => {
            setIsPlaying(false);
          }, text.length * 50);
        }
      }, 100);

      return true;
    } catch (err) {
      console.log('Error in speech synthesis setup, using fallback');
      // Simulate speech with a timer
      setIsPlaying(true);
      setTimeout(() => {
        setIsPlaying(false);
      }, text.length * 50);

      return true; // Return true anyway so the UI shows we're handling it
    }
  }, [selectedVoice, stopSpeaking, settings]);

  // Function to select a voice by name
  const selectVoiceByName = useCallback((voiceName: string) => {
    if (!voices || voices.length === 0) {
      console.log('No voices available to select from');
      return false;
    }

    // Try to find a voice that includes the given name (case insensitive)
    const lowerName = voiceName.toLowerCase();
    const voice = voices.find(v => v.name.toLowerCase().includes(lowerName));

    if (voice) {
      console.log(`Selected voice by name: ${voice.name}`);
      setSelectedVoice(voice);
      return true;
    } else {
      console.log(`Could not find voice with name containing: ${voiceName}`);
      return false;
    }
  }, [voices]);

  // Function to list all available voices to the console
  const listAvailableVoices = useCallback(() => {
    if (!voices || voices.length === 0) {
      console.log('No voices available');
      return;
    }

    console.log(`Available voices (${voices.length}):`);
    voices.forEach((voice, index) => {
      console.log(`${index + 1}. ${voice.name} (${voice.lang}) ${voice.localService ? 'Local' : 'Network'}`);
    });
  }, [voices]);

  return {
    speak,
    stopSpeaking,
    isLoading,
    isPlaying,
    error,
    voices,
    selectedVoice,
    setSelectedVoice,
    selectVoiceByName,
    listAvailableVoices
  };
}
