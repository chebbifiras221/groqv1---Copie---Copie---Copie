"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { ConnectionState } from "livekit-client";
import {
  MessageSquare,
  BookOpen,
  Bookmark,
  CheckCircle,
  Target,
  Code,
  FileText,
  PenTool,
  Clock,
  Award,
  BookMarked,
  ListChecks,
  ArrowRight,
  ChevronRight,
  ChevronDown
} from "lucide-react";
import { useTranscriber } from "@/hooks/use-transcriber";
import { useAIResponses } from "@/hooks/use-ai-responses";
import { useConversation } from "@/hooks/use-conversation";
import { CodeBlock } from "./code-block";
import { CodeEditor } from "./code-editor";
import { SimpleBotFace } from "./ui/simple-bot-face";
import { CourseUI } from "./course-ui";
import { useSettings } from "@/hooks/use-settings";

export interface TypewriterProps {
  typingSpeed?: number;
}

const emptyText =
  "Connect to begin your personalized learning experience";

// Regular expression to detect code blocks in markdown format
const codeBlockRegex = /```([\w-]*)?\n([\s\S]*?)\n```/g;

// Regular expressions to detect chapter titles
const chapterRegex = /^## Chapter (\d+): (.+)$/;
// New regex to match the format in the image (numbered list with asterisks)
// This captures the number before the dot as the chapter number
const outlineChapterRegex = /^\s*(\d+)\.\s+\*\*([^*]+)\*\*$/;
// Additional regex to match other common outline formats
// This also captures the number before the dot as the chapter number
const altOutlineRegex = /^\s*(\d+)\.\s+(.*?)$/;

export function Typewriter({ typingSpeed = 50 }: TypewriterProps) {
  // State for tracking course structure
  const [courseChapters, setCourseChapters] = useState<{
    id: string;
    number: number;
    title: string;
    isActive: boolean;
    isExpanded: boolean;
  }[]>([]);

  // Function to extract course structure from text
  const extractCourseStructure = (text: string) => {
    // Reset regex lastIndex
    chapterRegex.lastIndex = 0;

    // Find all chapter headings
    const chapters: {
      id: string;
      number: number;
      title: string;
      isActive: boolean;
      isExpanded: boolean;
    }[] = [];

    const lines = text.split('\n');

    // Keep track of chapters we've already processed to avoid duplicates
    const processedChapters = new Set<string>();
    // Keep track of chapter numbers we've seen to avoid duplicates
    const usedChapterNumbers = new Set<number>();

    // First pass: look for traditional chapter format (## Chapter X: Title)
    let foundTraditionalFormat = false;

    lines.forEach((line, index) => {
      const match = line.match(chapterRegex);
      if (match) {
        foundTraditionalFormat = true;
        const chapterNumber = parseInt(match[1]);
        const chapterTitle = match[2];

        // Create a unique key for this chapter
        const chapterKey = `${chapterNumber}-${chapterTitle}`;

        // Only add this chapter if we haven't seen it before
        if (!processedChapters.has(chapterKey) && !usedChapterNumbers.has(chapterNumber)) {
          processedChapters.add(chapterKey);
          usedChapterNumbers.add(chapterNumber);

          // Add to chapters array with a unique ID that includes the index
          chapters.push({
            id: `chapter-${chapterNumber}-${index}`,
            number: chapterNumber,
            title: chapterTitle,
            isActive: chapters.length === 0, // First chapter is active by default
            isExpanded: chapters.length === 0 // First chapter is expanded by default
          });
        }
      }
    });

    // If no traditional format found, look for outline format
    if (!foundTraditionalFormat) {
      // Reset used chapter numbers for the outline format
      usedChapterNumbers.clear();

      // First try the primary outline regex (with asterisks)
      lines.forEach((line, index) => {
        const match = line.match(outlineChapterRegex);
        if (match) {
          const chapterNumber = parseInt(match[1]);
          const chapterTitle = match[2];

          // Create a unique key for this chapter
          const chapterKey = `${chapterNumber}-${chapterTitle}`;

          // Only add this chapter if we haven't seen it before and the number is unique
          if (!processedChapters.has(chapterKey) && !usedChapterNumbers.has(chapterNumber)) {
            processedChapters.add(chapterKey);
            usedChapterNumbers.add(chapterNumber);

            // Add to chapters array with a unique ID that includes the index
            chapters.push({
              id: `chapter-${chapterNumber}-${index}`,
              number: chapterNumber,
              title: chapterTitle,
              isActive: chapters.length === 0, // First chapter is active by default
              isExpanded: chapters.length === 0 // First chapter is expanded by default
            });
          }
        }
      });

      // If still no chapters found, try the alternative outline regex
      if (chapters.length === 0) {
        // Reset used chapter numbers again
        usedChapterNumbers.clear();

        lines.forEach((line, index) => {
          const match = line.match(altOutlineRegex);
          if (match) {
            const chapterNumber = parseInt(match[1]);
            const chapterTitle = match[2];

            // Create a unique key for this chapter
            const chapterKey = `${chapterNumber}-${chapterTitle}`;

            // Only add this chapter if we haven't seen it before and the number is unique
            if (!processedChapters.has(chapterKey) && !usedChapterNumbers.has(chapterNumber)) {
              processedChapters.add(chapterKey);
              usedChapterNumbers.add(chapterNumber);

              // Add to chapters array with a unique ID that includes the index
              chapters.push({
                id: `chapter-${chapterNumber}-${index}`,
                number: chapterNumber,
                title: chapterTitle,
                isActive: chapters.length === 0, // First chapter is active by default
                isExpanded: chapters.length === 0 // First chapter is expanded by default
              });
            }
          }
        });
      }
    }

    // Sort chapters by number before returning
    return chapters.sort((a, b) => a.number - b.number);
  };

  const { state } = useTranscriber();
  const { isTtsSpeaking, isProcessingTTS, stopSpeaking, speakLastResponse } = useAIResponses();

  // Get conversation messages, current conversation ID, and message sending functions from our hook
  const { messages, currentConversationId, sendTextMessage, sendHiddenInstruction } = useConversation();
  const conversationContainerRef = useRef<HTMLDivElement>(null);
  const transcriptionEndRef = useRef<HTMLDivElement>(null);

  // Function to extract and set course structure - called from useEffect, not during render
  const processMessageForCourseStructure = useCallback((text: string) => {
    if (!text) return;

    // Check if the message contains chapter-like content
    if (text.includes('Chapter') || text.includes('**Introduction to')) {
      const newChapters = extractCourseStructure(text);

      if (newChapters.length > 0) {
        // Preserve active chapter when updating course structure
        setCourseChapters(prevChapters => {
          // If we have no previous chapters, use the new ones
          if (prevChapters.length === 0) {
            return newChapters;
          }

          // Find the currently active chapter number
          const activeChapterNumber = prevChapters.find(ch => ch.isActive)?.number;

          // If we have an active chapter, maintain its active state in the new structure
          if (activeChapterNumber) {
            return newChapters.map(chapter => ({
              ...chapter,
              isActive: chapter.number === activeChapterNumber,
              isExpanded: chapter.number === activeChapterNumber || chapter.isExpanded
            }));
          }

          // Otherwise, just use the new chapters
          return newChapters;
        });

        console.log(`Course structure updated with ${newChapters.length} chapters`);
      }
    }
  }, []);

  // Reset course structure when conversation ID changes
  useEffect(() => {
    // Reset course chapters when conversation ID changes or is null
    setCourseChapters([]);
    console.log("Conversation ID changed, resetting course structure");

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

    // Reset regex lastIndex to ensure we start from the beginning
    codeBlockRegex.lastIndex = 0;

    // Process the text to enhance formatting
    const processedText = text
      // Add special styling for learning objectives sections
      .replace(/####\s+Learning Objectives/g, '#### 🎯 Learning Objectives')
      // Add special styling for practice exercises sections
      .replace(/####\s+Practice Exercises/g, '#### 💻 Practice Exercises')
      // Add special styling for quiz sections
      .replace(/####\s+Quiz/g, '#### 📝 Quiz')
      // Add special styling for summary sections
      .replace(/####\s+Summary/g, '#### 📌 Summary')
      // Add special styling for key takeaways
      .replace(/####\s+Key Takeaways/g, '#### 🔑 Key Takeaways')
      // Add special styling for further reading
      .replace(/####\s+Further Reading/g, '#### 📚 Further Reading')
      // Add special styling for practical application
      .replace(/####\s+Practical Application/g, '#### 🛠️ Practical Application')
      // Add special styling for course progress
      .replace(/####\s+Course Progress/g, '#### 📊 Course Progress');

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

      // Add the code block
      segments.push({
        type: 'code',
        language: match[1]?.trim() || 'javascript',
        content: match[2].trim(),
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
      return <div className="markdown-content">{formatTextWithMarkdown(processedText)}</div>;
    }

    // Render each segment
    return (
      <div className="markdown-content">
        {segments.map(segment => {
          if (segment.type === 'code') {
            return (
              <CodeBlock
                key={segment.id}
                code={segment.content}
                language={segment.language}
              />
            );
          } else {
            return <div key={segment.id}>{formatTextWithMarkdown(segment.content)}</div>;
          }
        })}
      </div>
    );
  };

  // Helper function to detect and parse markdown tables
  const parseMarkdownTable = (lines: string[], startIndex: number) => {
    const tableLines = [];
    let currentIndex = startIndex;

    // Collect all lines that are part of the table
    while (currentIndex < lines.length && lines[currentIndex].trim().startsWith('|')) {
      tableLines.push(lines[currentIndex]);
      currentIndex++;
    }

    if (tableLines.length < 2) return { table: null, endIndex: startIndex }; // Not a valid table

    // Process the table
    const headerRow = tableLines[0];
    const separatorRow = tableLines[1];
    const dataRows = tableLines.slice(2);

    // Check if the second row is a separator row (contains only |, -, :)
    if (!separatorRow.replace(/[\|\-\:\s]/g, '').trim()) {
      // Parse header cells
      const headerCells = headerRow
        .trim()
        .split('|')
        .filter(cell => cell.trim() !== '')
        .map(cell => cell.trim());

      // Parse data rows
      const rows = dataRows.map(row => {
        return row
          .trim()
          .split('|')
          .filter(cell => cell !== '')
          .map(cell => cell.trim());
      });

      // Create the table HTML
      const tableHtml = `
        <div class="overflow-x-auto my-4">
          <table class="min-w-full border-collapse border border-border-DEFAULT rounded-md">
            <thead class="bg-bg-tertiary">
              <tr>
                ${headerCells.map(cell => `<th class="px-4 py-2 text-left text-text-primary font-semibold border border-border-DEFAULT">${cell}</th>`).join('')}
              </tr>
            </thead>
            <tbody>
              ${rows.map(row => `
                <tr class="hover:bg-bg-tertiary/30">
                  ${row.map(cell => `<td class="px-4 py-2 border border-border-DEFAULT">${cell}</td>`).join('')}
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;

      return {
        table: tableHtml,
        endIndex: currentIndex - 1
      };
    }

    return { table: null, endIndex: startIndex }; // Not a valid table
  };

  // Helper function to format text with markdown-like styling
  const formatTextWithMarkdown = (text: string) => {
    if (!text) return null;

    // Split the text by lines to process headers and lists
    const lines = text.split('\n');

    // Process the lines with special handling for tables
    const renderedElements = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Check for tables
      if (line.trim().startsWith('|')) {
        const { table, endIndex } = parseMarkdownTable(lines, i);
        if (table) {
          renderedElements.push(
            <div key={`table-${i}`} dangerouslySetInnerHTML={{ __html: table }} />
          );
          i = endIndex; // Skip the lines that were part of the table
          continue;
        }
      }

      // Process the line based on its content
      if (line.startsWith('# ')) {
        // Process course title
        const courseTitle = line.substring(2);
        renderedElements.push(
          <div key={`heading-${i}`} className="mt-8 mb-6">
            <h1 className="text-2xl md:text-3xl font-bold text-primary-DEFAULT flex items-center gap-2 pb-2 border-b border-primary-DEFAULT/20">
              <BookOpen className="w-6 h-6" />
              {courseTitle}
            </h1>
            <div className="mt-2 text-sm text-text-secondary flex items-center gap-2">
              <BookMarked className="w-4 h-4" />
              <span>Professional Learning Experience</span>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <div className="px-2 py-1 bg-primary-DEFAULT/10 text-primary-DEFAULT text-xs rounded-md flex items-center gap-1">
                <BookOpen className="w-3 h-3" />
                <span>Interactive Course</span>
              </div>
              <div className="px-2 py-1 bg-success-DEFAULT/10 text-success-DEFAULT text-xs rounded-md flex items-center gap-1">
                <Target className="w-3 h-3" />
                <span>Hands-on Learning</span>
              </div>
            </div>
          </div>
        );
      }
      // Process chapter headings
      else if (line.startsWith('## ')) {
        const isChapter = line.toLowerCase().includes('chapter');
        const chapterMatch = isChapter ? line.match(chapterRegex) : null;

        if (chapterMatch) {
          const chapterNumber = parseInt(chapterMatch[1]);
          const chapterTitle = chapterMatch[2];

          renderedElements.push(
            <div key={`chapter-${i}`} className="mt-8 mb-6 bg-gradient-to-r from-bg-tertiary/40 to-bg-tertiary/20 rounded-lg p-5 border-l-4 border-success-DEFAULT shadow-sm">
              <h2 className="text-xl md:text-2xl font-bold flex items-center gap-2 text-success-DEFAULT">
                <Bookmark className="w-5 h-5" />
                Chapter {chapterNumber}: {chapterTitle}
              </h2>
              <div className="flex flex-wrap items-center gap-3 mt-3 text-sm text-text-secondary">
                <div className="flex items-center gap-1 px-2 py-1 bg-bg-tertiary/30 rounded-md">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Est. time: 20-30 min</span>
                </div>
                <div className="flex items-center gap-1 px-2 py-1 bg-bg-tertiary/30 rounded-md">
                  <ListChecks className="w-3.5 h-3.5" />
                  <span>Chapter {chapterNumber} of {courseChapters.length || '?'}</span>
                </div>
                <div className="flex items-center gap-1 px-2 py-1 bg-success-DEFAULT/10 text-success-DEFAULT rounded-md">
                  <Award className="w-3.5 h-3.5" />
                  <span>Core Content</span>
                </div>
              </div>
            </div>
          );
        } else {
          renderedElements.push(
            <div key={`heading2-${i}`} className="mt-6 mb-4">
              <h2 className="text-xl md:text-2xl font-bold flex items-center gap-2 text-text-primary">
                {line.substring(3)}
              </h2>
              <div className="h-1 w-16 bg-primary-DEFAULT/50 rounded mt-2"></div>
            </div>
          );
        }
      }
      // Process subtopics (section headings)
      else if (line.startsWith('### ')) {
        const sectionTitle = line.substring(4);
        const isNumberedSection = /^\d+\.\d+:/.test(sectionTitle);

        renderedElements.push(
          <div key={`section-${i}`} className="mt-6 mb-4 group">
            <h3 className="text-lg md:text-xl font-semibold text-text-primary flex items-center gap-2 bg-bg-tertiary/20 px-3 py-2 rounded-md border-l-2 border-primary-DEFAULT/50 group-hover:border-primary-DEFAULT transition-colors duration-200">
              {isNumberedSection && <ChevronRight className="w-5 h-5 text-primary-DEFAULT" />}
              {sectionTitle}
            </h3>
            <div className="h-0.5 w-16 bg-primary-DEFAULT/40 rounded mt-2 ml-3 group-hover:w-24 transition-all duration-300"></div>
          </div>
        );
      }
      // Process subsection headings with special icons
      else if (line.startsWith('#### ')) {
        const heading = line.substring(5);
        let icon = null;
        let colorClass = "text-text-primary/90";

        // Determine icon and color based on heading content
        if (heading.includes('🎯 Learning Objectives')) {
          icon = <Target className="w-5 h-5 text-primary-DEFAULT" />;
          colorClass = "text-primary-DEFAULT";
        } else if (heading.includes('💻 Practice Exercises')) {
          icon = <Code className="w-5 h-5 text-success-DEFAULT" />;
          colorClass = "text-success-DEFAULT";
        } else if (heading.includes('📝 Quiz')) {
          icon = <FileText className="w-5 h-5 text-warning-DEFAULT" />;
          colorClass = "text-warning-DEFAULT";
        } else if (heading.includes('📌 Summary')) {
          icon = <CheckCircle className="w-5 h-5 text-info-DEFAULT" />;
          colorClass = "text-info-DEFAULT";
        } else if (heading.includes('🔑 Key Takeaways')) {
          icon = <Award className="w-5 h-5 text-warning-DEFAULT" />;
          colorClass = "text-warning-DEFAULT";
        } else if (heading.includes('📚 Further Reading')) {
          icon = <BookOpen className="w-5 h-5 text-primary-DEFAULT" />;
          colorClass = "text-primary-DEFAULT";
        } else if (heading.includes('🛠️ Practical Application')) {
          icon = <PenTool className="w-5 h-5 text-success-DEFAULT" />;
          colorClass = "text-success-DEFAULT";
        } else if (heading.includes('📊 Course Progress')) {
          icon = <ArrowRight className="w-5 h-5 text-info-DEFAULT" />;
          colorClass = "text-info-DEFAULT";
        }

        renderedElements.push(
          <div key={`subsection-${i}`} className="mt-5 mb-4 bg-gradient-to-r from-bg-tertiary/30 to-bg-tertiary/10 p-3 rounded-md shadow-sm border border-bg-tertiary/20">
            <h4 className={`text-md md:text-lg font-medium ${colorClass} flex items-center gap-2`}>
              {icon}
              {heading}
            </h4>
            <div className={`h-0.5 w-12 ${colorClass.replace('text-', 'bg-')}/30 rounded mt-2`}></div>
          </div>
        );
      }
      // Process lists
      else if (line.match(/^\s*[\-\*]\s/)) {
        const content = line.replace(/^\s*[\-\*]\s/, '');

        // Process any inline formatting in the content
        const formattedContent = content
          // Bold text
          .replace(/\*\*([^*]+)\*\*/g, (_, text) => (
            `<strong class="font-bold text-text-primary">${text}</strong>`
          ))
          // Italic text
          .replace(/\*([^*]+)\*/g, (_, text) => (
            `<em class="text-primary-DEFAULT/90 font-medium not-italic">${text}</em>`
          ))
          // Inline code
          .replace(/`([^`]+)`/g, (_, text) => (
            `<code class="px-1 py-0.5 bg-bg-tertiary rounded text-sm font-mono">${text}</code>`
          ));

        renderedElements.push(
          <div key={`list-${i}`} className="my-2 flex items-start">
            <span className="text-primary-DEFAULT mr-2">•</span>
            <div className="flex-1" dangerouslySetInnerHTML={{ __html: formattedContent }} />
          </div>
        );
      }
      // Process numbered lists
      else if (line.match(/^\s*\d+\.\s/)) {
        // Extract the number to preserve it in the rendered output
        const match = line.match(/^\s*(\d+)\.\s/);
        const number = match ? match[1] : "1";
        const content = line.replace(/^\s*\d+\.\s/, '');

        // Process any inline formatting in the content
        const formattedContent = content
          // Bold text
          .replace(/\*\*([^*]+)\*\*/g, (_, text) => (
            `<strong class="font-bold text-text-primary">${text}</strong>`
          ))
          // Italic text
          .replace(/\*([^*]+)\*/g, (_, text) => (
            `<em class="text-primary-DEFAULT/90 font-medium not-italic">${text}</em>`
          ))
          // Inline code
          .replace(/`([^`]+)`/g, (_, text) => (
            `<code class="px-1 py-0.5 bg-bg-tertiary rounded text-sm font-mono">${text}</code>`
          ));

        renderedElements.push(
          <div key={`numlist-${i}`} className="my-2 flex items-start">
            <span className="font-medium text-primary-DEFAULT mr-2 min-w-[1.5rem] text-right">{number}.</span>
            <div className="flex-1" dangerouslySetInnerHTML={{ __html: formattedContent }} />
          </div>
        );
      }
      // Process blockquotes
      else if (line.startsWith('> ')) {
        renderedElements.push(
          <blockquote key={`quote-${i}`} className="border-l-4 border-warning-DEFAULT pl-4 py-3 my-5 bg-gradient-to-r from-warning-DEFAULT/15 to-warning-DEFAULT/5 rounded-r shadow-sm">
            <div className="text-warning-DEFAULT/90 font-medium mb-1 text-sm">Note:</div>
            <div className="text-text-primary/90">{line.substring(2)}</div>
          </blockquote>
        );
      }
      // Process horizontal rules
      else if (line.match(/^[\-\*\_]{3,}$/)) {
        renderedElements.push(
          <div key={`hr-${i}`} className="my-8 flex items-center justify-center">
            <div className="w-full max-w-md h-px bg-gradient-to-r from-transparent via-bg-tertiary/70 to-transparent"></div>
          </div>
        );
      }
      // Process regular paragraphs
      else if (line.trim() !== '') {
        // Process inline formatting (bold, italic, code)
        const formattedLine = line
          // Bold text
          .replace(/\*\*([^*]+)\*\*/g, (_, text) => (
            `<strong class="font-bold text-text-primary">${text}</strong>`
          ))
          // Italic text
          .replace(/\*([^*]+)\*/g, (_, text) => (
            `<em class="text-primary-DEFAULT/90 font-medium not-italic">${text}</em>`
          ))
          // Inline code
          .replace(/`([^`]+)`/g, (_, text) => (
            `<code class="px-1 py-0.5 bg-bg-tertiary rounded text-sm font-mono">${text}</code>`
          ));

        renderedElements.push(
          <p key={`para-${i}`} className="my-3 leading-relaxed" dangerouslySetInnerHTML={{ __html: formattedLine }} />
        );
      }
      // Empty lines
      else {
        renderedElements.push(<div key={`empty-${i}`} className="h-2"></div>);
      }
    }

    return <>{renderedElements}</>;
  };

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
    setCourseChapters(prev =>
      prev.map(chapter =>
        chapter.id === chapterId
          ? { ...chapter, isExpanded: !chapter.isExpanded }
          : chapter
      )
    );
  };

  // sendTextMessage is available from the useConversation hook above and is used to send messages to the AI

  // Function to navigate to a specific chapter
  const navigateToChapter = (chapterId: string) => {
    // Find the chapter by ID first to avoid setting active chapter if it doesn't exist
    const chapter = courseChapters.find(ch => ch.id === chapterId);
    if (!chapter || !sendHiddenInstruction) return;

    // Set the active chapter only if we found the chapter
    setCourseChapters(prev =>
      prev.map(ch => ({
        ...ch,
        isActive: ch.id === chapterId,
        isExpanded: ch.id === chapterId ? true : ch.isExpanded
      }))
    );

    const currentChapterNum = chapter.number;
    const totalChapters = courseChapters.length;

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
    // Find the chapter by ID first to avoid setting active chapter if it doesn't exist
    const chapter = courseChapters.find(ch => ch.id === chapterId);
    if (!chapter || !sendHiddenInstruction) return;

    // Set the active chapter only if we found the chapter
    setCourseChapters(prev =>
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

Please provide a clear explanation of this chapter with:
• An introduction to the main topic
• Key concepts explained step by step
• Examples and code samples where helpful
• Clear explanations of important ideas`;
        break;
      case "Learning Objectives":
        message = `Show me the Learning Objectives for Chapter ${chapter.number}: ${chapter.title}.

Please provide a clear list of what I'll learn in this chapter, including:
• The main concepts I should understand
• The skills I should develop
• The knowledge I should gain

Please format this as a clean, bulleted list that's easy to read.`;
        break;
      case "Practice Exercises":
        message = `Show me the Practice Exercises for Chapter ${chapter.number}: ${chapter.title}.

I'd like 3-5 practical exercises that will help me apply what I've learned in this chapter.
For each exercise, please include:
• A clear problem statement
• Example inputs/outputs where relevant
• Difficulty level
• Hints to help me if I get stuck`;
        break;
      case "Quiz":
        message = `Give me a Quiz on Chapter ${chapter.number}: ${chapter.title}.

I want to test my understanding with:
• 5-10 questions covering the key concepts
• A mix of multiple choice and short answer questions
• The correct answers provided at the end`;
        break;
      case "Summary":
        message = `Provide a Summary of Chapter ${chapter.number}: ${chapter.title}.

I need a concise overview that:
• Highlights the most important concepts
• Connects the main ideas together
• Reinforces what I should remember from this chapter`;
        break;
      default:
        message = `Show me the ${sectionName} section of Chapter ${chapter.number}: ${chapter.title}.

Please focus specifically on this section and provide a clear, concise explanation.`;
    }

    // Instead of sending two separate messages, let's just send one visible message
    // with the detailed instructions
    sendTextMessage(message);
  };

  // Get the current teaching mode from settings
  const { settings } = useSettings();
  const isTeacherMode = settings.teachingMode === 'teacher';

  return (
    <div className="relative h-full text-lg font-mono overflow-hidden flex">
      {/* Course Navigation Sidebar using our new CourseUI component */}
      <CourseUI
        chapters={courseChapters}
        toggleChapter={toggleChapter}
        navigateToChapter={navigateToChapter}
        navigateToSection={navigateToSection}
        isTeacherMode={isTeacherMode}
      />

      {/* Main Content Area */}
      <div className={`flex-1 px-4 md:px-8 pt-6 pb-20 overflow-hidden ${courseChapters.length > 0 ? 'md:border-l md:border-bg-tertiary/50' : ''}`}>
        {state === ConnectionState.Disconnected && (
          <div className="text-text-secondary h-full flex items-center justify-center pb-16 max-w-md mx-auto">
            <p>{emptyTextAnimation}</p>
          </div>
        )}
        {state !== ConnectionState.Disconnected && (
          <div className="h-full overflow-y-auto" ref={conversationContainerRef}>
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
                          item.text
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
  );
}
