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

/**
 * Encodes special characters as HTML entities
 * @param text The text to encode
 * @returns The encoded text
 */
export function encodeHtmlEntities(text: string): string {
  if (!text) return '';

  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Safely decodes HTML entities in a string that might contain HTML tags
 * This preserves HTML tags while decoding entities in the text content
 * @param html The HTML string to process
 * @returns The processed HTML with decoded entities in text content
 */
export function safeDecodeHtmlEntities(html: string): string {
  if (!html) return '';

  // Create a temporary element to parse the HTML
  const tempElement = document.createElement('div');
  tempElement.innerHTML = html;

  // Process all text nodes
  const textNodes = getAllTextNodes(tempElement);
  textNodes.forEach(node => {
    if (node.nodeValue) {
      node.nodeValue = decodeHtmlEntities(node.nodeValue);
    }
  });

  return tempElement.innerHTML;
}

/**
 * Helper function to get all text nodes in an element
 * @param element The element to search
 * @returns Array of text nodes
 */
function getAllTextNodes(element: Node): Text[] {
  const textNodes: Text[] = [];

  function getTextNodes(node: Node) {
    if (node.nodeType === Node.TEXT_NODE) {
      textNodes.push(node as Text);
    } else {
      for (let i = 0; i < node.childNodes.length; i++) {
        getTextNodes(node.childNodes[i]);
      }
    }
  }

  getTextNodes(element);
  return textNodes;
}
