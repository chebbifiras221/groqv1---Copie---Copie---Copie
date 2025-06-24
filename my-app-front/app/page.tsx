"use client";                                                    // Run this component on the client side

import { useEffect } from "react";                                   // React hook for side effects
import { RoomComponent } from "@/components/room";                   // Main chat room interface
import { ConnectionProvider } from "@/hooks/use-connection";         // WebRTC connection state provider
import { ConnectionPage } from "@/components/connection-page";       // Landing page before connecting
import { useConnection } from "@/hooks/use-connection";              // Hook to access connection state
import { ThemeProvider } from "@/hooks/use-theme";                   // Theme (light/dark) state provider
import { SettingsProvider } from "@/hooks/use-settings";             // User settings state provider
import { AuthProvider } from "@/hooks/use-auth";                     // Authentication state provider
import { useAuth } from "@/hooks/use-auth";                          // Hook to access auth state
import { AuthPage } from "@/components/auth/auth-page";              // Login/register page

export default function Home() {                                     // Main homepage component
  return (
    <ThemeProvider>
      <SettingsProvider>
        <AuthProvider>
          <ConnectionProvider>
            <AppContent />
          </ConnectionProvider>
        </AuthProvider>
      </SettingsProvider>
    </ThemeProvider>
  );
}

function AppContent() {                                              // Inner component that uses the provider contexts
  const { shouldConnect, disconnect } = useConnection();            // Get connection state and disconnect function
  const { isAuthenticated, isLoading } = useAuth();                 // Get authentication status and loading state

  // Listen for user logout events from other parts of the app
  useEffect(() => {
    const handleUserLogout = () => {
      // Disconnect from any active connections when the user logs out
      try {
        disconnect();
      } catch (error) {
        // Silently handle disconnect errors during logout
      }
    };

    window.addEventListener('user-logged-out', handleUserLogout);

    return () => {
      window.removeEventListener('user-logged-out', handleUserLogout);
    };
  }, [disconnect]);

  // Show loading state while checking authentication
  if (isLoading) {                                                   // If still checking authentication status
    return (
      <div className="h-screen w-full bg-bg-primary flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-DEFAULT"></div>
      </div>
    );
  }

  // If not authenticated, show the auth page
  if (!isAuthenticated) {                                            // If user is not logged in
    return <AuthPage />;                                             // Show login/register page
  }

  // If authenticated, show the connection page or room component
  return (
    <div className="h-screen w-full bg-bg-primary overflow-hidden">
      {shouldConnect ? <RoomComponent /> : <ConnectionPage />}
    </div>
  );
}
