"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { AuthRequest, AuthResponse } from "@/app/api/auth/route";

type User = {
  id: string;
  username: string;
  email?: string;
};

type AuthContextType = {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (username: string, password: string) => Promise<boolean>;
  register: (username: string, password: string, email?: string) => Promise<boolean>;
  logout: () => void;
  clearError: () => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
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
    setIsLoading(true);
    setError(null);

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

      if (data.success && data.token && data.user) {
        setToken(data.token);
        setUser(data.user);

        // Store in localStorage
        localStorage.setItem("auth_token", data.token);
        localStorage.setItem("auth_user", JSON.stringify(data.user));

        setIsLoading(false);
        return true;
      } else {
        setError(data.message || "Login failed");
        setIsLoading(false);
        return false;
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Login failed";
      setError(errorMessage);
      setIsLoading(false);
      return false;
    }
  };

  const register = async (username: string, password: string, email?: string): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

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
          email,
        } as AuthRequest),
      });

      const data: AuthResponse = await response.json();

      if (data.success) {
        setIsLoading(false);
        return true;
      } else {
        setError(data.message || "Registration failed");
        setIsLoading(false);
        return false;
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Registration failed";
      setError(errorMessage);
      setIsLoading(false);
      return false;
    }
  };

  const logout = () => {
    // Clear auth state
    setUser(null);
    setToken(null);

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

    console.log("User logged out successfully");
  };

  const clearError = () => {
    setError(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user && !!token,
        isLoading,
        error,
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
