"use client";

import React from 'react';
import { ChevronDown, ChevronRight, Target, Code, FileText, CheckCircle } from 'lucide-react';

interface CourseChapter {
  id: string;
  number: number;
  title: string;
  isActive: boolean;
  isExpanded: boolean;
}

interface CourseNavigationProps {
  chapters: CourseChapter[];
  toggleChapter: (chapterId: string) => void;
  navigateToChapter: (chapterId: string) => void;
  navigateToSection: (chapterId: string, sectionName: string) => void;
}

export function CourseNavigation({
  chapters,
  toggleChapter,
  navigateToChapter,
  navigateToSection
}: CourseNavigationProps) {
  if (chapters.length === 0) return null;

  return (
    <>
      {/* Desktop Course Navigation */}
      <div className="hidden md:block w-64 h-full border-r border-bg-tertiary/50 overflow-y-auto pt-4 pb-20 bg-bg-secondary/30">
        <div className="px-4 py-2 mb-2">
          <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider">Course Contents</h3>
        </div>
        <div className="space-y-1">
          {chapters.map(chapter => (
            <div key={chapter.id} className="px-2">
              <button
                onClick={() => toggleChapter(chapter.id)}
                className={`w-full text-left px-3 py-2 rounded-md flex items-center justify-between text-sm ${
                  chapter.isActive
                    ? 'bg-primary-DEFAULT/10 text-primary-DEFAULT font-medium'
                    : 'hover:bg-bg-tertiary/30 text-text-primary'
                }`}
              >
                <div className="flex items-center gap-2">
                  {chapter.isExpanded ? (
                    <ChevronDown className="w-4 h-4 flex-shrink-0" />
                  ) : (
                    <ChevronRight className="w-4 h-4 flex-shrink-0" />
                  )}
                  <span>Chapter {chapter.number}: {chapter.title}</span>
                </div>
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

      {/* Mobile Course Navigation */}
      <div className="md:hidden mb-6 bg-bg-secondary/30 rounded-lg border border-bg-tertiary/50 overflow-hidden">
        <div className="p-3 border-b border-bg-tertiary/50">
          <h3 className="text-sm font-semibold text-text-secondary">Course Contents</h3>
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
