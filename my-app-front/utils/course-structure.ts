// Regular expressions to detect chapter titles
const chapterRegex = /^## Chapter (\d+): (.+)$/;
// New regex to match the format in the image (numbered list with asterisks)
// This captures the number before the dot as the chapter number
const outlineChapterRegex = /^\s*(\d+)\.\s+\*\*([^*]+)\*\*$/;
// Additional regex to match other common outline formats
// This also captures the number before the dot as the chapter number
const altOutlineRegex = /^\s*(\d+)\.\s+(.*?)$/;

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
