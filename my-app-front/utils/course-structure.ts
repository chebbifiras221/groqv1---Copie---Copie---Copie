// Regular expressions to detect chapter titles (simplified and consolidated)
const chapterRegex = /^## Chapter (\d+): (.+)$/;
const boldChapterRegex = /^\s*\*\*Chapter (\d+):\s*([^*]+)\*\*$/;
const numberedBoldRegex = /^\s*(\d+)\.\s*\*\*([^*]+)\*\*.*$/;
const cleanOutlineRegex = /^\s*(\d+)\.\s+([A-Z][^#\n]*?)(?:\s*$|\s*\n)/;
const subtopicRegex = /^### \d+\.\d+:/;

// Constants for validation
const MIN_CHAPTER_TITLE_LENGTH = 3;
const MAX_CHAPTER_TITLE_LENGTH = 100;

export interface ChapterData {
  id: string;
  number: number;
  title: string;
  isActive: boolean;
  isExpanded: boolean;
}

/**
 * Extracts course structure from text
 */
export const extractCourseStructure = (text: string): ChapterData[] => {
  // Find all chapter headings
  const chapters: ChapterData[] = [];
  const lines = text.split('\n');

  // Keep track of chapters we've already processed to avoid duplicates
  const processedChapters = new Set<string>();
  // Keep track of chapter numbers we've seen to avoid duplicates
  const usedChapterNumbers = new Set<number>();

  // Helper function to add a chapter if it's not a duplicate
  const addChapter = (chapterNumber: number, chapterTitle: string, lineIndex: number) => {
    // Clean up the title
    const cleanTitle = chapterTitle.trim().replace(/\*\*/g, '').replace(/[:\-\s]*$/, '');

    // Create a unique key for this chapter
    const chapterKey = `${chapterNumber}-${cleanTitle}`;

    // Only add this chapter if we haven't seen it before
    if (!processedChapters.has(chapterKey) && !usedChapterNumbers.has(chapterNumber) && cleanTitle.length > 0) {
      processedChapters.add(chapterKey);
      usedChapterNumbers.add(chapterNumber);

      // Add to chapters array with a unique ID that includes the index
      chapters.push({
        id: `chapter-${chapterNumber}-${lineIndex}`,
        number: chapterNumber,
        title: cleanTitle,
        isActive: chapters.length === 0, // First chapter is active by default
        isExpanded: chapters.length === 0 // First chapter is expanded by default
      });

      return true;
    }
    return false;
  };

  // First pass: look for traditional chapter format (## Chapter X: Title)
  let foundTraditionalFormat = false;

  lines.forEach((line, index) => {
    // Skip subtopic lines (### X.Y: format) - these should not be treated as chapters
    if (line.match(subtopicRegex)) {
      return;
    }

    const match = line.match(chapterRegex);
    if (match) {
      foundTraditionalFormat = true;
      const chapterNumber = parseInt(match[1]);
      const chapterTitle = match[2];
      addChapter(chapterNumber, chapterTitle, index);
    }
  });

  // Second pass: look for bold chapter format (**Chapter X: Title**)
  if (!foundTraditionalFormat) {
    lines.forEach((line, index) => {
      // Skip subtopic lines (### X.Y: format) - these should not be treated as chapters
      if (line.match(subtopicRegex)) {
        return;
      }

      const match = line.match(boldChapterRegex);
      if (match) {
        const chapterNumber = parseInt(match[1]);
        const chapterTitle = match[2];
        addChapter(chapterNumber, chapterTitle, index);
      }
    });
  }

  // If no traditional format found, look for outline format
  if (!foundTraditionalFormat) {
    // Simplified outline format detection - try patterns in order of preference
    const outlinePatterns = [
      cleanOutlineRegex,      // 1. Chapter Title
      numberedBoldRegex       // 1. **Title**
    ];

    for (const pattern of outlinePatterns) {
      if (chapters.length > 0) break; // Stop if we found chapters

      lines.forEach((line, index) => {
        // Skip subtopic lines (### X.Y: format) - these should not be treated as chapters
        if (line.match(subtopicRegex)) {
          return;
        }

        const match = line.match(pattern);
        if (match) {
          const chapterNumber = parseInt(match[1]);
          const chapterTitle = match[2];
          // Basic validation for chapter titles
          if (chapterTitle.length > MIN_CHAPTER_TITLE_LENGTH && chapterTitle.length < MAX_CHAPTER_TITLE_LENGTH) {
            addChapter(chapterNumber, chapterTitle, index);
          }
        }
      });
    }
  }

  // Sort chapters by number before returning
  return chapters.sort((a, b) => a.number - b.number);
};
