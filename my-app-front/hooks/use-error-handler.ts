"use client";

import { useToast } from '@/components/ui/toast';

// Define error types for better error handling
export type ErrorType = 
  | 'connection' 
  | 'api' 
  | 'conversation' 
  | 'transcription' 
  | 'audio' 
  | 'unknown';

// Interface for error details
interface ErrorDetails {
  type: ErrorType;
  message: string;
  originalError?: unknown;
}

/**
 * Custom hook for centralized error handling
 * 
 * This hook provides a consistent way to handle errors across the application
 * and display user-friendly error messages using the toast system.
 */
export function useErrorHandler() {
  const { addToast } = useToast();

  /**
   * Handle an error and display a user-friendly message
   * 
   * @param error - The error to handle
   * @param type - The type of error
   * @param customMessage - Optional custom message to display
   */
  const handleError = (
    error: unknown, 
    type: ErrorType = 'unknown', 
    customMessage?: string
  ) => {

    
    // Create error details
    const errorDetails: ErrorDetails = {
      type,
      message: getUserFriendlyMessage(error, type, customMessage),
      originalError: error
    };


    
    // Show toast notification with user-friendly message
    addToast(errorDetails.message, 'error');
    
    return errorDetails;
  };

  /**
   * Get a user-friendly error message based on the error type and details
   */
  const getUserFriendlyMessage = (
    error: unknown, 
    type: ErrorType, 
    customMessage?: string
  ): string => {
    // If a custom message is provided, use it
    if (customMessage) return customMessage;
    
    // If the error is an Error object with a message, use it
    if (error instanceof Error) {
      // For specific error types, provide more helpful messages
      if (error.message.includes('Failed to fetch') || 
          error.message.includes('NetworkError')) {
        return 'Network connection issue. Please check your internet connection.';
      }
      
      if (error.message.includes('timeout') || 
          error.message.includes('Timeout')) {
        return 'Request timed out. Please try again.';
      }
      
      // Return the error message for other cases
      return error.message;
    }
    
    // Default messages based on error type
    switch (type) {
      case 'connection':
        return 'Connection error. Please check your internet connection and try again.';
      case 'api':
        return 'Server error. Please try again later.';
      case 'conversation':
        return 'Error managing conversations. Your changes may not have been saved.';
      case 'transcription':
        return 'Error processing your speech. Please try again.';
      case 'audio':
        return 'Audio playback error. Please check your audio settings.';
      case 'unknown':
      default:
        return 'An unexpected error occurred. Please try again.';
    }
  };

  return { handleError };
}
