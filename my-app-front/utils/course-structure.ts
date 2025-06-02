// Regular expressions to detect chapter titles
const chapterRegex = /^## Chapter (\d+): (.+)$/;
// New regex to match the format in the image (numbered list with asterisks)
// This captures the number before the dot as the chapter number
const outlineChapterRegex = /^\s*(\d+)\.\s+\*\*([^*]+)\*\*$/;
// Additional regex to match other common outline formats
// This also captures the number before the dot as the chapter number
const altOutlineRegex = /^\s*(\d+)\.\s+(.*?)$/;
// More comprehensive regex patterns for different chapter formats
const boldChapterRegex = /^\s*\*\*Chapter (\d+):\s*([^*]+)\*\*$/;
const numberedBoldRegex = /^\s*(\d+)\.\s*\*\*([^*]+)\*\*.*$/;
const simpleNumberedRegex = /^\s*(\d+)\.\s+([A-Z][^.\n]*?)(?:\s*$|\s*\n)/;

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
  // Reset regex lastIndex
  chapterRegex.lastIndex = 0;

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

      console.log(`Added chapter ${chapterNumber}: ${cleanTitle}`);
      return true;
    }
    return false;
  };

  // First pass: look for traditional chapter format (## Chapter X: Title)
  let foundTraditionalFormat = false;

  lines.forEach((line, index) => {
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
      const match = line.match(boldChapterRegex);
      if (match) {
        foundTraditionalFormat = true;
        const chapterNumber = parseInt(match[1]);
        const chapterTitle = match[2];
        addChapter(chapterNumber, chapterTitle, index);
      }
    });
  }

  // If no traditional format found, look for outline format
  if (!foundTraditionalFormat) {
    // Reset used chapter numbers for the outline format
    usedChapterNumbers.clear();
    processedChapters.clear();

    // Try numbered bold format first (1. **Title**)
    lines.forEach((line, index) => {
      const match = line.match(numberedBoldRegex);
      if (match) {
        const chapterNumber = parseInt(match[1]);
        const chapterTitle = match[2];
        addChapter(chapterNumber, chapterTitle, index);
      }
    });

    // If no numbered bold found, try the primary outline regex (with asterisks)
    if (chapters.length === 0) {
      lines.forEach((line, index) => {
        const match = line.match(outlineChapterRegex);
        if (match) {
          const chapterNumber = parseInt(match[1]);
          const chapterTitle = match[2];
          addChapter(chapterNumber, chapterTitle, index);
        }
      });
    }

    // If still no chapters found, try simple numbered format
    if (chapters.length === 0) {
      lines.forEach((line, index) => {
        const match = line.match(simpleNumberedRegex);
        if (match) {
          const chapterNumber = parseInt(match[1]);
          const chapterTitle = match[2];
          // Only add if it looks like a chapter title (reasonable length, starts with capital)
          if (chapterTitle.length > 3 && chapterTitle.length < 100 && /^[A-Z]/.test(chapterTitle)) {
            addChapter(chapterNumber, chapterTitle, index);
          }
        }
      });
    }

    // If still no chapters found, try the alternative outline regex
    if (chapters.length === 0) {
      lines.forEach((line, index) => {
        const match = line.match(altOutlineRegex);
        if (match) {
          const chapterNumber = parseInt(match[1]);
          const chapterTitle = match[2];
          // Only add if it looks like a chapter title
          if (chapterTitle.length > 3 && chapterTitle.length < 100) {
            addChapter(chapterNumber, chapterTitle, index);
          }
        }
      });
    }
  }

  // Sort chapters by number before returning
  const sortedChapters = chapters.sort((a, b) => a.number - b.number);

  console.log(`Final extracted chapters (${sortedChapters.length}):`, sortedChapters.map(ch => `${ch.number}. ${ch.title}`));

  return sortedChapters;
};
