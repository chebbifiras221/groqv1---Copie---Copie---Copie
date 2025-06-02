"use client";

import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronRight, Target, Code, FileText, CheckCircle, Clock, ListChecks, BookOpen } from 'lucide-react';
import { CourseChapterSidebar } from './course-chapter-sidebar';

interface CourseChapter {
  id: string;
  number: number;
  title: string;
  isActive: boolean;
  isExpanded: boolean;
}

interface CourseUIProps {
  chapters: CourseChapter[];
  toggleChapter: (chapterId: string) => void;
  navigateToChapter: (chapterId: string) => void;
  navigateToSection: (chapterId: string, sectionName: string) => void;
  isTeacherMode: boolean;
  isFirstConversationLayout?: boolean; // New prop to indicate special layout
}

export function CourseUI({
  chapters,
  toggleChapter,
  navigateToChapter,
  navigateToSection,
  isTeacherMode,
  isFirstConversationLayout = false
}: CourseUIProps) {
  // Listen for course UI reset events
  useEffect(() => {
    const handleCourseReset = (event: Event) => {
      // The course chapters state is managed in the parent component (typewriter),
      // so we don't need to do anything here
    };

    window.addEventListener('course-ui-reset', handleCourseReset);
    return () => window.removeEventListener('course-ui-reset', handleCourseReset);
  }, []);

  // Only render if we have chapters to display
  if (!chapters || chapters.length === 0) return null;

  return (
    <>
      {/* Desktop Course Navigation */}
      <div className={`hidden md:block h-full overflow-y-auto pt-4 pb-20 ${
        isFirstConversationLayout
          ? 'w-full bg-bg-secondary' // Full width for special layout, no extra borders
          : 'w-64 border-r border-bg-tertiary/50 bg-bg-secondary/50' // Regular layout
      }`}>
        <div className="px-4 py-2 mb-2 flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-primary-DEFAULT" />
          <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider">Course Outline</h3>
        </div>
        <div className="space-y-1 px-2">
          {chapters.map(chapter => (
            <CourseChapterSidebar
              key={chapter.id}
              chapter={chapter}
              isActive={chapter.isActive}
              onToggleExpand={() => toggleChapter(chapter.id)}
              onNavigateToSection={(sectionName) => navigateToSection(chapter.id, sectionName)}
            />
          ))}
        </div>
      </div>

      {/* Mobile Course Navigation */}
      <div className="md:hidden mb-6 bg-bg-secondary/50 rounded-lg border border-bg-tertiary/50 overflow-hidden">
        <div className="p-3 border-b border-bg-tertiary/50 flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-primary-DEFAULT" />
          <h3 className="text-sm font-semibold text-text-secondary">Course Outline</h3>
        </div>
        <div className="p-2 max-h-48 overflow-y-auto">
          <select
            className="w-full p-2 bg-bg-primary border border-bg-tertiary rounded-md text-sm"
            onChange={(e) => navigateToChapter(e.target.value)}
            value={chapters.find(ch => ch.isActive)?.id || ''}
          >
            {chapters.map(chapter => (
              <option key={chapter.id} value={chapter.id}>
                Chapter {chapter.number}: {chapter.title}
              </option>
            ))}
          </select>

          {/* Quick section navigation */}
          <div className="grid grid-cols-2 gap-2 mt-3">
            {chapters.find(ch => ch.isActive) && (
              <>
                <button
                  onClick={() => navigateToSection(
                    chapters.find(ch => ch.isActive)?.id || '',
                    "Learning Objectives"
                  )}
                  className="p-2 bg-bg-tertiary/20 rounded text-xs flex items-center justify-center gap-1"
                >
                  <Target className="w-3 h-3" />
                  <span>Objectives</span>
                </button>
                <button
                  onClick={() => navigateToSection(
                    chapters.find(ch => ch.isActive)?.id || '',
                    "Practice Exercises"
                  )}
                  className="p-2 bg-bg-tertiary/20 rounded text-xs flex items-center justify-center gap-1"
                >
                  <Code className="w-3 h-3" />
                  <span>Exercises</span>
                </button>
                <button
                  onClick={() => navigateToSection(
                    chapters.find(ch => ch.isActive)?.id || '',
                    "Quiz"
                  )}
                  className="p-2 bg-bg-tertiary/20 rounded text-xs flex items-center justify-center gap-1"
                >
                  <FileText className="w-3 h-3" />
                  <span>Quiz</span>
                </button>
                <button
                  onClick={() => navigateToSection(
                    chapters.find(ch => ch.isActive)?.id || '',
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
    </>
  );
}
