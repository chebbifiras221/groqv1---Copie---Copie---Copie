"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { AuthRequest, AuthResponse } from "@/app/api/auth/route";

/**
 * User data structure
 */
type User = {
  id: string;        // Unique user ID
  username: string;  // Display name
};

/**
 * Authentication context interface
 */
type AuthContextType = {
  user: User | null;                                              // Current user or null
  token: string | null;                                           // JWT token or null
  isAuthenticated: boolean;                                       // True if user is logged in
  isLoading: boolean;                                            // True during auth operations
  error: string | null;                                          // Error message or null
  errorType?: 'username' | 'password' | string;                 // Specific error type
  login: (username: string, password: string) => Promise<boolean>;   // Login function
  register: (username: string, password: string) => Promise<boolean>; // Register function
  logout: () => void;                                            // Logout function
  clearError: () => void;                                        // Clear error function
};

// React context for authentication state
const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Authentication Provider - manages user login/logout state across the app
 */
export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);           // Current user
  const [token, setToken] = useState<string | null>(null);       // JWT token
  const [errorType, setErrorType] = useState<'username' | 'password' | string | undefined>(undefined); // Error type
  const [isLoading, setIsLoading] = useState(true);              // Loading state
  const [error, setError] = useState<string | null>(null);       // Error message

  /**
   * Check for existing authentication on app startup
   */
  useEffect(() => {
    const checkAuth = async () => {
      setIsLoading(true);

      const storedToken = localStorage.getItem("auth_token");
      const storedUser = localStorage.getItem("auth_user");

      if (storedToken && storedUser) {
        try {
          // Set stored values first to prevent UI flicker
          setToken(storedToken);
          setUser(JSON.parse(storedUser));

          // Verify token is still valid
          const isValid = await verifyToken(storedToken);

          if (!isValid) {
            console.log("Stored token is invalid, clearing auth state");
            logout();
          }
        } catch (err) {
          console.error("Error checking authentication:", err);
          logout();
        }
      }

      setIsLoading(false);
    };

    checkAuth();
  }, []);

  /**
   * Verifies a JWT token with the backend authentication API to ensure it's still valid.
   * Used during application startup and token refresh scenarios.
   *
   * @param {string} tokenToVerify - The JWT token string to validate with the backend
   * @returns {Promise<boolean>} Promise that resolves to true if token is valid, false otherwise
   *
   * Process:
   * 1. Sends POST request to /api/auth with verify action and token
   * 2. Parses response to check success status and user data
   * 3. Updates user state if token is valid and user data is present
   * 4. Returns boolean indicating token validity
   */
  const verifyToken = async (tokenToVerify: string): Promise<boolean> => {
    try {
      // Send POST request to authentication API with token verification request
      const response = await fetch("/api/auth", {
        method: "POST", // Use POST for security (tokens shouldn't be in URL)
        headers: {
          "Content-Type": "application/json", // Specify JSON content type
        },
        body: JSON.stringify({
          type: "verify", // Specify verification action for API endpoint
          token: tokenToVerify, // Include token to be verified
        } as AuthRequest), // Type assertion for TypeScript safety
      });

      // Parse JSON response from authentication API
      const data: AuthResponse = await response.json();

      // Check if verification was successful and user data is present
      if (data.success && data.user) {
        setUser(data.user); // Update user state with fresh data from backend
        return true; // Token is valid
      }

      // Token is invalid or user data is missing
      return false;
    } catch (err) {
      // Handle network errors, JSON parsing errors, or other exceptions
      console.error("Error verifying token:", err);
      return false; // Fail safely by treating as invalid token
    }
  };

  /**
   * Authenticates a user with username and password credentials.
   * Handles the complete login flow including API communication, state management,
   * and persistent storage of authentication data.
   *
   * @param {string} username - User's username for authentication
   * @param {string} password - User's password for authentication
   * @returns {Promise<boolean>} Promise that resolves to true if login successful, false otherwise
   *
   * Process:
   * 1. Sets loading state to show UI feedback
   * 2. Sends login request to authentication API
   * 3. On success: stores token and user data in state and localStorage
   * 4. On failure: sets specific error messages for user feedback
   * 5. Returns boolean indicating login success/failure
   */
  const login = async (username: string, password: string): Promise<boolean> => {
    // Set loading state to true to show loading spinner/disable form
    setIsLoading(true);
    // Note: Don't clear errors here - they should be cleared by the component before calling login

    try {
      // Send POST request to authentication API with login credentials
      const response = await fetch("/api/auth", {
        method: "POST", // Use POST for security (credentials shouldn't be in URL)
        headers: {
          "Content-Type": "application/json", // Specify JSON content type
        },
        body: JSON.stringify({
          type: "login", // Specify login action for API endpoint
          username, // User's username credential
          password, // User's password credential
        } as AuthRequest), // Type assertion for TypeScript safety
      });

      // Parse JSON response from authentication API
      const data: AuthResponse = await response.json();

      // Check if login was successful and required data is present
      if (data.success && data.token && data.user) {
        // Update authentication state with received token and user data
        setToken(data.token); // Store JWT token for future API requests
        setUser(data.user); // Store user object for UI display

        // Persist authentication data in browser localStorage for session persistence
        localStorage.setItem("auth_token", data.token); // Store token as string
        localStorage.setItem("auth_user", JSON.stringify(data.user)); // Store user as JSON

        // Clear loading state to re-enable UI
        setIsLoading(false);
        return true; // Login successful
      } else {
        // Handle login failure with specific error messaging
        const errorMsg = data.message || "Login failed"; // Use API message or fallback
        const errorType = data.errorType; // Get specific error type for targeted feedback

        // Update error state for UI display
        setError(errorMsg); // Set error message for user
        setErrorType(errorType); // Set error type for specific field highlighting

        // Add small delay to ensure React state updates are processed before returning
        await new Promise(resolve => setTimeout(resolve, 100));

        // Clear loading state to re-enable UI
        setIsLoading(false);
        return false; // Login failed
      }
    } catch (err) {
      // Handle network errors, JSON parsing errors, or other exceptions
      const errorMessage = err instanceof Error ? err.message : "Login failed";
      setError(errorMessage); // Set generic error message
      setErrorType('unknown'); // Set unknown error type

      // Add small delay to ensure React state updates are processed before returning
      await new Promise(resolve => setTimeout(resolve, 100));

      // Clear loading state to re-enable UI
      setIsLoading(false);
      return false; // Login failed due to error
    }
  };

  /**
   * Registers a new user account with username and password credentials.
   * Handles the complete registration flow including API communication and error handling.
   * Note: Registration does not automatically log the user in - they must login separately.
   *
   * @param {string} username - Desired username for the new account
   * @param {string} password - Password for the new account
   * @returns {Promise<boolean>} Promise that resolves to true if registration successful, false otherwise
   *
   * Process:
   * 1. Sets loading state to show UI feedback
   * 2. Sends registration request to authentication API
   * 3. On success: returns true (user must login separately)
   * 4. On failure: sets specific error messages for user feedback
   * 5. Returns boolean indicating registration success/failure
   */
  const register = async (username: string, password: string): Promise<boolean> => {
    // Set loading state to true to show loading spinner/disable form
    setIsLoading(true);
    // Note: Don't clear errors here - they should be cleared by the component before calling register

    try {
      // Send POST request to authentication API with registration credentials
      const response = await fetch("/api/auth", {
        method: "POST", // Use POST for security (credentials shouldn't be in URL)
        headers: {
          "Content-Type": "application/json", // Specify JSON content type
        },
        body: JSON.stringify({
          type: "register", // Specify registration action for API endpoint
          username, // Desired username for new account
          password, // Password for new account
        } as AuthRequest), // Type assertion for TypeScript safety
      });

      // Parse JSON response from authentication API
      const data: AuthResponse = await response.json();

      // Check if registration was successful
      if (data.success) {
        // Clear loading state to re-enable UI
        setIsLoading(false);
        return true; // Registration successful
      } else {
        // Handle registration failure with specific error messaging
        setError(data.message || "Registration failed"); // Use API message or fallback
        setErrorType(data.errorType); // Set specific error type for targeted feedback
        setIsLoading(false); // Clear loading state to re-enable UI
        return false; // Registration failed
      }
    } catch (err) {
      // Handle network errors, JSON parsing errors, or other exceptions
      const errorMessage = err instanceof Error ? err.message : "Registration failed";
      setError(errorMessage); // Set generic error message
      setErrorType('unknown'); // Set unknown error type
      setIsLoading(false); // Clear loading state to re-enable UI
      return false; // Registration failed due to error
    }
  };

  /**
   * Logs out the current user by clearing all authentication state and user data.
   * Performs comprehensive cleanup including localStorage, state, and backend notification.
   * Also dispatches a global event to notify other components of the logout.
   *
   * Process:
   * 1. Captures current token for backend notification
   * 2. Immediately clears all authentication state
   * 3. Removes all user data from localStorage
   * 4. Dispatches global logout event
   * 5. Notifies backend to invalidate token (if present)
   */
  const logout = async () => {
    // Capture the current token before clearing state (needed for backend notification)
    const currentToken = token;

    // Clear authentication state immediately to prevent UI issues and security concerns
    setUser(null); // Remove user object from state
    setToken(null); // Remove JWT token from state
    setErrorType(undefined); // Clear any error state

    // Remove authentication data from browser localStorage
    localStorage.removeItem("auth_token"); // Remove stored JWT token
    localStorage.removeItem("auth_user"); // Remove stored user object

    // Clear conversation data to prevent data leakage between users
    localStorage.removeItem("current-conversation-id"); // Remove current conversation ID

    // Clear any other user-specific data that might exist in localStorage
    const keys = Object.keys(localStorage); // Get all localStorage keys
    for (const key of keys) {
      // Remove any keys that start with "conversation-" prefix
      if (key.startsWith("conversation-")) {
        localStorage.removeItem(key);
      }
    }

    // Dispatch a global event to notify other components that the user has logged out
    // This allows other parts of the app to clean up their state accordingly
    window.dispatchEvent(new Event('user-logged-out'));

    // If we have a token, notify the backend about the logout to invalidate it
    if (currentToken) {
      try {
        // Call the backend authentication API to invalidate the token
        await fetch("/api/auth", {
          method: "POST", // Use POST for security
          headers: {
            "Content-Type": "application/json", // Specify JSON content type
          },
          body: JSON.stringify({
            type: "logout", // Specify logout action for API endpoint
            token: currentToken, // Send token to be invalidated
          }),
        });
      } catch (err) {
        // Silently handle logout notification errors - logout should succeed even if backend fails
        // This prevents network issues from blocking the logout process
      }
    }
  };

  /**
   * Clears the current error state to hide error messages from the UI.
   * Used when user starts a new authentication attempt or manually dismisses errors.
   */
  const clearError = () => {
    setError(null); // Clear error message
    setErrorType(undefined); // Clear specific error type
  };

  // Return the AuthContext.Provider with all authentication state and functions
  return (
    <AuthContext.Provider
      value={{
        user, // Current authenticated user object
        token, // Current JWT authentication token
        isAuthenticated: !!user && !!token, // Computed boolean: true if both user and token exist
        isLoading, // Loading state during authentication operations
        error, // Current error message for display
        errorType, // Specific error type for targeted feedback
        login, // Function to authenticate user
        register, // Function to create new user account
        logout, // Function to clear authentication state
        clearError, // Function to clear error state
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

/**
 * Custom hook to access authentication context from any component.
 * Must be used within an AuthProvider component tree.
 *
 * @returns {AuthContextType} Authentication context containing user state and auth functions
 * @throws {Error} Throws error if used outside of AuthProvider
 *
 * Usage:
 * const { user, login, logout, isAuthenticated } = useAuth();
 */
export const useAuth = () => {
  // Get the authentication context from React context
  const context = useContext(AuthContext);

  // Ensure hook is used within AuthProvider
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }

  // Return the authentication context
  return context;
};
