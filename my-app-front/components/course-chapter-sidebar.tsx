"use client";

import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Target, Code, FileText, CheckCircle } from 'lucide-react';

interface CourseChapter {
  id: string;
  number: number;
  title: string;
  isActive: boolean;
  isExpanded: boolean;
}

interface CourseChapterSidebarProps {
  chapter: CourseChapter;
  isActive: boolean;
  onToggleExpand: () => void;
  onNavigateToSection: (sectionName: string) => void;
}

export function CourseChapterSidebar({
  chapter,
  isActive,
  onToggleExpand,
  onNavigateToSection
}: CourseChapterSidebarProps) {
  return (
    <div className="mb-2">
      <button
        onClick={onToggleExpand}
        className={`w-full text-left px-3 py-2 rounded-md flex items-center justify-between text-sm ${
          isActive
            ? 'bg-primary-DEFAULT/15 text-primary-DEFAULT font-medium'
            : 'hover:bg-bg-tertiary/40 text-text-primary'
        }`}
      >
        <div className="flex items-center gap-2">
          {chapter.isExpanded ? (
            <ChevronDown className="w-4 h-4 flex-shrink-0" />
          ) : (
            <ChevronRight className="w-4 h-4 flex-shrink-0" />
          )}
          <span className="font-medium">{chapter.number}. {chapter.title}</span>
        </div>
      </button>

      {chapter.isExpanded && (
        <div className="ml-4 pl-2 border-l border-bg-tertiary/50 mt-1 mb-2 space-y-1">
          <button
            onClick={() => onNavigateToSection("Learning Objectives")}
            className="w-full text-left px-3 py-1.5 rounded-md text-sm hover:bg-bg-tertiary/40 flex items-center gap-2 text-text-secondary"
          >
            <Target className="w-3.5 h-3.5 text-primary-DEFAULT/80" />
            <span>Learning Objectives</span>
          </button>
          <button
            onClick={() => onNavigateToSection("Practice Exercises")}
            className="w-full text-left px-3 py-1.5 rounded-md text-sm hover:bg-bg-tertiary/40 flex items-center gap-2 text-text-secondary"
          >
            <Code className="w-3.5 h-3.5 text-success-DEFAULT/80" />
            <span>Practice Exercises</span>
          </button>
          <button
            onClick={() => onNavigateToSection("Quiz")}
            className="w-full text-left px-3 py-1.5 rounded-md text-sm hover:bg-bg-tertiary/40 flex items-center gap-2 text-text-secondary"
          >
            <FileText className="w-3.5 h-3.5 text-warning-DEFAULT/80" />
            <span>Quiz</span>
          </button>
          <button
            onClick={() => onNavigateToSection("Summary")}
            className="w-full text-left px-3 py-1.5 rounded-md text-sm hover:bg-bg-tertiary/40 flex items-center gap-2 text-text-secondary"
          >
            <CheckCircle className="w-3.5 h-3.5 text-info-DEFAULT/80" />
            <span>Summary</span>
          </button>
        </div>
      )}
    </div>
  );
}
