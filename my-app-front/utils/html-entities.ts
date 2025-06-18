/**
 * Utility functions for handling HTML entities
 */

/**
 * Decodes HTML entities in a string
 * @param text The text containing HTML entities to decode
 * @returns The decoded text
 */
export function decodeHtmlEntities(text: string): string {
  if (!text) return '';

  // Create a temporary element to use the browser's built-in HTML entity decoding
  if (typeof document !== 'undefined') {
    try {
      // Use the browser's built-in decoder
      const textarea = document.createElement('textarea');
      textarea.innerHTML = text;
      const decoded = textarea.value;

      // Additional manual replacements for common entities that might be missed
      return decoded
        .replace(/&quot;/g, '"')
        .replace(/&#039;/g, "'")
        .replace(/&#x27;/g, "'")
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .replace(/&nbsp;/g, ' ');
    } catch (e) {
      console.error("Error decoding HTML entities:", e);
    }
  }

  // Fallback for non-browser environments or if the browser method fails
  return text
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ');
}

// Note: encodeHtmlEntities, safeDecodeHtmlEntities, and getAllTextNodes functions
// have been removed as they were not being used anywhere in the codebase.
// If you need HTML entity encoding in the future, you can add back:
// - encodeHtmlEntities() for encoding text to HTML entities
// - safeDecodeHtmlEntities() for safely decoding entities while preserving HTML tags
