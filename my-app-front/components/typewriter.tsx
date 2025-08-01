"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { ConnectionState } from "livekit-client";
import {
  MessageSquare,
  BookOpen,
  BookMarked,
} from "lucide-react";
import { decodeHtmlEntities } from "@/utils/html-entities";
import { useTranscriber } from "@/hooks/use-transcriber";
import { useAIResponses } from "@/hooks/use-ai-responses";
import { useConversation } from "@/hooks/use-conversation";
import { CodeBlock } from "./code-block";
import { SimpleBotFace } from "./ui/simple-bot-face";
import { CourseUI } from "./course-ui";
import { useSettings } from "@/hooks/use-settings";
import { ContentSegment } from "./content-segment";
import {
  processCodeTags,
  processTextForSpecialSections,
  findOutermostSections
} from "@/utils/markdown-formatter";
import {
  extractCourseStructure,
  ChapterData
} from "@/utils/course-structure";

export interface TypewriterProps {
  typingSpeed?: number;
}

const emptyText = "Connect to begin your personalized learning experience";

// Regular expression to detect code blocks in markdown format
const codeBlockRegex = /```([\w-]*)?\n([\s\S]*?)\n```/g;

export function Typewriter({ typingSpeed = 50 }: TypewriterProps) {
  // State for tracking course structure
  const [courseChapters, setCourseChapters] = useState<ChapterData[]>([]);
  // State to track if this is the first conversation with course outline
  const [isFirstConversationWithOutline, setIsFirstConversationWithOutline] = useState(false);
  // State to store the original foundation course outline (immutable once set)
  const [foundationCourseOutline, setFoundationCourseOutline] = useState<ChapterData[]>([]);

  const { state } = useTranscriber();
  const { isTtsSpeaking, isProcessingTTS, stopSpeaking, speakLastResponse } = useAIResponses();

  // Get conversation messages, current conversation ID, and message sending functions from our hook
  const { messages, currentConversationId, sendTextMessage, sendHiddenInstruction } = useConversation();
  const conversationContainerRef = useRef<HTMLDivElement>(null);
  const transcriptionEndRef = useRef<HTMLDivElement>(null);

  // Function to extract and set course structure - called from useEffect, not during render
  const processMessageForCourseStructure = useCallback((text: string) => {
    if (!text) return;

    // CRITICAL: If we already have the first conversation with outline, NEVER process new course structures
    // The first course outline is the immutable foundation
    if (isFirstConversationWithOutline) {
      return;
    }

    // More comprehensive check for chapter-like content
    const hasChapterContent = (
      text.includes('Chapter') ||
      text.includes('**Introduction to') ||
      /^\s*\d+\.\s+\*\*/.test(text) || // Numbered list with bold text
      /^\s*\d+\.\s+[A-Z]/.test(text) || // Numbered list starting with capital letter
      text.includes('Course Outline') ||
      text.includes('Learning Path') ||
      /## Chapter \d+/.test(text) // Traditional chapter format
    );

    if (hasChapterContent) {
      const newChapters = extractCourseStructure(text);

      if (newChapters.length > 0) {
        // Check if this is the first time we're setting course chapters
        // and if we have a substantial course outline (3+ chapters)
        const isFirstTimeWithFullOutline = courseChapters.length === 0 && newChapters.length >= 3;

        // Preserve active chapter when updating course structure
        setCourseChapters(prevChapters => {
          // If we have no previous chapters, use the new ones
          if (prevChapters.length === 0) {
            // Check if this should be marked as the first conversation with outline
            if (isFirstTimeWithFullOutline) {
              setIsFirstConversationWithOutline(true);
              // Store the foundation outline permanently
              setFoundationCourseOutline(newChapters);
            }
            return newChapters;
          }

          // This should never happen now due to the early return, but keeping as extra safety
          return prevChapters;
        });
      }
    }
  }, [isFirstConversationWithOutline, courseChapters.length]);

  // Reset course structure when conversation ID changes
  useEffect(() => {
    // Reset course chapters when conversation ID changes or is null
    setCourseChapters([]);
    setIsFirstConversationWithOutline(false);
    setFoundationCourseOutline([]);

    // Also reset any localStorage data related to course structure for this conversation
    localStorage.removeItem(`course-chapters-${currentConversationId}`);
    localStorage.removeItem(`active-chapter-${currentConversationId}`);

    // Clear any other course-related state
    if (typeof window !== 'undefined') {
      // Dispatch a custom event to notify other components about the course reset
      const resetEvent = new CustomEvent('course-ui-reset', {
        detail: { conversationId: currentConversationId }
      });
      window.dispatchEvent(resetEvent);
    }
  }, [currentConversationId]);

  // Process messages for course structure when they change
  useEffect(() => {
    if (messages.length > 0 && currentConversationId) {
      // Get the latest AI message
      const aiMessages = messages.filter(m =>
        m.conversation_id === currentConversationId && m.type === 'ai'
      );

      if (aiMessages.length > 0) {
        const latestMessage = aiMessages[aiMessages.length - 1];
        processMessageForCourseStructure(latestMessage.text);
      }
    }
  }, [messages, currentConversationId, processMessageForCourseStructure]);

  // Function to render AI responses with enhanced formatting
  const renderEnhancedResponse = (text: string) => {
    if (!text) return null;

    // First, process any [CODE] tags to ensure HTML entities are properly decoded
    text = processCodeTags(text);

    // Reset regex lastIndex to ensure we start from the beginning
    codeBlockRegex.lastIndex = 0;

    // Process the text to enhance formatting using our utility function
    const processedText = processTextForSpecialSections(text);

    // Split the text into segments (code blocks and regular text)
    const segments = [];
    let lastIndex = 0;
    let match;
    let segmentId = 0;

    // Find all code blocks in the text
    while ((match = codeBlockRegex.exec(processedText)) !== null) {
      // Add text before the code block
      if (match.index > lastIndex) {
        segments.push({
          type: 'text',
          content: processedText.substring(lastIndex, match.index),
          id: segmentId++
        });
      }

      // Decode HTML entities in the code content multiple times to handle nested encodings
      let decodedCodeContent = match[2].trim();
      for (let i = 0; i < 3; i++) {
        decodedCodeContent = decodeHtmlEntities(decodedCodeContent);
      }

      // Add the code block with decoded content
      segments.push({
        type: 'code',
        language: match[1]?.trim() || 'javascript',
        content: decodedCodeContent,
        id: segmentId++
      });

      lastIndex = match.index + match[0].length;
    }

    // Add any remaining text after the last code block
    if (lastIndex < processedText.length) {
      segments.push({
        type: 'text',
        content: processedText.substring(lastIndex),
        id: segmentId++
      });
    }

    // If no segments were found, return the original text
    if (segments.length === 0) {
      // Wrap the formatted text in a div with a unique key
      return <div className="markdown-content" key="single-content">{formatTextWithMarkdown(processedText)}</div>;
    }

    // Render each segment
    return (
      <div className="markdown-content" key="multi-segment-content">
        {segments.map(segment => {
          if (segment.type === 'code') {
            return (
              <CodeBlock
                key={`code-${segment.id}`}
                code={segment.content}
                language={segment.language}
              />
            );
          } else {
            // Ensure the formatTextWithMarkdown result is wrapped in a div with a key
            return <div key={`text-${segment.id}`}>{formatTextWithMarkdown(segment.content)}</div>;
          }
        })}
      </div>
    );
  };

  // Get settings at the component level, not inside the helper function
  const { settings, updateSettings } = useSettings();

  // Use React state for explanation visibility with a more stable reference
  const [visibleExplanations, setVisibleExplanations] = useState<Record<string, boolean>>({});

  // Store the visibility state in a ref to ensure it persists between renders
  const visibleExplanationsRef = useRef<Record<string, boolean>>({});

  // Update the ref whenever the state changes
  useEffect(() => {
    visibleExplanationsRef.current = visibleExplanations;
  }, [visibleExplanations]);

  // Function to toggle a specific explanation's visibility
  const toggleExplanation = useCallback((id: string) => {
    setVisibleExplanations(prev => {
      const newState = {
        ...prev,
        [id]: !prev[id]
      };
      // Also update the ref immediately for any code that might use it before the next render
      visibleExplanationsRef.current = newState;
      return newState;
    });
  }, []);

  // Helper function to format text with markdown-like styling
  const formatTextWithMarkdown = (text: string) => {
    if (!text) return null;

    // First, process any [CODE] tags to ensure HTML entities are properly decoded
    text = processCodeTags(text);

    // Define regex patterns for explain and code blocks
    const explainBlockRegex = /\[\s*EXPLAIN\s*\]([\s\S]*?)\[\s*\/\s*EXPLAIN\s*\]/g;
    const codeBlockRegex = /\[\s*CODE\s*\]([\s\S]*?)\[\s*\/\s*CODE\s*\]/g;

    // Additional regex patterns to detect incomplete markers
    const openExplainRegex = /\[\s*EXPLAIN\s*\](?![\s\S]*?\[\s*\/\s*EXPLAIN\s*\])/g;
    const openCodeRegex = /\[\s*CODE\s*\](?![\s\S]*?\[\s*\/\s*CODE\s*\])/g;
    const closeExplainRegex = /\[\s*\/\s*EXPLAIN\s*\](?<!\[\s*EXPLAIN\s*\][\s\S]*?)/g;
    const closeCodeRegex = /\[\s*\/\s*CODE\s*\](?<!\[\s*CODE\s*\][\s\S]*?)/g;

    // Regex to detect any remaining markers in the text that might be visible
    const anyMarkerRegex = /\[\s*(EXPLAIN|\/\s*EXPLAIN|CODE|\/\s*CODE)\s*\]/g;

    // Check if the text contains explain or code blocks (more robust check)
    const hasSpecialSections = /\[\s*EXPLAIN\s*\]/.test(text) || /\[\s*CODE\s*\]/.test(text);

    // Check for special sections processing
    if (hasSpecialSections) {
      // Check for incomplete markers
      const hasOpenExplain = openExplainRegex.test(text);
      const hasOpenCode = openCodeRegex.test(text);
      const hasCloseExplain = closeExplainRegex.test(text);
      const hasCloseCode = closeCodeRegex.test(text);

      // Reset regex lastIndex
      openExplainRegex.lastIndex = 0;
      openCodeRegex.lastIndex = 0;
      closeExplainRegex.lastIndex = 0;
      closeCodeRegex.lastIndex = 0;

      if (hasOpenExplain || hasOpenCode || hasCloseExplain || hasCloseCode) {
        // Fix incomplete markers
        let fixedText = text;

        // Fix open [EXPLAIN] without close by adding a closing tag at the end
        if (hasOpenExplain) {
          fixedText = fixedText.replace(openExplainRegex, (match) => {
            return match + "\n\nExplanation\n\n[/EXPLAIN]";
          });
        }

        // Fix open [CODE] without close by adding a closing tag at the end
        if (hasOpenCode) {
          fixedText = fixedText.replace(openCodeRegex, (match) => {
            return match + "\n\n```\n\n```\n\n[/CODE]";
          });
        }

        // Fix close [/EXPLAIN] without open by adding an opening tag before it
        if (hasCloseExplain) {
          fixedText = fixedText.replace(closeExplainRegex, (match) => {
            return "[EXPLAIN]\n\nExplanation\n\n" + match;
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

        // Reset regex patterns with the fixed text
        explainBlockRegex.lastIndex = 0;
      }
    }

    // If special sections are detected, process the blocks
    if (hasSpecialSections) {
      try {
        // Extract all blocks in order of appearance using our balanced matching function
        const allBlocks = [];

        // Board sections are handled by the markdown formatter which removes markers and keeps content

        // Find all explanation sections
        const explainSections = findOutermostSections(text, "EXPLAIN");
        let explainIndex = 0;

        for (const section of explainSections) {
          // Create a unique ID for the explanation block
          const messageId = messages.find(m => m.text === text)?.id || 'unknown';
          const explainId = `explain-${messageId}-${explainIndex++}`;

          // Clean the content - remove any nested markers
          let content = section.content.trim();

          // Check if there are any code blocks inside this explanation section
          // Use a more comprehensive regex that can detect code blocks even when they're part of a sentence
          const codeBlocksInExplain = content.match(/```[\s\S]*?```/g);

          // Also check for code blocks that might be preceded by text like "Python example:"
          const codeBlocksWithPrefixInExplain = content.match(/[^\n]*?:?\s*```[\s\S]*?```/g);
          // We no longer extract code blocks from explanation sections
          // Instead, we'll let them be rendered directly within the explanation
          // This preserves the explanation text and ensures code blocks are properly formatted

          // Just clean up any leftover colons or empty lines
          content = content.replace(/:\s*$/gm, '');
          content = content.replace(/\n\s*\n\s*\n/g, '\n\n');

          // Remove any remaining section markers with a more comprehensive regex
          content = content.replace(/\[\s*(EXPLAIN|\/\s*EXPLAIN|CODE|\/\s*CODE)\s*\]/g, '');

          // If content is empty or just whitespace, add a placeholder
          if (!content || content.trim() === '') {
            content = "This explanation provides additional context about the topic.";
          }

          allBlocks.push({
            type: 'explain',
            content: content,
            startIndex: section.startIndex,
            endIndex: section.endIndex,
            matchedText: text.substring(section.startIndex, section.endIndex),
            id: explainId
          });
        }

        // Find all code sections
        const codeSections = findOutermostSections(text, "CODE");
        let codeIndex = 0;

        for (const section of codeSections) {
          // Create a unique ID for the code block
          const messageId = messages.find(m => m.text === text)?.id || 'unknown';
          const codeId = `code-section-${messageId}-${codeIndex++}`;

          // Clean the content - remove any nested markers
          let content = section.content.trim();

          // Remove any remaining section markers with a more comprehensive regex
          // This ensures no section markers are visible in the final output
          content = content.replace(/\[\s*(EXPLAIN|\/\s*EXPLAIN|CODE|\/\s*CODE)\s*\]/g, '');

          // Additional check to ensure all section markers are removed
          content = content.replace(/\[\s*\/?[A-Z]+\s*\]/g, '');

          // If content is empty or just whitespace, don't add a placeholder
          if (!content || content.trim() === '') {
            // Don't add a default code snippet, let it be empty
          }

          // Decode HTML entities in the code content before adding it
          const decodedContent = decodeHtmlEntities(content);

          allBlocks.push({
            type: 'code-section',
            content: decodedContent,
            startIndex: section.startIndex,
            endIndex: section.endIndex,
            matchedText: text.substring(section.startIndex, section.endIndex).replace(/\[\s*CODE\s*\]([\s\S]*?)\[\s*\/\s*CODE\s*\]/g, (match, codeContent) => {
              // Decode HTML entities in the code content
              const decodedContent = decodeHtmlEntities(codeContent);
              return `[CODE]${decodedContent}[/CODE]`;
            }),
            id: codeId
          });
        }

        // If no blocks were found but special sections were detected, create default blocks
        if (allBlocks.length === 0 && hasSpecialSections) {
          // Create a default regular content block
          allBlocks.push({
            type: 'regular',
            content: "# Topic\nThis section contains the main content.",
            startIndex: 0,
            endIndex: 0,
            matchedText: "# Topic\nThis section contains the main content.",
            id: `content-default-0`
          });

          // Create a default explain block with proper content
          allBlocks.push({
            type: 'explain',
            content: "This explanation provides additional context about the topic.",
            startIndex: 1,
            endIndex: 1,
            matchedText: "[EXPLAIN]This explanation provides additional context about the topic.[/EXPLAIN]",
            id: `explain-default-0`
          });
        }

        // Sort blocks by their appearance in the text
        allBlocks.sort((a, b) => a.startIndex - b.startIndex);

        // Don't enforce alternating pattern - respect the exact order from the backend

        // Only add a regular content block at the beginning if there are no blocks at all
        if (allBlocks.length === 0) {
          allBlocks.push({
            type: 'regular',
            content: text, // Use the original text as regular content
            id: `content-auto-0`,
            startIndex: 0,
            endIndex: 0
          });
        }

        // Sort blocks by their appearance in the text to maintain the exact order from the backend
        allBlocks.sort((a, b) => a.startIndex - b.startIndex);

        // Final check 1: Make sure no sections are completely empty
        for (const block of allBlocks) {
          if (!block.content || block.content.trim() === '') {
            if (block.type === 'regular') {
              block.content = "This section contains the main content.";
            } else if (block.type === 'explain') {
              block.content = "This explanation provides additional context about the topic.";
            } else if (block.type === 'code-section') {
              // Don't add a default code snippet for empty code sections
              // Just let it be empty
            }
          }
        }

        // Final check 2: scan only regular blocks for any remaining code blocks
        // We no longer extract code blocks from explanation sections
        for (const block of allBlocks) {
          if (block.type === 'regular') {
            // Use a more comprehensive regex to find any remaining code blocks
            const codeBlocksRemaining = block.content.match(/```[\s\S]*?```/g);
            const codeBlocksWithPrefixRemaining = block.content.match(/[^\n]*?:?\s*```[\s\S]*?```/g);
            if (codeBlocksRemaining || codeBlocksWithPrefixRemaining) {
              // First, handle regular code blocks
              if (codeBlocksRemaining) {
                // Create a new code section for each code block found
                for (const codeBlock of codeBlocksRemaining) {
                  // Create a unique ID for the code block
                  const codeId = `code-section-final-${allBlocks.indexOf(block)}-${codeBlocksRemaining.indexOf(codeBlock)}`;

                  // Only add the code block if it's not empty or just whitespace
                  if (codeBlock && codeBlock.trim() !== '') {
                    // Decode HTML entities in the code content before adding it
                    const decodedCodeBlock = decodeHtmlEntities(codeBlock);

                    // Add the code block as a separate code section
                    allBlocks.push({
                      type: 'code-section',
                      content: decodedCodeBlock,
                      startIndex: block.startIndex + 0.5 + (0.01 * codeBlocksRemaining.indexOf(codeBlock)), // Place right after the section
                      endIndex: block.startIndex + 0.6 + (0.01 * codeBlocksRemaining.indexOf(codeBlock)),
                      // Use decoded content in matchedText to ensure HTML entities are properly handled
                      matchedText: `[CODE]${decodedCodeBlock}[/CODE]`,
                      id: codeId
                    });
                  }
                }
              }

              // Then, handle code blocks with prefixes
              if (codeBlocksWithPrefixRemaining) {
                for (const prefixedBlock of codeBlocksWithPrefixRemaining) {
                  // Extract just the code block part (```...```)
                  const codeBlockMatch = prefixedBlock.match(/(```[\s\S]*?```)/);
                  if (codeBlockMatch && codeBlockMatch[1]) {
                    const codeBlock = codeBlockMatch[1];

                    // Extract any prefix text (e.g., "Python example:")
                    const prefixMatch = prefixedBlock.match(/^([^\n]*?:?)\s*(```[\s\S]*?```)/);
                    const prefix = prefixMatch && prefixMatch[1] ? prefixMatch[1].trim() : '';

                    // Create a unique ID for the code block
                    const codeId = `code-section-final-prefixed-${allBlocks.indexOf(block)}-${codeBlocksWithPrefixRemaining.indexOf(prefixedBlock)}`;

                    // Only add the code block if it's not empty or just whitespace
                    if (codeBlock && codeBlock.trim() !== '') {
                      // Decode HTML entities in the code content before adding it
                      const decodedCodeBlock = decodeHtmlEntities(codeBlock);

                      // Add the code block as a separate code section
                      allBlocks.push({
                        type: 'code-section',
                        // If there's a prefix, add it as a comment at the top of the code block
                        content: prefix ? `// ${prefix}\n${decodedCodeBlock}` : decodedCodeBlock,
                        startIndex: block.startIndex + 0.7 + (0.01 * codeBlocksWithPrefixRemaining.indexOf(prefixedBlock)),
                        endIndex: block.startIndex + 0.8 + (0.01 * codeBlocksWithPrefixRemaining.indexOf(prefixedBlock)),
                        // Use decoded content in matchedText to ensure HTML entities are properly handled
                        matchedText: `[CODE]${decodedCodeBlock}[/CODE]`,
                        id: codeId
                      });

                      // Remove this specific prefixed block from the content
                      block.content = block.content.replace(prefixedBlock, prefix);
                    }
                  }
                }
              }

              // Remove any remaining code blocks from the content
              block.content = block.content.replace(/```[\s\S]*?```/g, '');

              // Clean up any leftover colons or empty lines
              block.content = block.content.replace(/:\s*$/gm, '');
              block.content = block.content.replace(/\n\s*\n\s*\n/g, '\n\n');
            }
          }
        }

        // Re-sort blocks after the final check
        allBlocks.sort((a, b) => a.startIndex - b.startIndex);

        // Process blocks in order and handle any text between blocks
        const segments = [];
        let lastIndex = 0;
        let segmentId = 0;

        // Process all blocks in order
        for (const block of allBlocks) {
          // Add any text before this block
          if (block.startIndex > lastIndex) {
            const regularContent = text.substring(lastIndex, block.startIndex).trim();
            if (regularContent) {
              // Check if the content between blocks contains a code block
              const hasCodeBlock = /```[\s\S]*?```/.test(regularContent);

              if (hasCodeBlock) {
                // Extract code blocks and regular text
                const codeSegments = [];
                let codeLastIndex = 0;
                let codeMatch;

                // Reset regex lastIndex
                codeBlockRegex.lastIndex = 0;

                // Find all code blocks in the text
                while ((codeMatch = codeBlockRegex.exec(regularContent)) !== null) {
                  // Add text before the code block
                  if (codeMatch.index > codeLastIndex) {
                    const textBeforeCode = regularContent.substring(codeLastIndex, codeMatch.index).trim();
                    if (textBeforeCode) {
                      codeSegments.push({
                        type: 'regular',
                        content: textBeforeCode,
                        id: `regular-code-${segmentId++}`
                      });
                    }
                  }

                  // Decode HTML entities in the code content before adding it
                  const decodedCodeContent = decodeHtmlEntities(codeMatch[2].trim());

                  // Add the code block with decoded content
                  codeSegments.push({
                    type: 'code',
                    language: codeMatch[1]?.trim() || 'javascript',
                    content: decodedCodeContent,
                    id: `code-${segmentId++}`
                  });

                  codeLastIndex = codeMatch.index + codeMatch[0].length;
                }

                // Add any remaining text after the last code block
                if (codeLastIndex < regularContent.length) {
                  const textAfterCode = regularContent.substring(codeLastIndex).trim();
                  if (textAfterCode) {
                    codeSegments.push({
                      type: 'regular',
                      content: textAfterCode,
                      id: `regular-code-${segmentId++}`
                    });
                  }
                }

                // Add all code segments
                segments.push(...codeSegments);
              } else {
                // Add regular content without code blocks
                segments.push({
                  type: 'regular',
                  content: regularContent,
                  id: `regular-${segmentId++}`
                });
              }
            }
          }

          // Add the current block
          // Final check to remove any remaining markers - use a more aggressive approach
          let cleanContent = block.content.replace(/\[\s*\/?[A-Z]+\s*\]/g, '');

          // Additional check to ensure all section markers are removed
          cleanContent = cleanContent.replace(/\[\s*(EXPLAIN|\/\s*EXPLAIN|CODE|\/\s*CODE)\s*\]/g, '');

          segments.push({
            type: block.type,
            content: cleanContent,
            id: block.id || `${block.type}-${segmentId++}`
          });

          // Update lastIndex
          lastIndex = block.endIndex;
        }

        // Add any remaining text after the last block
        if (lastIndex < text.length) {
          const remainingContent = text.substring(lastIndex).trim();
          if (remainingContent) {
            // Check if the remaining content contains a code block
            const hasCodeBlock = /```[\s\S]*?```/.test(remainingContent);

            if (hasCodeBlock) {
              // Extract code blocks and regular text
              const codeSegments = [];
              let codeLastIndex = 0;
              let codeMatch;

              // Reset regex lastIndex
              codeBlockRegex.lastIndex = 0;

              // Find all code blocks in the text
              while ((codeMatch = codeBlockRegex.exec(remainingContent)) !== null) {
                // Add text before the code block
                if (codeMatch.index > codeLastIndex) {
                  const textBeforeCode = remainingContent.substring(codeLastIndex, codeMatch.index).trim();
                  if (textBeforeCode) {
                    codeSegments.push({
                      type: 'regular',
                      content: textBeforeCode,
                      id: `regular-code-${segmentId++}`
                    });
                  }
                }

                // Decode HTML entities in the code content before adding it
                const decodedCodeContent = decodeHtmlEntities(codeMatch[2].trim());

                // Add the code block with decoded content
                codeSegments.push({
                  type: 'code',
                  language: codeMatch[1]?.trim() || 'javascript',
                  content: decodedCodeContent,
                  id: `code-${segmentId++}`
                });

                codeLastIndex = codeMatch.index + codeMatch[0].length;
              }

              // Add any remaining text after the last code block
              if (codeLastIndex < remainingContent.length) {
                const textAfterCode = remainingContent.substring(codeLastIndex).trim();
                if (textAfterCode) {
                  codeSegments.push({
                    type: 'regular',
                    content: textAfterCode,
                    id: `regular-code-${segmentId++}`
                  });
                }
              }

              // Add all code segments
              segments.push(...codeSegments);
            } else {
              // Add regular content without code blocks
              segments.push({
                type: 'regular',
                content: remainingContent,
                id: `regular-${segmentId++}`
              });
            }
          }
        }



        // Render the segments using our ContentSegment component
        return (
          <>
            {segments.map(segment => (
              <ContentSegment
                key={segment.id}
                type={segment.type as any}
                content={segment.content}
                id={segment.id}
                language={segment.language}
                isVisible={visibleExplanationsRef.current[segment.id]}
                onToggleVisibility={toggleExplanation}
              />
            ))}
          </>
        );
      } catch (error) {
        // Fallback to regular content processing if there's an error
        return <ContentSegment type="regular" content={text} id="fallback" />;
      }
    }

    // If no special sections are detected, process as regular content
    return <ContentSegment type="regular" content={text} id="regular" />;
  };

  // Helper function to format regular content is now in the ContentSegment component

  // These hooks are now moved above

  /**
   * Auto-select the first conversation when the component mounts
   * This ensures that a conversation is loaded automatically when the user connects
   */
  useEffect(() => {
    // Only proceed if we're connected
    if (state !== ConnectionState.Connected) return;

    // Use a short delay to ensure everything is initialized
    const timer = setTimeout(() => {
      // Check if we have a conversation ID in localStorage
      const storedConversationId = localStorage.getItem('current-conversation-id');

      // If we don't have a conversation ID and we're connected, we need to trigger the conversation display
      if (!storedConversationId) {
        // This will force the conversation manager to load the most recent conversation
        // or create a new one if none exist
        const event = new Event('storage');
        window.dispatchEvent(event);
      }
    }, 1000); // 1 second delay

    return () => clearTimeout(timer);
  }, [state]);

  /**
   * Auto-scroll to bottom when new messages arrive
   * This ensures the user always sees the latest messages
   */
  useEffect(() => {
    if (messages.length > 0 && conversationContainerRef.current) {
      if (transcriptionEndRef.current) {
        // Use requestAnimationFrame for smoother scrolling
        requestAnimationFrame(() => {
          transcriptionEndRef.current?.scrollIntoView({ behavior: "smooth" });
        });
      }
    }
  }, [messages]);

  /**
   * Force re-render when messages change
   * This ensures the UI updates properly when new messages arrive
   */
  useEffect(() => {
    // This is just to force a re-render when messages change
    if (messages.length > 0) {
      // Use requestIdleCallback for non-critical updates
      if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
        // @ts-ignore - TypeScript doesn't recognize requestIdleCallback
        window.requestIdleCallback(() => {
          // Messages updated
        });
      }
    }
  }, [messages]);

  // Animation for empty state text
  const emptyTextAnimation = emptyText.split("").map((word, index) => {
    return (
      <motion.span
        initial={{
          opacity: 0,
        }}
        animate={{
          opacity: 1,
        }}
        transition={{
          duration: 0.2,
          delay: index * 0.015,
        }}
        key={index}
      >
        {word}
      </motion.span>
    );
  });

  // Function to toggle chapter expansion
  const toggleChapter = (chapterId: string) => {
    if (isFirstConversationWithOutline) {
      // For foundation outline, update the foundation state
      setFoundationCourseOutline(prev =>
        prev.map(chapter =>
          chapter.id === chapterId
            ? { ...chapter, isExpanded: !chapter.isExpanded }
            : chapter
        )
      );
    } else {
      // For regular conversations, update the regular state
      setCourseChapters(prev =>
        prev.map(chapter =>
          chapter.id === chapterId
            ? { ...chapter, isExpanded: !chapter.isExpanded }
            : chapter
        )
      );
    }
  };

  // sendTextMessage is available from the useConversation hook above and is used to send messages to the AI

  // Function to navigate to a specific chapter
  const navigateToChapter = (chapterId: string) => {
    // Determine which chapter list to use
    const chaptersToUse = isFirstConversationWithOutline ? foundationCourseOutline : courseChapters;
    const setChaptersFunction = isFirstConversationWithOutline ? setFoundationCourseOutline : setCourseChapters;

    // Find the chapter by ID first to avoid setting active chapter if it doesn't exist
    const chapter = chaptersToUse.find(ch => ch.id === chapterId);
    if (!chapter || !sendHiddenInstruction) return;

    // Set the active chapter only if we found the chapter
    setChaptersFunction(prev =>
      prev.map(ch => ({
        ...ch,
        isActive: ch.id === chapterId,
        isExpanded: ch.id === chapterId ? true : ch.isExpanded
      }))
    );

    const currentChapterNum = chapter.number;
    const totalChapters = chaptersToUse.length;

    // Create the instruction message
    const message = `I'd like to learn Chapter ${chapter.number}: ${chapter.title}.
Please provide a comprehensive explanation of this chapter, including all key concepts, examples, and code samples where appropriate.
Begin with an introduction to the chapter, then cover the main content in a clear, educational format.
Remember that I'm currently at Chapter ${currentChapterNum} out of ${totalChapters} in this course.
Please make sure your response is complete and well-structured, with proper headings and formatting.
Do NOT automatically proceed to the next chapter when you're done - wait for me to tell you to proceed.`;

    // Add a visible message to the UI to show what's being requested
    const userMessage = `Show me Chapter ${chapter.number}: ${chapter.title}`;

    // First send a regular message to show in the UI
    sendTextMessage(userMessage).then(() => {
      // Then send the hidden instruction after a short delay
      setTimeout(() => {
        sendHiddenInstruction(message);
      }, 500);
    });
  };

  // Function to navigate to a specific section within a chapter
  const navigateToSection = (chapterId: string, sectionName: string) => {
    // Determine which chapter list to use
    const chaptersToUse = isFirstConversationWithOutline ? foundationCourseOutline : courseChapters;
    const setChaptersFunction = isFirstConversationWithOutline ? setFoundationCourseOutline : setCourseChapters;

    // Find the chapter by ID first to avoid setting active chapter if it doesn't exist
    const chapter = chaptersToUse.find(ch => ch.id === chapterId);
    if (!chapter || !sendHiddenInstruction) return;

    // Set the active chapter only if we found the chapter
    setChaptersFunction(prev =>
      prev.map(ch => ({
        ...ch,
        isActive: ch.id === chapterId,
        isExpanded: ch.id === chapterId ? true : ch.isExpanded
      }))
    );

    // Create specific instructions based on the section name
    let message = "";
    const currentChapterNum = chapter.number;
    const totalChapters = courseChapters.length;

    switch(sectionName) {
      case "start":
        message = `Teach me Chapter ${chapter.number}: ${chapter.title}.

Please provide a clear explanation of this chapter in flowing paragraph format. Start with an introduction to the main topic followed by [EXPLAIN] tags explaining why this topic is important. Present key concepts in connected paragraphs with [EXPLAIN] tags after every significant statement or concept. Include examples and code samples within the paragraph flow, using [EXPLAIN] after each example to clarify its purpose. Avoid bullet points and structure everything as natural, flowing paragraphs. Use [EXPLAIN] extensively after every line that introduces new information.`;
        break;
      case "Learning Objectives":
        message = `Show me the Learning Objectives for Chapter ${chapter.number}: ${chapter.title}.

Please provide 3-4 learning objectives in flowing paragraph format. Write each objective as a complete sentence and use [EXPLAIN] tags after each objective to explain why it's important and how it connects to practical programming. Avoid bullet points and structure the content as connected paragraphs that flow naturally from one objective to the next. Keep the entire response under 250 words while using [EXPLAIN] extensively.`;
        break;
      case "Practice Exercises":
        message = `Show me the Practice Exercises for Chapter ${chapter.number}: ${chapter.title}.

I'd like 3-4 practical exercises presented in flowing paragraph format. For each exercise, write a clear problem statement followed by [EXPLAIN] tags that explain the purpose and learning goals. Include the difficulty level and any necessary hints in paragraph form with [EXPLAIN] tags explaining why each hint is helpful. Avoid bullet points and structure the content as connected paragraphs. Use [EXPLAIN] after every significant instruction or concept. Keep the entire response under 300 words.`;
        break;
      case "Quiz":
        message = `Give me a Quiz on Chapter ${chapter.number}: ${chapter.title}.

I want 5-7 questions presented in flowing paragraph format. Write each question as part of a natural paragraph flow, then provide the answer followed by [EXPLAIN] tags that explain why the answer is correct and how it relates to the chapter concepts. Mix multiple choice and short answer questions but present them in paragraph form rather than bullet points. Use [EXPLAIN] after every answer to provide detailed reasoning. Keep the entire response under 350 words while using [EXPLAIN] extensively.`;
        break;
      case "Summary":
        message = `Provide a Summary of Chapter ${chapter.number}: ${chapter.title}.

I need a concise overview (maximum 300 words) written in flowing paragraph format. Highlight the 3-4 most important concepts and connect them naturally in paragraph form. Use [EXPLAIN] tags after every major concept to explain why it's important and how it connects to practical programming. Avoid bullet points completely and structure the content as connected paragraphs that flow from one idea to the next. Use [EXPLAIN] extensively throughout to reinforce understanding.`;
        break;
      default:
        message = `Show me the ${sectionName} section of Chapter ${chapter.number}: ${chapter.title}.

Please focus specifically on this section and provide a clear explanation in flowing paragraph format. Use [EXPLAIN] tags after every significant statement or concept to provide detailed understanding. Avoid bullet points and structure the content as connected paragraphs that flow naturally. Use [EXPLAIN] extensively throughout your response.`;
    }

    // Instead of sending two separate messages, let's just send one visible message
    // with the detailed instructions
    sendTextMessage(message);
  };

  // Get the current teaching mode
  const isTeacherMode = settings.teachingMode === 'teacher';

  return (
    <div className="relative h-full text-lg font-mono flex flex-col">
      {/* Special layout for first conversation with course outline */}
      {isFirstConversationWithOutline ? (
        <>
          {/* Course content layout */}
          <div className="flex flex-1 overflow-hidden">
            {/* Course outline sidebar - always visible and sticky */}
            <div className="w-80 border-r border-bg-tertiary/30 flex-shrink-0 sticky top-0 h-full">
              <CourseUI
                chapters={foundationCourseOutline.length > 0 ? foundationCourseOutline : courseChapters}
                toggleChapter={toggleChapter}
                navigateToChapter={navigateToChapter}
                navigateToSection={navigateToSection}
                isTeacherMode={isTeacherMode}
                isFirstConversationLayout={true}
              />
            </div>

            {/* Main content area */}
            <div className="flex-1 px-4 md:px-8 pt-6 pb-6 overflow-y-auto">
              {state === ConnectionState.Disconnected && (
                <div className="text-text-secondary h-full flex items-center justify-center pb-16 max-w-md mx-auto">
                  <p>{emptyTextAnimation}</p>
                </div>
              )}
              {state !== ConnectionState.Disconnected && (
                <div className="h-full" ref={conversationContainerRef}>
            <div className="h-12" />

            {/* Mobile Course Navigation is now handled by the CourseUI component */}
            {/* Conversation History */}
            <div className="flex flex-col gap-8 max-w-4xl mx-auto">
              {messages.length === 0 || !currentConversationId ? (
                <div className="text-text-secondary text-center py-12">
                  <div className="mb-6">
                    <MessageSquare className="w-16 h-16 mx-auto text-primary-DEFAULT opacity-80" />
                  </div>
                  <p className="text-2xl font-semibold text-text-primary mb-3">Hi there! What would you like to learn?</p>
                  <p className="text-md mt-3 text-text-secondary max-w-lg mx-auto leading-relaxed">
                    Type your question below or use the microphone to start a conversation.
                  </p>
                  <div className="mt-6 flex justify-center">
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-bg-tertiary/30 rounded-lg text-text-tertiary text-sm">
                      <span>Try asking about:</span>
                      <span className="text-primary-DEFAULT">"Explain object-oriented programming"</span>
                    </div>
                  </div>
                </div>
              ) : (
                messages
                  .filter(item => item.conversation_id === currentConversationId)
                  .map((item) => (
                  <motion.div
                    key={item.id}
                    className={`${
                      // Add special styling for multi-part messages
                      item.type === "ai" && item.isPart
                        ? (item.partNumber === 1)
                          // First part of multi-part message
                          ? "mb-1 whitespace-pre-wrap p-6 pt-6 pb-3 bg-gradient-to-r from-bg-tertiary/50 to-bg-tertiary/30 rounded-t-lg border-l-2 border-primary-DEFAULT/40 shadow-sm"
                          : (item.isFinal === true)
                            // Last part of multi-part message
                            ? "mb-8 whitespace-pre-wrap p-6 pt-3 pb-6 bg-gradient-to-r from-bg-tertiary/50 to-bg-tertiary/30 rounded-b-lg border-l-2 border-primary-DEFAULT/40 shadow-sm"
                            // Middle part of multi-part message
                            : "mb-1 whitespace-pre-wrap p-6 py-3 bg-gradient-to-r from-bg-tertiary/50 to-bg-tertiary/30 border-l-2 border-primary-DEFAULT/40 shadow-sm"
                        // Regular message styling
                        : item.type === "ai"
                          ? "mb-8 whitespace-pre-wrap p-6 bg-gradient-to-r from-bg-tertiary/50 to-bg-tertiary/30 rounded-lg border-l-2 border-primary-DEFAULT/40 shadow-sm"
                          : "mb-8 whitespace-pre-wrap px-2"
                    }`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                    style={{
                      willChange: "opacity",
                      contain: "content",
                      contentVisibility: "auto"
                    }}
                  >
                    {/* Only show the header for user messages or the first part of AI messages */}
                    {item.type === "user" || !item.isPart || (item.isPart && item.partNumber === 1) ? (
                      <div className="flex items-center gap-2 mb-3">
                        {item.type === "user" ? (
                          <>
                            <div className="w-8 h-8 rounded-full flex items-center justify-center bg-primary-DEFAULT">
                              <span className="text-white font-bold text-xs">You</span>
                            </div>
                          </>
                        ) : (
                          <>
                            <SimpleBotFace size={32} animated={false} />
                            <div className="text-sm text-text-secondary font-medium flex items-center gap-2">
                              <span>Teacher</span>
                              {/* Show part indicator for multi-part messages */}
                              {item.type === "ai" && item.isPart && (
                                <div className="text-xs bg-bg-tertiary/50 px-2 py-0.5 rounded-full">
                                  Part {item.partNumber || 1} of {item.totalParts || 1}
                                </div>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    ) : null}

                    {item.type === "user" ? (
                      <div className="leading-relaxed pl-10 text-text-primary">
                        {/* Check if user message contains code blocks or markdown */}
                        {item.text.includes("```") || item.text.includes("#") ? (
                          renderEnhancedResponse(item.text)
                        ) : (
                          /* Decode HTML entities in user messages */
                          <ContentSegment
                            type="regular"
                            content={decodeHtmlEntities(item.text)}
                            id={`user-${item.id}`}
                          />
                        )}
                      </div>
                    ) : (
                      <div className="leading-relaxed pl-10 text-text-primary">
                        {item.text && item.text.trim() ? (
                          renderEnhancedResponse(item.text)
                        ) : (
                          <div className="text-text-tertiary italic">
                            [No response received. Please try again.]
                          </div>
                        )}
                      </div>
                    )}

                    {/* Only show speak button for non-part messages or the final part of multi-part messages */}
                    {item.type === "ai" && (!item.isPart || (item.isPart && item.isFinal === true)) && (
                      <div className="flex justify-end mt-4">
                        {isTtsSpeaking ? (
                          <button
                            onClick={stopSpeaking}
                            className="text-xs bg-danger-DEFAULT/90 text-white px-3 py-1.5 rounded-full hover:opacity-90 flex items-center gap-1 border border-danger-DEFAULT/20 shadow-none"
                          >
                            <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>
                            Stop TTS
                          </button>
                        ) : isProcessingTTS ? (
                          <button
                            disabled
                            className="text-xs bg-bg-tertiary/80 text-text-secondary px-3 py-1.5 rounded-full cursor-wait flex items-center gap-1"
                          >
                            <span className="w-2 h-2 bg-text-tertiary rounded-full animate-pulse"></span>
                            Loading...
                          </button>
                        ) : (
                          <button
                            onClick={speakLastResponse}
                            className="text-xs bg-primary-DEFAULT/80 text-white px-3 py-1.5 rounded-full hover:opacity-90 border border-primary-DEFAULT/20 shadow-none"
                          >
                            Speak
                          </button>
                        )}
                      </div>
                    )}

                    {/* Show continuation indicator for non-final parts */}
                    {item.type === "ai" && item.isPart && item.isFinal !== true && (
                      <div className="flex justify-center mt-2">
                        <div className="flex space-x-1">
                          <div className="w-1.5 h-1.5 bg-primary-DEFAULT/40 rounded-full animate-pulse"></div>
                          <div className="w-1.5 h-1.5 bg-primary-DEFAULT/40 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                          <div className="w-1.5 h-1.5 bg-primary-DEFAULT/40 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
                        </div>
                      </div>
                    )}
                  </motion.div>
                ))
              )}
            </div>
                  <div ref={transcriptionEndRef} className="h-24" />
                </div>
              )}
            </div>
          </div>
        </>
      ) : (
        /* Regular layout for non-first conversations */
        <div className="flex h-full">
          {/* Course Navigation Sidebar using our new CourseUI component */}
          <CourseUI
            chapters={courseChapters}
            toggleChapter={toggleChapter}
            navigateToChapter={navigateToChapter}
            navigateToSection={navigateToSection}
            isTeacherMode={isTeacherMode}
            isFirstConversationLayout={false}
          />

          {/* Main Content Area */}
          <div className={`flex-1 px-4 md:px-8 pt-6 pb-6 ${courseChapters.length > 0 ? 'md:border-l md:border-bg-tertiary/50' : ''}`}>
            {state === ConnectionState.Disconnected && (
              <div className="text-text-secondary h-full flex items-center justify-center pb-16 max-w-md mx-auto">
                <p>{emptyTextAnimation}</p>
              </div>
            )}
            {state !== ConnectionState.Disconnected && (
              <div className="h-full" ref={conversationContainerRef}>
                <div className="h-12" />

                {/* Mobile Course Navigation is now handled by the CourseUI component */}
                {/* Conversation History */}
                <div className="flex flex-col gap-8 max-w-4xl mx-auto">
                  {messages.length === 0 || !currentConversationId ? (
                    <div className="text-text-secondary text-center py-12">
                      <div className="mb-6">
                        <MessageSquare className="w-16 h-16 mx-auto text-primary-DEFAULT opacity-80" />
                      </div>
                      <p className="text-2xl font-semibold text-text-primary mb-3">Hi there! What would you like to learn?</p>
                      <p className="text-md mt-3 text-text-secondary max-w-lg mx-auto leading-relaxed">
                        Type your question below or use the microphone to start a conversation.
                      </p>
                      <div className="mt-6 flex justify-center">
                        <div className="inline-flex items-center gap-2 px-4 py-2 bg-bg-tertiary/30 rounded-lg text-text-tertiary text-sm">
                          <span>Try asking about:</span>
                          <span className="text-primary-DEFAULT">"Explain object-oriented programming"</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    messages
                      .filter(item => item.conversation_id === currentConversationId)
                      .map((item) => (
                      <motion.div
                        key={item.id}
                        className={`${
                          // Add special styling for multi-part messages
                          item.type === "ai" && item.isPart
                            ? (item.partNumber === 1)
                              // First part of multi-part message
                              ? "mb-1 whitespace-pre-wrap p-6 pt-6 pb-3 bg-gradient-to-r from-bg-tertiary/50 to-bg-tertiary/30 rounded-t-lg border-l-2 border-primary-DEFAULT/40 shadow-sm"
                              : (item.isFinal === true)
                                // Last part of multi-part message
                                ? "mb-8 whitespace-pre-wrap p-6 pt-3 pb-6 bg-gradient-to-r from-bg-tertiary/50 to-bg-tertiary/30 rounded-b-lg border-l-2 border-primary-DEFAULT/40 shadow-sm"
                                // Middle part of multi-part message
                                : "mb-1 whitespace-pre-wrap p-6 py-3 bg-gradient-to-r from-bg-tertiary/50 to-bg-tertiary/30 border-l-2 border-primary-DEFAULT/40 shadow-sm"
                            // Regular message styling
                            : item.type === "ai"
                              ? "mb-8 whitespace-pre-wrap p-6 bg-gradient-to-r from-bg-tertiary/50 to-bg-tertiary/30 rounded-lg border-l-2 border-primary-DEFAULT/40 shadow-sm"
                              : "mb-8 whitespace-pre-wrap px-2"
                        }`}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.2, ease: "easeOut" }}
                        style={{
                          willChange: "opacity",
                          contain: "content",
                          contentVisibility: "auto"
                        }}
                      >
                        {/* Only show the header for user messages or the first part of AI messages */}
                        {item.type === "user" || !item.isPart || (item.isPart && item.partNumber === 1) ? (
                          <div className="flex items-center gap-2 mb-3">
                            {item.type === "user" ? (
                              <>
                                <div className="w-8 h-8 rounded-full flex items-center justify-center bg-primary-DEFAULT">
                                  <span className="text-white font-bold text-xs">You</span>
                                </div>
                              </>
                            ) : (
                              <>
                                <SimpleBotFace size={32} animated={false} />
                                <div className="text-sm text-text-secondary font-medium flex items-center gap-2">
                                  <span>Teacher</span>
                                  {/* Show part indicator for multi-part messages */}
                                  {item.type === "ai" && item.isPart && (
                                    <div className="text-xs bg-bg-tertiary/50 px-2 py-0.5 rounded-full">
                                      Part {item.partNumber || 1} of {item.totalParts || 1}
                                    </div>
                                  )}
                                </div>
                              </>
                            )}
                          </div>
                        ) : null}

                        {item.type === "user" ? (
                          <div className="leading-relaxed pl-10 text-text-primary">
                            {/* Check if user message contains code blocks or markdown */}
                            {item.text.includes("```") || item.text.includes("#") ? (
                              renderEnhancedResponse(item.text)
                            ) : (
                              /* Decode HTML entities in user messages */
                              <ContentSegment
                                type="regular"
                                content={decodeHtmlEntities(item.text)}
                                id={`user-${item.id}`}
                              />
                            )}
                          </div>
                        ) : (
                          <div className="leading-relaxed pl-10 text-text-primary">
                            {item.text && item.text.trim() ? (
                              renderEnhancedResponse(item.text)
                            ) : (
                              <div className="text-text-tertiary italic">
                                [No response received. Please try again.]
                              </div>
                            )}
                          </div>
                        )}

                        {/* Only show speak button for non-part messages or the final part of multi-part messages */}
                        {item.type === "ai" && (!item.isPart || (item.isPart && item.isFinal === true)) && (
                          <div className="flex justify-end mt-4">
                            {isTtsSpeaking ? (
                              <button
                                onClick={stopSpeaking}
                                className="text-xs bg-danger-DEFAULT/90 text-white px-3 py-1.5 rounded-full hover:opacity-90 flex items-center gap-1 border border-danger-DEFAULT/20 shadow-none"
                              >
                                <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>
                                Stop TTS
                              </button>
                            ) : isProcessingTTS ? (
                              <button
                                disabled
                                className="text-xs bg-bg-tertiary/80 text-text-secondary px-3 py-1.5 rounded-full cursor-wait flex items-center gap-1"
                              >
                                <span className="w-2 h-2 bg-text-tertiary rounded-full animate-pulse"></span>
                                Loading...
                              </button>
                            ) : (
                              <button
                                onClick={speakLastResponse}
                                className="text-xs bg-primary-DEFAULT/80 text-white px-3 py-1.5 rounded-full hover:opacity-90 border border-primary-DEFAULT/20 shadow-none"
                              >
                                Speak
                              </button>
                            )}
                          </div>
                        )}

                        {/* Show continuation indicator for non-final parts */}
                        {item.type === "ai" && item.isPart && item.isFinal !== true && (
                          <div className="flex justify-center mt-2">
                            <div className="flex space-x-1">
                              <div className="w-1.5 h-1.5 bg-primary-DEFAULT/40 rounded-full animate-pulse"></div>
                              <div className="w-1.5 h-1.5 bg-primary-DEFAULT/40 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                              <div className="w-1.5 h-1.5 bg-primary-DEFAULT/40 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
                            </div>
                          </div>
                        )}
                      </motion.div>
                    ))
                  )}
                </div>
                <div ref={transcriptionEndRef} className="h-24" />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
