"use client";

import React, { createContext, useCallback, useState } from "react";

// API endpoint for generating LiveKit access tokens
const TOKEN_ENDPOINT = "/api/token";

/**
 * Connection context interface for WebRTC state management
 */
type TokenGeneratorData = {
  shouldConnect: boolean;           // Whether to connect to LiveKit
  wsUrl: string;                   // WebSocket URL for LiveKit
  token: string;                   // JWT access token
  disconnect: () => Promise<void>; // Disconnect function
  connect: () => Promise<void>;    // Connect function
};

// React context for connection state
const ConnectionContext = createContext<TokenGeneratorData | undefined>(
  undefined,
);

/**
 * Connection Provider - manages WebRTC connection state for LiveKit
 */
export const ConnectionProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  // Connection state: URL, token, and connection flag
  const [connectionDetails, setConnectionDetails] = useState<{
    wsUrl: string;        // LiveKit server URL
    token: string;        // Access token
    shouldConnect: boolean; // Connection flag
  }>({ wsUrl: "", token: "", shouldConnect: false });

  /**
   * Initiates connection to LiveKit by generating access token and setting connection details.
   * Validates environment configuration and fetches fresh token from backend.
   *
   * @throws {Error} Throws error if NEXT_PUBLIC_LIVEKIT_URL environment variable is not set
   *
   * Process:
   * 1. Validates LiveKit URL environment variable
   * 2. Fetches access token from backend API
   * 3. Updates connection state with URL, token, and shouldConnect flag
   */
  const connect = async () => {
    // Validate that LiveKit URL is configured in environment variables
    if (!process.env.NEXT_PUBLIC_LIVEKIT_URL) {
      throw new Error("NEXT_PUBLIC_LIVEKIT_URL is not set");
    }

    // Fetch access token from backend token generation API
    const { accessToken } = await fetch(TOKEN_ENDPOINT).then((res) =>
      res.json(), // Parse JSON response containing accessToken
    );

    // Update connection state with all required details for LiveKit connection
    setConnectionDetails({
      wsUrl: process.env.NEXT_PUBLIC_LIVEKIT_URL, // WebSocket URL from environment
      token: accessToken, // Fresh JWT token from backend
      shouldConnect: true, // Set flag to trigger connection attempt
    });
  };

  /**
   * Disconnects from LiveKit by setting shouldConnect flag to false.
   * Uses useCallback to prevent unnecessary re-renders when passed as prop.
   *
   * Process:
   * 1. Updates connection state to set shouldConnect to false
   * 2. Preserves existing wsUrl and token for potential reconnection
   */
  const disconnect = useCallback(async () => {
    // Update connection state to disable connection while preserving other details
    setConnectionDetails((prev) => ({ ...prev, shouldConnect: false }));
  }, []); // Empty dependency array since function doesn't depend on any values

  // Return the ConnectionContext.Provider with all connection state and functions
  return (
    <ConnectionContext.Provider
      value={{
        wsUrl: connectionDetails.wsUrl, // WebSocket URL for LiveKit connection
        token: connectionDetails.token, // JWT access token for authentication
        shouldConnect: connectionDetails.shouldConnect, // Flag to control connection attempts
        connect, // Function to initiate LiveKit connection
        disconnect, // Function to disconnect from LiveKit
      }}
    >
      {children}
    </ConnectionContext.Provider>
  );
};

/**
 * Custom hook to access connection context from any component.
 * Must be used within a ConnectionProvider component tree.
 *
 * @returns {TokenGeneratorData} Connection context containing connection state and functions
 * @throws {Error} Throws error if used outside of ConnectionProvider
 *
 * Usage:
 * const { shouldConnect, wsUrl, token, connect, disconnect } = useConnection();
 */
export const useConnection = () => {
  // Get the connection context from React context
  const context = React.useContext(ConnectionContext);

  // Ensure hook is used within ConnectionProvider
  if (context === undefined) {
    throw new Error("useConnection must be used within a ConnectionProvider");
  }

  // Return the connection context
  return context;
};
