import { decodeHtmlEntities } from "./html-entities";

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
    for (let i = 0; i < 3; i++) {
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
        .filter(cell => cell !== '')
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

/**
 * Finds outermost sections of a specific type in text
 */
export const findOutermostSections = (text: string, sectionType: string) => {
  const sections = [];
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
  for (const opening of openings) {
    // Find the next closing tag that comes after this opening tag
    const matchingClosing = closings.find(closing =>
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

      // Remove this closing tag so it's not matched again
      closings.splice(closings.indexOf(matchingClosing), 1);
    }
  }

  return sections;
};

/**
 * Processes text to enhance formatting for special sections
 */
export const processTextForSpecialSections = (text: string): string => {
  if (!text) return text;
  
  return text
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
    .replace(/####\s+Course Progress/g, '#### 📊 Course Progress')
    // Add special handling for code snippets between board and explain sections
    .replace(/\[\s*\/\s*BOARD\s*\]\s*(```[\s\S]*?```)\s*\[\s*EXPLAIN\s*\]/g, '[/BOARD]\n\n$1\n\n[EXPLAIN]')
    // Ensure there's a title in the board section before code snippets
    .replace(/\[\s*BOARD\s*\]\s*(?!\s*##)([^\n]*?)\s*\[\s*\/\s*BOARD\s*\]\s*(```[\s\S]*?```)/g, (match, content, code) => {
      // If there's content but no title, add a title format
      if (content.trim()) {
        return `[BOARD]\n## ${content.trim()}\n[/BOARD]\n\n${code}`;
      }
      // If there's no content, add a generic title based on the code language
      const langMatch = code.match(/```(\w+)/);
      const lang = langMatch ? langMatch[1] : 'code';
      return `[BOARD]\n## Code Example in ${lang.charAt(0).toUpperCase() + lang.slice(1)}\n[/BOARD]\n\n${code}`;
    })
    // Remove any remaining markers that might be visible in the final output
    .replace(/\[\s*BOARD\s*\]\s*$/g, '')  // Remove [BOARD] at the end of the text
    .replace(/\[\s*EXPLAIN\s*\]\s*$/g, '') // Remove [EXPLAIN] at the end of the text
    .replace(/^\s*\[\s*\/BOARD\s*\]/g, '') // Remove [/BOARD] at the beginning of the text
    .replace(/^\s*\[\s*\/EXPLAIN\s*\]/g, ''); // Remove [/EXPLAIN] at the beginning of the text
};
