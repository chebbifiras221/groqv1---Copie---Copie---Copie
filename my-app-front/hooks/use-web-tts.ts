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

  // Function to process text for course content
  const processCourseContent = useCallback((text: string): string => {
    // Split the text into lines to process each line appropriately
    const lines = text.split('\n');
    const processedLines: string[] = [];

    // Track if we're in a code block
    let inCodeBlock = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Skip empty lines
      if (!line) continue;

      // Check for code block markers
      if (line.startsWith('```')) {
        inCodeBlock = !inCodeBlock;
        if (inCodeBlock) {
          processedLines.push('Code example:');
        } else {
          processedLines.push('End of code example.');
        }
        continue;
      }

      // Skip content inside code blocks
      if (inCodeBlock) continue;

      // Process headings with appropriate pauses and emphasis
      if (line.startsWith('# ')) {
        // Course title - add emphasis
        processedLines.push(`Course Title: ${line.substring(2)}.`);
        processedLines.push('');  // Add pause
      } else if (line.match(/^## Chapter \d+:/)) {
        // Chapter heading - add emphasis and pause
        processedLines.push(`${line.substring(3)}.`);
        processedLines.push('');  // Add pause
      } else if (line.startsWith('### ')) {
        // Section heading - add emphasis
        processedLines.push(`Section: ${line.substring(4)}.`);
        processedLines.push('');  // Add pause
      } else if (line.startsWith('#### ')) {
        // Subsection heading - add emphasis
        const heading = line.substring(5);

        // Special handling for specific section types
        if (heading.includes('Learning Objectives')) {
          processedLines.push('Learning Objectives:');
        } else if (heading.includes('Practice Exercises')) {
          processedLines.push('Practice Exercises:');
        } else if (heading.includes('Quiz')) {
          processedLines.push('Quiz Section:');
        } else if (heading.includes('Summary')) {
          processedLines.push('Summary:');
        } else if (heading.includes('Key Takeaways')) {
          processedLines.push('Key Takeaways:');
        } else {
          processedLines.push(`${heading}:`);
        }
        processedLines.push('');  // Add pause
      } else if (line.match(/^\s*[\-\*]\s/)) {
        // Bullet point - add slight pause
        processedLines.push(`• ${line.replace(/^\s*[\-\*]\s/, '')}`);
      } else if (line.match(/^\s*\d+\.\s/)) {
        // Numbered list - add slight pause
        const number = line.match(/^\s*(\d+)\.\s/)?.[1] || '';
        const content = line.replace(/^\s*\d+\.\s/, '');
        processedLines.push(`Step ${number}: ${content}`);
      } else if (line.startsWith('> ')) {
        // Blockquote - add emphasis
        processedLines.push(`Note: ${line.substring(2)}`);
      } else {
        // Regular paragraph
        processedLines.push(line);
      }
    }

    // Join the processed lines with appropriate spacing
    return processedLines.join(' ');
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

      // Check if this is course content
      const isCourseContent = text.includes('# Complete Course:') ||
                             text.includes('## Chapter') ||
                             text.includes('### ');

      // Check for special sections with [EXPLAIN] markers - more robust check
      const hasSpecialSections = /\[\s*EXPLAIN\s*\]/.test(text) || /\[\s*CODE\s*\]/.test(text);

      // Debug logging
      console.log("TTS - Special sections detected:", hasSpecialSections);
      if (hasSpecialSections) {
        console.log("TTS - Text contains [EXPLAIN]:", /\[\s*EXPLAIN\s*\]/.test(text));
        console.log("TTS - Text contains [CODE]:", /\[\s*CODE\s*\]/.test(text));

        // Define regex patterns to detect incomplete markers
        const openExplainRegex = /\[\s*EXPLAIN\s*\](?![\s\S]*?\[\s*\/\s*EXPLAIN\s*\])/g;
        const closeExplainRegex = /\[\s*\/\s*EXPLAIN\s*\](?<!\[\s*EXPLAIN\s*\][\s\S]*?)/g;
        const openCodeRegex = /\[\s*CODE\s*\](?![\s\S]*?\[\s*\/\s*CODE\s*\])/g;
        const closeCodeRegex = /\[\s*\/\s*CODE\s*\](?<!\[\s*CODE\s*\][\s\S]*?)/g;

        // Check for incomplete markers
        const hasOpenExplain = openExplainRegex.test(text);
        const hasCloseExplain = closeExplainRegex.test(text);
        const hasOpenCode = openCodeRegex.test(text);
        const hasCloseCode = closeCodeRegex.test(text);

        // Reset regex lastIndex
        openExplainRegex.lastIndex = 0;
        closeExplainRegex.lastIndex = 0;
        openCodeRegex.lastIndex = 0;
        closeCodeRegex.lastIndex = 0;

        if (hasOpenExplain || hasCloseExplain || hasOpenCode || hasCloseCode) {
          console.log("TTS - Warning: Incomplete markers detected");

          // Fix incomplete markers for TTS
          let fixedText = text;

          // Fix open [EXPLAIN] without close by adding a closing tag at the end
          if (hasOpenExplain) {
            fixedText = fixedText.replace(openExplainRegex, (match) => {
              return match + "\n\nExplanation\n\n[/EXPLAIN]";
            });
          }

          // Fix close [/EXPLAIN] without open by adding an opening tag before it
          if (hasCloseExplain) {
            fixedText = fixedText.replace(closeExplainRegex, (match) => {
              return "[EXPLAIN]\n\nExplanation\n\n" + match;
            });
          }

          // Fix open [CODE] without close by adding a closing tag at the end
          if (hasOpenCode) {
            fixedText = fixedText.replace(openCodeRegex, (match) => {
              return match + "\n\n```\n\n```\n\n[/CODE]";
            });
          }

          // Fix close [/CODE] without open by adding an opening tag before it
          if (hasCloseCode) {
            fixedText = fixedText.replace(closeCodeRegex, (match) => {
              return "[CODE]\n\n```\n\n```\n\n" + match;
            });
          }

          // Use the fixed text
          text = fixedText;
        }

        // Test extraction
        const explainRegex = /\[\s*EXPLAIN\s*\]([\s\S]*?)\[\s*\/\s*EXPLAIN\s*\]/g;
        let match;
        let count = 0;
        while ((match = explainRegex.exec(text)) !== null && count < 3) {
          console.log(`TTS - EXPLAIN block ${count + 1} found:`, match[1].substring(0, 50) + "...");
          count++;
        }
      }

      // Process text differently based on content type
      let cleanedText;

      // If we have special sections and the setting is enabled, only speak the explanations
      if (hasSpecialSections && settings.ttsVerbalsOnly) {
        try {
          // Extract only the verbal explanations with a more robust regex
          const explainRegex = /\[\s*EXPLAIN\s*\]([\s\S]*?)\[\s*\/\s*EXPLAIN\s*\]/g;
          const explanations = [];
          let match;

          while ((match = explainRegex.exec(text)) !== null) {
            explanations.push(match[1].trim());
          }

          console.log("TTS - Found explanation blocks:", explanations.length);

          if (explanations.length > 0) {
            // Join all explanations with pauses between them
            cleanedText = explanations.join('. \n\n');

            // Log the first part of the extracted text for debugging
            console.log("TTS - Speaking explanations:", cleanedText.substring(0, 100) + "...");

            // Apply standard text cleaning to the explanations
            cleanedText = cleanedText
              // Remove any nested markers that might have been included
              .replace(/\[\s*BOARD\s*\]([\s\S]*?)\[\s*\/\s*BOARD\s*\]/g, '')
              .replace(/\[\s*EXPLAIN\s*\]([\s\S]*?)\[\s*\/\s*EXPLAIN\s*\]/g, '$1')

              // Remove markdown formatting
              .replace(/\*\*\*(.*?)\*\*\*/g, '$1')
              .replace(/\*\*(.*?)\*\*/g, '$1')
              .replace(/\*(.*?)\*/g, '$1')
              .replace(/\*/g, ' ')
              .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
              .replace(/```[\s\S]*?```/g, 'Code block omitted.')
              .replace(/`([^`]+)`/g, '$1')
              .replace(/^#{1,6}\s+(.+)$/gm, '$1')
              .replace(/^[\s]*[-*+]\s+/gm, '')
              .replace(/^[\s]*\d+\.\s+/gm, '')
              .replace(/&[a-z]+;/g, ' ')
              .replace(/[_=+]/g, ' ')
              // Handle special programming terms
              .replace(/C\+\+/g, 'C plus plus')
              .replace(/\.NET/g, 'dot net')
              .replace(/\b0\.\d+/g, (match) => match.replace('.', ' point '))
              .replace(/\b\d+\.\d+/g, (match) => match.replace('.', ' point '))

              // Handle mathematical notation
              .replace(/O\(n²\)/g, 'O of n squared')
              .replace(/O\(n\^2\)/g, 'O of n squared')
              .replace(/O\(log n\)/g, 'O of log n')
              .replace(/x²/g, 'x squared')
              .replace(/x\^2/g, 'x squared')
              .replace(/f'\(x\)/g, 'f prime of x')
              .replace(/f\(x\)/g, 'f of x')
              .replace(/\s+/g, ' ')
              .trim();

            // Add natural pauses by using punctuation only
            // Remove any SSML tags that might be read aloud
            cleanedText = cleanedText
              .replace(/<break[^>]*>/g, '')
              .replace(/<[^>]*>/g, '')
              .replace(/\bbreaktime\b/g, '')
              .replace(/\.\s+/g, '. ')
              .replace(/\!\s+/g, '! ')
              .replace(/\?\s+/g, '? ');
          } else {
            console.log("TTS - No explanation blocks found, using fallback");
            // If no explanations found, use the whole text but remove code sections
            cleanedText = text
              .replace(/\[\s*CODE\s*\]([\s\S]*?)\[\s*\/\s*CODE\s*\]/g, '')
              .replace(/\[\s*EXPLAIN\s*\]([\s\S]*?)\[\s*\/\s*EXPLAIN\s*\]/g, '$1')
              .replace(/\s+/g, ' ')
              .trim();
          }
        } catch (error) {
          console.error("TTS - Error processing content with special sections:", error);
          // Fallback to simple text cleaning
          cleanedText = text
            .replace(/\[\s*CODE\s*\]([\s\S]*?)\[\s*\/\s*CODE\s*\]/g, '')
            .replace(/\[\s*EXPLAIN\s*\]([\s\S]*?)\[\s*\/\s*EXPLAIN\s*\]/g, '$1')
            .replace(/\s+/g, ' ')
            .trim();
        }
      } else if (hasSpecialSections) {
        // If special sections are detected but verbalsOnly is not enabled,
        // read all content including explanations
        try {
          // Process the text to read regular content and explanations in the correct order
          // First, extract all blocks in order
          const explainBlockRegex = /\[\s*EXPLAIN\s*\]([\s\S]*?)\[\s*\/\s*EXPLAIN\s*\]/g;
          const codeBlockRegex = /\[\s*CODE\s*\]([\s\S]*?)\[\s*\/\s*CODE\s*\]/g;

          // Extract all blocks in order of appearance
          const allBlocks = [];
          let explainMatch;
          let codeMatch;

          // Reset regex lastIndex
          explainBlockRegex.lastIndex = 0;
          codeBlockRegex.lastIndex = 0;

          // Find all explain blocks
          while ((explainMatch = explainBlockRegex.exec(text)) !== null) {
            allBlocks.push({
              type: 'explain',
              content: explainMatch[1].trim(),
              startIndex: explainMatch.index,
              endIndex: explainMatch.index + explainMatch[0].length
            });
          }

          // Find all code blocks
          while ((codeMatch = codeBlockRegex.exec(text)) !== null) {
            allBlocks.push({
              type: 'code',
              content: codeMatch[1].trim(),
              startIndex: codeMatch.index,
              endIndex: codeMatch.index + codeMatch[0].length
            });
          }

          // Sort blocks by their appearance in the text
          allBlocks.sort((a, b) => a.startIndex - b.startIndex);

          // Extract regular content that's not in any block
          let lastEndIndex = 0;
          const regularBlocks = [];

          // Add regular content before the first block
          if (allBlocks.length > 0 && allBlocks[0].startIndex > 0) {
            regularBlocks.push({
              type: 'regular',
              content: text.substring(0, allBlocks[0].startIndex).trim(),
              startIndex: 0,
              endIndex: allBlocks[0].startIndex
            });
            lastEndIndex = allBlocks[0].endIndex;
          }

          // Add regular content between blocks
          for (let i = 0; i < allBlocks.length - 1; i++) {
            const currentBlock = allBlocks[i];
            const nextBlock = allBlocks[i + 1];

            if (nextBlock.startIndex > currentBlock.endIndex) {
              regularBlocks.push({
                type: 'regular',
                content: text.substring(currentBlock.endIndex, nextBlock.startIndex).trim(),
                startIndex: currentBlock.endIndex,
                endIndex: nextBlock.startIndex
              });
            }

            lastEndIndex = nextBlock.endIndex;
          }

          // Add regular content after the last block
          if (allBlocks.length > 0 && lastEndIndex < text.length) {
            regularBlocks.push({
              type: 'regular',
              content: text.substring(lastEndIndex).trim(),
              startIndex: lastEndIndex,
              endIndex: text.length
            });
          }

          // If no blocks were found, treat the entire text as regular content
          if (allBlocks.length === 0) {
            regularBlocks.push({
              type: 'regular',
              content: text.trim(),
              startIndex: 0,
              endIndex: text.length
            });
          }

          // Combine all blocks in order
          const combinedBlocks = [...allBlocks, ...regularBlocks].sort((a, b) => a.startIndex - b.startIndex);

          // Process blocks in order
          const processedBlocks = [];

          for (const block of combinedBlocks) {
            if (block.type === 'regular' && block.content.trim()) {
              // For regular content, include it as is
              processedBlocks.push(block.content);
            } else if (block.type === 'explain' && block.content.trim()) {
              // For explain blocks, add a pause before reading
              processedBlocks.push("Explanation: " + block.content);
            } else if (block.type === 'code' && block.content.trim()) {
              // For code blocks, just mention that there's code
              processedBlocks.push("Code example (omitted for speech)");
            }
          }

          // Join all blocks with pauses between them
          const shortenedText = processedBlocks.join('. ');

          // Clean the shortened text
          cleanedText = shortenedText
            .replace(/\[\s*EXPLAIN\s*\]/g, '')
            .replace(/\[\s*\/\s*EXPLAIN\s*\]/g, '')
            .replace(/\[\s*CODE\s*\]/g, '')
            .replace(/\[\s*\/\s*CODE\s*\]/g, '')
            .replace(/\*\*\*(.*?)\*\*\*/g, '$1')
            .replace(/\*\*(.*?)\*\*/g, '$1')
            .replace(/\*(.*?)\*/g, '$1')
            .replace(/\*/g, ' ')
            .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
            .replace(/```[\s\S]*?```/g, 'Code block omitted.')
            .replace(/`([^`]+)`/g, '$1')
            .replace(/^#{1,6}\s+(.+)$/gm, '$1')
            .replace(/^[\s]*[-*+]\s+/gm, '')
            .replace(/^[\s]*\d+\.\s+/gm, '')
            .replace(/&[a-z]+;/g, ' ')
            .replace(/[_=+]/g, ' ')
            // Handle special programming terms
            .replace(/C\+\+/g, 'C plus plus')
            .replace(/\.NET/g, 'dot net')
            .replace(/\b0\.\d+/g, (match) => match.replace('.', ' point '))
            .replace(/\b\d+\.\d+/g, (match) => match.replace('.', ' point '))

            // Handle mathematical notation
            .replace(/O\(n²\)/g, 'O of n squared')
            .replace(/O\(n\^2\)/g, 'O of n squared')
            .replace(/O\(log n\)/g, 'O of log n')
            .replace(/x²/g, 'x squared')
            .replace(/x\^2/g, 'x squared')
            .replace(/f'\(x\)/g, 'f prime of x')
            .replace(/f\(x\)/g, 'f of x')
            .replace(/\s+/g, ' ')
            .trim();

          // Add natural pauses by using punctuation only
          // Remove any SSML tags that might be read aloud
          cleanedText = cleanedText
            .replace(/<break[^>]*>/g, '')
            .replace(/<[^>]*>/g, '')
            .replace(/\bbreaktime\b/g, '')
            .replace(/\.\s+/g, '. ')
            .replace(/\!\s+/g, '! ')
            .replace(/\?\s+/g, '? ');

        } catch (error) {
          console.error("TTS - Error processing content with special sections:", error);
          // Fallback to simple text cleaning
          cleanedText = processCourseContent(text);
        }
      } else if (isCourseContent) {
        // Use specialized course content processing
        cleanedText = processCourseContent(text);
      } else {
        // Simple text cleaning for regular content
        cleanedText = text
          // Remove any special section markers if present (just in case)
          .replace(/\[\s*CODE\s*\]([\s\S]*?)\[\s*\/\s*CODE\s*\]/g, '')
          .replace(/\[\s*EXPLAIN\s*\]([\s\S]*?)\[\s*\/\s*EXPLAIN\s*\]/g, '$1')

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

          // Handle markdown headers - replace # with nothing
          .replace(/^#{1,6}\s+(.+)$/gm, '$1') // Replace # Header with just Header

          // Handle markdown lists
          .replace(/^[\s]*[-*+]\s+/gm, '') // Replace bullet points
          .replace(/^[\s]*\d+\.\s+/gm, '') // Replace numbered lists

          // Handle special characters
          .replace(/&[a-z]+;/g, ' ')       // Replace HTML entities like &nbsp; with space
          .replace(/[_=+]/g, ' ')          // Replace underscores, equals, plus with spaces

          // Handle special programming terms
          .replace(/C\+\+/g, 'C plus plus')
          .replace(/\.NET/g, 'dot net')
          .replace(/\b0\.\d+/g, (match) => match.replace('.', ' point ')) // Convert 0.5 to "0 point 5"
          .replace(/\b\d+\.\d+/g, (match) => match.replace('.', ' point ')) // Convert 3.14 to "3 point 14"

          // Handle mathematical notation
          .replace(/O\(n²\)/g, 'O of n squared')
          .replace(/O\(n\^2\)/g, 'O of n squared')
          .replace(/O\(log n\)/g, 'O of log n')
          .replace(/x²/g, 'x squared')
          .replace(/x\^2/g, 'x squared')
          .replace(/f'\(x\)/g, 'f prime of x')
          .replace(/f\(x\)/g, 'f of x')

          // Clean up extra whitespace
          .replace(/\s+/g, ' ')            // Replace multiple spaces with a single space
          .trim();                         // Remove leading/trailing whitespace
      }

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
  }, [selectedVoice, stopSpeaking, settings, processCourseContent]);

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
