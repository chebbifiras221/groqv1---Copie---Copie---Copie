/**
 * Text cleaning utilities for TTS and content processing
 */

/**
 * Clean text for TTS by removing markdown, special characters, and formatting
 */
export function cleanTextForTTS(text: string): string {
  return text
    // Remove markdown formatting
    .replace(/\*\*\*(.*?)\*\*\*/g, '$1') // Triple asterisks (bold+italic)
    .replace(/\*\*(.*?)\*\*/g, '$1')     // Double asterisks (bold)
    .replace(/\*(.*?)\*/g, '$1')         // Single asterisks (italic)
    .replace(/\*/g, ' ')                 // Any remaining asterisks

    // Handle markdown links
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Replace [text](url) with just text

    // Handle code blocks and inline code
    .replace(/```[\s\S]*?```/g, '') // Remove code blocks entirely
    .replace(/`([^`]+)`/g, '$1')         // Replace inline code with just the code

    // Handle markdown headers - replace # with nothing
    .replace(/^#{1,6}\s+(.+)$/gm, '$1') // Replace # Header with just Header
    .replace(/#{1,6}\s+/g, '') // Remove any remaining # symbols at the beginning of lines

    // Handle markdown lists
    .replace(/^[\s]*[-*+]\s+/gm, '') // Replace bullet points
    .replace(/^[\s]*\d+\.\s+/gm, '') // Replace numbered lists

    // Handle special characters
    .replace(/&[a-z]+;/g, ' ')       // Replace HTML entities like &nbsp; with space
    .replace(/[_=+]/g, ' ')          // Replace underscores, equals, plus with spaces

    // Remove any remaining markdown symbols that might be read aloud
    .replace(/\[(\/?)(?:EXPLAIN|CODE)\]/gi, '')

    // Handle special programming terms
    .replace(/C\+\+/g, 'C plus plus')
    .replace(/\.NET/g, 'dot net')
    .replace(/\b\d+\.\d+/g, (match) => match.replace('.', ' point ')) // Convert decimals to "X point Y"

    // Handle mathematical notation
    .replace(/O\(n[²^2]\)/g, 'O of n squared')
    .replace(/O\(log n\)/g, 'O of log n')
    .replace(/x[²^2]/g, 'x squared')
    .replace(/f'\(x\)/g, 'f prime of x')
    .replace(/f\(x\)/g, 'f of x')

    // Clean up extra whitespace
    .replace(/\s+/g, ' ')            // Replace multiple spaces with a single space
    .trim();                         // Remove leading/trailing whitespace
}

/**
 * Remove special section markers from text
 */
export function removeSpecialSectionMarkers(text: string): string {
  return text
    .replace(/\[\s*CODE\s*\]([\s\S]*?)\[\s*\/\s*CODE\s*\]/g, '')
    .replace(/\[\s*EXPLAIN\s*\]([\s\S]*?)\[\s*\/\s*EXPLAIN\s*\]/g, '$1')
    .replace(/\[\s*BOARD\s*\]([\s\S]*?)\[\s*\/\s*BOARD\s*\]/g, '$1'); // Keep content, remove markers
}

/**
 * Add natural pauses to text for TTS
 */
export function addNaturalPauses(text: string): string {
  return text
    .replace(/<break[^>]*>/g, '')
    .replace(/<[^>]*>/g, '')
    .replace(/\bbreaktime\b/g, '')
    .replace(/\.\s+/g, '. ')
    .replace(/\!\s+/g, '! ')
    .replace(/\?\s+/g, '? ');
}

/**
 * Extract explanation blocks from text
 */
export function extractExplanationBlocks(text: string): string[] {
  const explainRegex = /\[\s*EXPLAIN\s*\]([\s\S]*?)\[\s*\/\s*EXPLAIN\s*\]/g;
  const explanations: string[] = [];
  let match;

  while ((match = explainRegex.exec(text)) !== null) {
    explanations.push(match[1].trim());
  }

  return explanations;
}

/**
 * Check if text contains special sections
 */
export function hasSpecialSections(text: string): boolean {
  return /\[\s*(?:EXPLAIN|CODE)\s*\]/.test(text);
}
