/**
 * Utility functions for handling images
 */

/**
 * Validates if a URL is a valid image URL
 * @param url The URL to validate
 * @returns True if the URL is a valid image URL, false otherwise
 */
export function isValidImageUrl(url: string): boolean {
  if (!url) return false;
  
  // Check if it's a valid URL
  try {
    new URL(url);
  } catch (e) {
    // If it's not a valid URL, check if it's a valid path
    if (!url.startsWith('/')) {
      return false;
    }
  }
  
  // Check if it has a valid image extension
  const validExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.ico'];
  return validExtensions.some(ext => url.toLowerCase().endsWith(ext));
}

/**
 * Creates a public URL for an image
 * @param path The path to the image
 * @returns The public URL for the image
 */
export function getPublicImageUrl(path: string): string {
  if (!path) return '';
  
  // If it's already a full URL, return it
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  
  // If it's a path, make sure it starts with a slash
  if (!path.startsWith('/')) {
    path = `/${path}`;
  }
  
  return path;
}

/**
 * Loads a custom bot icon from the config or falls back to the default
 * @param customUrl Optional custom URL to override the config
 * @returns The URL to use for the bot icon
 */
export function getBotIconUrl(customUrl?: string): string {
  // First check the provided custom URL
  if (customUrl && isValidImageUrl(customUrl)) {
    return getPublicImageUrl(customUrl);
  }
  
  // Then check the config
  const { AppConfig } = require('@/config/app-config');
  if (AppConfig.customBotIconUrl && isValidImageUrl(AppConfig.customBotIconUrl)) {
    return getPublicImageUrl(AppConfig.customBotIconUrl);
  }
  
  // Fall back to default (empty string means use the default bot face)
  return '';
}
