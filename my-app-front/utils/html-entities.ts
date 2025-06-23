/**
 * Utility functions for handling HTML entities
 */

const HTML_ENTITY_REPLACEMENTS: ReadonlyArray<[RegExp, string]> = [
  [/&quot;/g, '"'],
  [/&#039;/g, "'"],
  [/&#x27;/g, "'"],
  [/&lt;/g, '<'],
  [/&gt;/g, '>'],
  [/&amp;/g, '&'],
  [/&nbsp;/g, ' ']
] as const;

const applyEntityReplacements = (text: string): string => {
  return HTML_ENTITY_REPLACEMENTS.reduce((result: string, [regex, replacement]) =>
    result.replace(regex, replacement), text);
};

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
      return applyEntityReplacements(decoded);
    } catch (e) {
      console.warn("Error decoding HTML entities, using fallback:", e);
      // Fall through to manual replacement
    }
  }

  // Fallback for non-browser environments or if the browser method fails
  return applyEntityReplacements(text);
}
