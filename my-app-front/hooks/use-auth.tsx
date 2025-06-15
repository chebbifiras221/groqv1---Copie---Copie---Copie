"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { AuthRequest, AuthResponse } from "@/app/api/auth/route";

type User = {
  id: string;
  username: string;
};

type AuthContextType = {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  errorType?: 'username' | 'password' | string;
  login: (username: string, password: string) => Promise<boolean>;
  register: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  clearError: () => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [errorType, setErrorType] = useState<'username' | 'password' | string | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Check for existing token on mount
  useEffect(() => {
    const checkAuth = async () => {
      setIsLoading(true);

      const storedToken = localStorage.getItem("auth_token");
      const storedUser = localStorage.getItem("auth_user");

      if (storedToken && storedUser) {
        try {
          // First set the stored values to prevent flicker
          setToken(storedToken);
          setUser(JSON.parse(storedUser));

          // Then verify the token with the backend
          const isValid = await verifyToken(storedToken);

          // If token is invalid, clear auth state
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

  // Verify token with the backend
  const verifyToken = async (tokenToVerify: string): Promise<boolean> => {
    try {
      const response = await fetch("/api/auth", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: "verify",
          token: tokenToVerify,
        } as AuthRequest),
      });

      const data: AuthResponse = await response.json();

      // Update user data if token is valid and user data is returned
      if (data.success && data.user) {
        setUser(data.user);
        return true;
      }

      return false;
    } catch (err) {
      console.error("Error verifying token:", err);
      return false;
    }
  };

  const login = async (username: string, password: string): Promise<boolean> => {
    console.log(`Login attempt with username: ${username}`);
    setIsLoading(true);
    // Don't clear errors here - they should be cleared by the component before calling login

    try {
      const response = await fetch("/api/auth", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: "login",
          username,
          password,
        } as AuthRequest),
      });

      const data: AuthResponse = await response.json();
      console.log('Auth API response:', data);
      console.log('Response status:', response.status);

      if (data.success && data.token && data.user) {
        setToken(data.token);
        setUser(data.user);

        // Store in localStorage
        localStorage.setItem("auth_token", data.token);
        localStorage.setItem("auth_user", JSON.stringify(data.user));

        setIsLoading(false);
        return true;
      } else {
        // Set specific error type if provided
        const errorMsg = data.message || "Login failed";
        const errorType = data.errorType;

        // Force state updates to be synchronous by using a callback
        setError(errorMsg);
        setErrorType(errorType);

        // Add a small delay to ensure state updates are processed
        await new Promise(resolve => setTimeout(resolve, 100));

        setIsLoading(false);
        return false;
      }
    } catch (err) {

      const errorMessage = err instanceof Error ? err.message : "Login failed";

      setError(errorMessage);
      setErrorType('unknown');

      // Add a small delay to ensure state updates are processed
      await new Promise(resolve => setTimeout(resolve, 100));

      setIsLoading(false);
      return false;
    }
  };

  const register = async (username: string, password: string): Promise<boolean> => {

    setIsLoading(true);
    // Don't clear errors here - they should be cleared by the component before calling register

    try {
      const response = await fetch("/api/auth", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: "register",
          username,
          password,
        } as AuthRequest),
      });

      const data: AuthResponse = await response.json();

      if (data.success) {
        setIsLoading(false);
        return true;
      } else {
        setError(data.message || "Registration failed");
        setErrorType(data.errorType);
        setIsLoading(false);
        return false;
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Registration failed";
      setError(errorMessage);
      setErrorType('unknown');
      setIsLoading(false);
      return false;
    }
  };

  const logout = async () => {
    // Get the current token
    const currentToken = token;

    // Clear auth state immediately to prevent UI issues
    setUser(null);
    setToken(null);
    setErrorType(undefined);

    // Clear localStorage auth data
    localStorage.removeItem("auth_token");
    localStorage.removeItem("auth_user");

    // Clear conversation data to prevent data leakage
    localStorage.removeItem("current-conversation-id");

    // Clear any other user-specific data
    const keys = Object.keys(localStorage);
    for (const key of keys) {
      if (key.startsWith("conversation-")) {
        localStorage.removeItem(key);
      }
    }

    // Dispatch an event to notify other components that the user has logged out
    window.dispatchEvent(new Event('user-logged-out'));

    // If we have a token, notify the backend about the logout
    if (currentToken) {
      try {
        // Call the backend to invalidate the token
        await fetch("/api/auth", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            type: "logout",
            token: currentToken,
          }),
        });

      } catch (err) {
        // Silently handle logout notification errors
      }
    }


  };

  const clearError = () => {
    setError(null);
    setErrorType(undefined);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user && !!token,
        isLoading,
        error,
        errorType,
        login,
        register,
        logout,
        clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
