"use client";

import { useEffect, useState, useRef } from "react";
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

export interface TypewriterProps {
  typingSpeed?: number;
}

const emptyText =
  "Connect to start a conversation with your teacher";

// Regular expression to detect code blocks in markdown format
const codeBlockRegex = /```([\w-]*)?\n([\s\S]*?)\n```/g;

// Regular expression to detect chapter titles
const chapterRegex = /^## Chapter (\d+): (.+)$/;

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
    lines.forEach(line => {
      const match = line.match(chapterRegex);
      if (match) {
        const chapterNumber = parseInt(match[1]);
        const chapterTitle = match[2];

        // Add to chapters array
        chapters.push({
          id: `chapter-${chapterNumber}`,
          number: chapterNumber,
          title: chapterTitle,
          isActive: chapterNumber === 1, // First chapter is active by default
          isExpanded: chapterNumber === 1 // First chapter is expanded by default
        });
      }
    });

    return chapters;
  };

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

    // Check if this is a course response and extract course structure
    if (text.includes('# Complete Course:') && text.includes('## Chapter')) {
      const chapters = extractCourseStructure(text);
      if (chapters.length > 0) {
        setCourseChapters(chapters);
      }
    }

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

  // Helper function to format text with markdown-like styling
  const formatTextWithMarkdown = (text: string) => {
    if (!text) return null;

    // Split the text by lines to process headers and lists
    const lines = text.split('\n');

    return (
      <>
        {lines.map((line, index) => {
          // Process course title
          if (line.startsWith('# ')) {
            const courseTitle = line.substring(2);
            return (
              <div key={index} className="mt-8 mb-6">
                <h1 className="text-2xl md:text-3xl font-bold text-primary-DEFAULT flex items-center gap-2 pb-2 border-b border-primary-DEFAULT/20">
                  <BookOpen className="w-6 h-6" />
                  {courseTitle}
                </h1>
                <div className="mt-2 text-sm text-text-secondary flex items-center gap-2">
                  <BookMarked className="w-4 h-4" />
                  <span>Professional Learning Course</span>
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

              return (
                <div key={index} className="mt-8 mb-6 bg-bg-tertiary/30 rounded-lg p-4 border-l-4 border-success-DEFAULT">
                  <h2 className="text-xl md:text-2xl font-bold flex items-center gap-2 text-success-DEFAULT">
                    <Bookmark className="w-5 h-5" />
                    Chapter {chapterNumber}: {chapterTitle}
                  </h2>
                  <div className="flex items-center gap-3 mt-3 text-sm text-text-secondary">
                    <div className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      <span>Est. time: 20-30 min</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <ListChecks className="w-4 h-4" />
                      <span>Chapter {chapterNumber} of {courseChapters.length || '?'}</span>
                    </div>
                  </div>
                </div>
              );
            } else {
              return (
                <div key={index} className="mt-6 mb-4">
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

            return (
              <div key={index} className="mt-6 mb-3">
                <h3 className="text-lg md:text-xl font-semibold text-text-primary flex items-center gap-2">
                  {isNumberedSection && <ChevronRight className="w-5 h-5 text-primary-DEFAULT" />}
                  {sectionTitle}
                </h3>
                <div className="h-0.5 w-12 bg-primary-DEFAULT/30 rounded mt-1"></div>
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

            return (
              <div key={index} className="mt-5 mb-3 bg-bg-tertiary/20 p-3 rounded-md">
                <h4 className={`text-md md:text-lg font-medium ${colorClass} flex items-center gap-2`}>
                  {icon}
                  {heading}
                </h4>
              </div>
            );
          }
          // Process lists
          else if (line.match(/^\s*[\-\*]\s/)) {
            return (
              <ul key={index} className="my-1 pl-6 list-disc">
                <li className="pl-1 py-0.5">{line.replace(/^\s*[\-\*]\s/, '')}</li>
              </ul>
            );
          }
          else if (line.match(/^\s*\d+\.\s/)) {
            return (
              <ol key={index} className="my-1 pl-6 list-decimal">
                <li className="pl-1 py-0.5">{line.replace(/^\s*\d+\.\s/, '')}</li>
              </ol>
            );
          }
          // Process blockquotes
          else if (line.startsWith('> ')) {
            return (
              <blockquote key={index} className="border-l-4 border-warning-DEFAULT pl-4 py-2 my-4 bg-warning-DEFAULT/10 rounded-r">
                {line.substring(2)}
              </blockquote>
            );
          }
          // Process horizontal rules
          else if (line.match(/^[\-\*\_]{3,}$/)) {
            return <hr key={index} className="my-6 border-t border-bg-tertiary" />;
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

            return (
              <p key={index} className="my-3 leading-relaxed" dangerouslySetInnerHTML={{ __html: formattedLine }} />
            );
          }
          // Empty lines
          return <div key={index} className="h-2"></div>;
        })}
      </>
    );
  };

  const { state } = useTranscriber();
  const { isTtsSpeaking, isProcessingTTS, stopSpeaking, speakLastResponse } = useAIResponses();

  // Get conversation messages and current conversation ID from our hook
  const { messages, currentConversationId } = useConversation();
  const conversationContainerRef = useRef<HTMLDivElement>(null);
  const transcriptionEndRef = useRef<HTMLDivElement>(null);

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

  // Get sendTextMessage function from useConversation hook
  const { sendTextMessage } = useConversation();

  // Function to navigate to a specific chapter
  const navigateToChapter = (chapterId: string) => {
    // Set the active chapter
    setCourseChapters(prev =>
      prev.map(chapter => ({
        ...chapter,
        isActive: chapter.id === chapterId,
        isExpanded: chapter.id === chapterId ? true : chapter.isExpanded
      }))
    );

    // Find the chapter by ID
    const chapter = courseChapters.find(ch => ch.id === chapterId);
    if (chapter && sendTextMessage) {
      // Send a message to the AI to display the specific chapter
      sendTextMessage(`Please show me Chapter ${chapter.number}: ${chapter.title}`);
    }
  };

  // Function to navigate to a specific section within a chapter
  const navigateToSection = (chapterId: string, sectionName: string) => {
    // Set the active chapter
    setCourseChapters(prev =>
      prev.map(chapter => ({
        ...chapter,
        isActive: chapter.id === chapterId,
        isExpanded: chapter.id === chapterId ? true : chapter.isExpanded
      }))
    );

    // Find the chapter by ID
    const chapter = courseChapters.find(ch => ch.id === chapterId);
    if (chapter && sendTextMessage) {
      // Send a message to the AI to display the specific section
      sendTextMessage(`Please show me the ${sectionName} section of Chapter ${chapter.number}`);
    }
  };

  return (
    <div className="relative h-full text-lg font-mono overflow-hidden flex">
      {/* Course Navigation Sidebar - only shown when we have chapters */}
      {courseChapters.length > 0 && (
        <div className="hidden md:block w-64 h-full border-r border-bg-tertiary/50 overflow-y-auto pt-4 pb-20 bg-bg-secondary/30">
          <div className="px-4 py-2 mb-2">
            <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider">Course Contents</h3>
          </div>
          <div className="space-y-1">
            {courseChapters.map(chapter => (
              <div key={chapter.id} className="px-2">
                <button
                  onClick={() => toggleChapter(chapter.id)}
                  className={`w-full text-left px-3 py-2 rounded-md flex items-center justify-between text-sm ${
                    chapter.isActive ? 'bg-primary-DEFAULT/10 text-primary-DEFAULT' : 'hover:bg-bg-tertiary/30'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Bookmark className="w-4 h-4" />
                    <span>Chapter {chapter.number}: {chapter.title}</span>
                  </div>
                  {chapter.isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </button>

                {chapter.isExpanded && (
                  <div className="ml-4 pl-2 border-l border-bg-tertiary/50 mt-1 mb-2 space-y-1">
                    <button
                      onClick={() => navigateToSection(chapter.id, "Learning Objectives")}
                      className={`w-full text-left px-3 py-1.5 rounded-md text-sm hover:bg-bg-tertiary/30 flex items-center gap-2`}
                    >
                      <Target className="w-3.5 h-3.5 text-primary-DEFAULT/70" />
                      <span>Learning Objectives</span>
                    </button>
                    <button
                      onClick={() => navigateToSection(chapter.id, "Practice Exercises")}
                      className={`w-full text-left px-3 py-1.5 rounded-md text-sm hover:bg-bg-tertiary/30 flex items-center gap-2`}
                    >
                      <Code className="w-3.5 h-3.5 text-success-DEFAULT/70" />
                      <span>Practice Exercises</span>
                    </button>
                    <button
                      onClick={() => navigateToSection(chapter.id, "Quiz")}
                      className={`w-full text-left px-3 py-1.5 rounded-md text-sm hover:bg-bg-tertiary/30 flex items-center gap-2`}
                    >
                      <FileText className="w-3.5 h-3.5 text-warning-DEFAULT/70" />
                      <span>Quiz</span>
                    </button>
                    <button
                      onClick={() => navigateToSection(chapter.id, "Summary")}
                      className={`w-full text-left px-3 py-1.5 rounded-md text-sm hover:bg-bg-tertiary/30 flex items-center gap-2`}
                    >
                      <CheckCircle className="w-3.5 h-3.5 text-info-DEFAULT/70" />
                      <span>Summary</span>
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

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

            {/* Mobile Course Navigation - only shown on small screens when we have chapters */}
            {courseChapters.length > 0 && (
              <div className="md:hidden mb-6 bg-bg-secondary/30 rounded-lg border border-bg-tertiary/50 overflow-hidden">
                <div className="p-3 border-b border-bg-tertiary/50">
                  <h3 className="text-sm font-semibold text-text-secondary">Course Contents</h3>
                </div>
                <div className="p-2 max-h-48 overflow-y-auto">
                  <select
                    className="w-full p-2 bg-bg-primary border border-bg-tertiary rounded-md text-sm"
                    onChange={(e) => navigateToChapter(e.target.value)}
                    value={courseChapters.find(ch => ch.isActive)?.id || ''}
                  >
                    {courseChapters.map(chapter => (
                      <option key={chapter.id} value={chapter.id}>
                        Chapter {chapter.number}: {chapter.title}
                      </option>
                    ))}
                  </select>

                  {/* Quick section navigation */}
                  <div className="grid grid-cols-2 gap-2 mt-3">
                    {courseChapters.find(ch => ch.isActive) && (
                      <>
                        <button
                          onClick={() => navigateToSection(
                            courseChapters.find(ch => ch.isActive)?.id || '',
                            "Learning Objectives"
                          )}
                          className="p-2 bg-bg-tertiary/20 rounded text-xs flex items-center justify-center gap-1"
                        >
                          <Target className="w-3 h-3" />
                          <span>Objectives</span>
                        </button>
                        <button
                          onClick={() => navigateToSection(
                            courseChapters.find(ch => ch.isActive)?.id || '',
                            "Practice Exercises"
                          )}
                          className="p-2 bg-bg-tertiary/20 rounded text-xs flex items-center justify-center gap-1"
                        >
                          <Code className="w-3 h-3" />
                          <span>Exercises</span>
                        </button>
                        <button
                          onClick={() => navigateToSection(
                            courseChapters.find(ch => ch.isActive)?.id || '',
                            "Quiz"
                          )}
                          className="p-2 bg-bg-tertiary/20 rounded text-xs flex items-center justify-center gap-1"
                        >
                          <FileText className="w-3 h-3" />
                          <span>Quiz</span>
                        </button>
                        <button
                          onClick={() => navigateToSection(
                            courseChapters.find(ch => ch.isActive)?.id || '',
                            "Summary"
                          )}
                          className="p-2 bg-bg-tertiary/20 rounded text-xs flex items-center justify-center gap-1"
                        >
                          <CheckCircle className="w-3 h-3" />
                          <span>Summary</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}
            {/* Conversation History */}
            <div className="flex flex-col gap-8 max-w-4xl mx-auto">
              {messages.length === 0 || !currentConversationId ? (
                <div className="text-text-secondary text-center py-12">
                  <div className="mb-4">
                    <MessageSquare className="w-12 h-12 mx-auto text-text-tertiary opacity-30" />
                  </div>
                  <p className="text-xl">Welcome to your learning session!</p>
                  <p className="text-sm mt-2 text-text-tertiary">What would you like to learn about today? Type a message or use your microphone to begin.</p>
                </div>
              ) : (
                messages
                  .filter(item => item.conversation_id === currentConversationId)
                  .map((item) => (
                  <motion.div
                    key={item.id}
                    className={`mb-6 whitespace-pre-wrap ${item.type === "ai" ? "p-6 bg-[#323a45]/40 rounded-lg border-l-2 border-primary-DEFAULT/20" : "px-2"}`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                    style={{
                      willChange: "opacity",
                      contain: "content",
                      contentVisibility: "auto"
                    }}
                  >
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
                          <div className="text-sm text-text-secondary font-medium">
                            Teacher
                          </div>
                        </>
                      )}
                    </div>

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
                        {renderEnhancedResponse(item.text)}
                      </div>
                    )}

                    {item.type === "ai" && (
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
