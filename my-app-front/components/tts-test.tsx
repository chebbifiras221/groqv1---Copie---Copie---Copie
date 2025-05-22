import React, { useState } from 'react';
import { useWebTTS } from '../hooks/use-web-tts';

/**
 * TTS Test Component
 *
 * This component allows testing what the TTS system is actually reading
 * by providing sample text with various formatting and special characters.
 */
export const TTSTest: React.FC = () => {
  const { speak, stopSpeaking, isPlaying } = useWebTTS();
  const [debugText, setDebugText] = useState('');

  // Test cases with problematic content
  const testCases = [
    {
      name: "Hashtags",
      text: `
# Main Title
## Subtitle
### Section

[EXPLAIN]
This is an explanation of the headings.
[/EXPLAIN]
      `
    },
    {
      name: "Numbers and Decimals",
      text: `
The value is 0.5 or 1/2
Pi is approximately 3.14159

[EXPLAIN]
These are important numerical values.
[/EXPLAIN]
      `
    },
    {
      name: "Special Characters",
      text: `
C++ is a programming language
The formula is E = mc²

[EXPLAIN]
These contain special characters.
[/EXPLAIN]
      `
    },
    {
      name: "Bullet Points",
      text: `
- First item
- Second item
* Another item

[EXPLAIN]
These are list items.
[/EXPLAIN]
      `
    },
    {
      name: "Code Blocks",
      text: `
Here is a code example:

[CODE]
\`\`\`javascript
const x = 5;
console.log(x);
\`\`\`
[/CODE]

[EXPLAIN]
This is a code example.
[/EXPLAIN]
      `
    },
    {
      name: "Programming Terms",
      text: `
Languages: Java, C++, .NET, Python

[EXPLAIN]
These are programming languages.
[/EXPLAIN]
      `
    },
    {
      name: "Mathematical Expressions",
      text: `
f(x) = x² + 2x + 1
The derivative is f'(x) = 2x + 2

[EXPLAIN]
This is a quadratic function and its derivative.
[/EXPLAIN]
      `
    },
    {
      name: "Mixed Content",
      text: `
# Algorithm Complexity
- O(n²) is quadratic time
- O(log n) is logarithmic time

[EXPLAIN]
These are common time complexities in computer science.
[/EXPLAIN]
      `
    }
  ];

  // Function to process text for TTS and show what will be read
  const processForTTS = (text: string) => {
    // Simplified version of the TTS processing logic
    let cleanedText = text
      // Remove special section markers without adding any text
      .replace(/\[\s*CODE\s*\]([\s\S]*?)\[\s*\/\s*CODE\s*\]/g, '')
      .replace(/\[\s*EXPLAIN\s*\]([\s\S]*?)\[\s*\/\s*EXPLAIN\s*\]/g, '$1')

      // Remove markdown formatting
      .replace(/\*\*\*(.*?)\*\*\*/g, '$1')
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\*(.*?)\*/g, '$1')
      .replace(/\*/g, ' ')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/```[\s\S]*?```/g, '')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/^#{1,6}\s+(.+)$/gm, '$1') // Remove # but keep the header text
      .replace(/#{1,6}\s+/g, '') // Remove any remaining # symbols at the beginning of lines
      .replace(/^[\s]*[-*+]\s+/gm, '')
      .replace(/^[\s]*\d+\.\s+/gm, '')
      .replace(/&[a-z]+;/g, ' ')
      .replace(/[_=+]/g, ' ')

      // Remove any remaining markdown symbols that might be read aloud
      .replace(/\[BOARD\]/gi, '')
      .replace(/\[\/BOARD\]/gi, '')
      .replace(/\[EXPLAIN\]/gi, '')
      .replace(/\[\/EXPLAIN\]/gi, '')
      .replace(/\[CODE\]/gi, '')
      .replace(/\[\/CODE\]/gi, '')

      // Handle special programming terms
      .replace(/C\+\+/g, 'C plus plus')
      .replace(/\.NET/g, 'dot net')
      .replace(/\b0\.\d+/g, (match) => match.replace('.', ' point ')) // Convert 0.5 to "0 point 5"
      .replace(/\b\d+\.\d+/g, (match) => match.replace('.', ' point ')) // Convert 3.14 to "3 point 14"

      // Handle mathematical notation
      .replace(/O\(n²\)/g, 'O of n squared')
      .replace(/O\(log n\)/g, 'O of log n')
      .replace(/x²/g, 'x squared')
      .replace(/f'\(x\)/g, 'f prime of x')

      .replace(/\s+/g, ' ')
      .trim();

    return cleanedText;
  };

  // Function to test a specific case
  const testCase = (text: string) => {
    const processed = processForTTS(text);
    setDebugText(processed);
    speak(text);
  };

  return (
    <div className="p-4 bg-bg-secondary rounded-lg shadow-md">
      <h2 className="text-xl font-bold mb-4">TTS Test Cases</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {testCases.map((test, index) => (
          <div key={index} className="border border-bg-tertiary p-3 rounded-md">
            <h3 className="font-semibold mb-2">{test.name}</h3>
            <pre className="bg-bg-primary p-2 rounded text-sm mb-2 overflow-x-auto">
              {test.text}
            </pre>
            <div className="flex space-x-2">
              <button
                onClick={() => testCase(test.text)}
                className="px-3 py-1 bg-primary-DEFAULT text-white rounded-md text-sm"
                disabled={isPlaying}
              >
                Test TTS
              </button>
              <button
                onClick={() => {
                  const processed = processForTTS(test.text);
                  setDebugText(processed);
                }}
                className="px-3 py-1 bg-bg-tertiary text-text-primary rounded-md text-sm"
              >
                Show Processed
              </button>
            </div>
          </div>
        ))}
      </div>

      {isPlaying && (
        <button
          onClick={stopSpeaking}
          className="px-4 py-2 bg-red-500 text-white rounded-md mb-4"
        >
          Stop Speaking
        </button>
      )}

      {debugText && (
        <div className="mt-4">
          <h3 className="font-semibold mb-2">Processed Text (What TTS Will Read):</h3>
          <div className="bg-bg-primary p-3 rounded-md border border-bg-tertiary">
            {debugText}
          </div>
        </div>
      )}
    </div>
  );
};

export default TTSTest;
