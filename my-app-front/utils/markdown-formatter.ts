import { decodeHtmlEntities } from "./html-entities";

const MAX_DECODE_ITERATIONS = 3;

/**
 * Processes code tags in text to ensure HTML entities are properly decoded
 */
export const processCodeTags = (text: string): string => {
  if (!text) return text;

  // Find all [CODE]...[/CODE] sections and decode HTML entities inside them
  const codeTagRegex = /\[\s*CODE\s*\]([\s\S]*?)\[\s*\/\s*CODE\s*\]/g;

  return text.replace(codeTagRegex, (match, codeContent) => {
    // Decode HTML entities in the code content multiple times to handle nested encodings
    let decodedContent = codeContent;
    for (let i = 0; i < MAX_DECODE_ITERATIONS; i++) {
      decodedContent = decodeHtmlEntities(decodedContent);
    }

    return `[CODE]${decodedContent}[/CODE]`;
  });
};

/**
 * Parses markdown tables from an array of text lines
 */
export const parseMarkdownTable = (lines: string[], startIndex: number) => {
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
      .map(cell => decodeHtmlEntities(cell.trim()));

    // Parse data rows
    const rows = dataRows.map(row => {
      return row
        .trim()
        .split('|')
        .filter(cell => cell.trim() !== '')
        .map(cell => decodeHtmlEntities(cell.trim()));
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

interface Section {
  type: string;
  content: string;
  startIndex: number;
  endIndex: number;
}

/**
 * Finds outermost sections of a specific type in text
 */
export const findOutermostSections = (text: string, sectionType: string): Section[] => {
  const sections: Section[] = [];
  const openTagPattern = new RegExp(`\\[\\s*${sectionType}\\s*\\]`, 'g');
  const closeTagPattern = new RegExp(`\\[\\s*\\/\\s*${sectionType}\\s*\\]`, 'g');

  // Reset regex patterns
  openTagPattern.lastIndex = 0;
  closeTagPattern.lastIndex = 0;

  // Find all opening tags
  const openings = [];
  let openMatch;
  while ((openMatch = openTagPattern.exec(text)) !== null) {
    openings.push({
      index: openMatch.index,
      end: openMatch.index + openMatch[0].length
    });
  }

  // Find all closing tags
  const closings = [];
  let closeMatch;
  while ((closeMatch = closeTagPattern.exec(text)) !== null) {
    closings.push({
      index: closeMatch.index,
      end: closeMatch.index + closeMatch[0].length
    });
  }

  // Match opening and closing tags
  const usedClosingIndices = new Set<number>();

  for (const opening of openings) {
    // Find the next closing tag that comes after this opening tag
    const matchingClosing = closings.find((closing, index) =>
      !usedClosingIndices.has(index) &&
      closing.index > opening.end &&
      // Make sure there's no other opening tag of the same type between them
      !openings.some(o => o.index > opening.end && o.index < closing.index)
    );

    if (matchingClosing) {
      // Found a complete section
      sections.push({
        type: sectionType.toLowerCase(),
        content: text.substring(opening.end, matchingClosing.index),
        startIndex: opening.index,
        endIndex: matchingClosing.end
      });

      // Mark this closing tag as used
      usedClosingIndices.add(closings.indexOf(matchingClosing));
    }
  }

  return sections;
};

/**
 * Processes text to enhance formatting for special sections
 */
const SECTION_EMOJI_MAP = [
  ['Learning Objectives', '🎯'],
  ['Practice Exercises', '💻'],
  ['Quiz', '📝'],
  ['Summary', '📌'],
  ['Key Takeaways', '🔑'],
  ['Further Reading', '📚'],
  ['Practical Application', '🛠️'],
  ['Course Progress', '📊']
] as const;

export const processTextForSpecialSections = (text: string): string => {
  if (!text) return text;

  let processedText = text;

  // Add special styling for section headers
  for (const [section, emoji] of SECTION_EMOJI_MAP) {
    const regex = new RegExp(`####\\s+${section}`, 'g');
    processedText = processedText.replace(regex, `#### ${emoji} ${section}`);
  }

  // Remove any remaining markers that might be visible in the final output
  return processedText
    .replace(/\[\s*EXPLAIN\s*\]\s*$/g, '') // Remove [EXPLAIN] at the end of the text
    .replace(/^\s*\[\s*\/EXPLAIN\s*\]/g, '') // Remove [/EXPLAIN] at the beginning of the text
    // Remove all board sections completely - extract content and remove markers
    .replace(/\[\s*BOARD\s*\]([\s\S]*?)\[\s*\/\s*BOARD\s*\]/g, '$1')
    // Clean up any remaining board markers
    .replace(/\[\s*\/?BOARD\s*\]/g, '');
};
