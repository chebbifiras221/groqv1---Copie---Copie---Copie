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
    <ThemeProvider>                                                  {/* Provides theme state to all children */}
      <SettingsProvider>                                             {/* Provides settings state to all children */}
        <AuthProvider>                                               {/* Provides authentication state to all children */}
          <ConnectionProvider>                                       {/* Provides WebRTC connection state to all children */}
            <AppContent />                                           {/* Main app content with access to all providers */}
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
  useEffect(() => {                                                  // Run effect when component mounts
    const handleUserLogout = () => {                                // Function to handle logout events
      // Disconnect from any active connections when the user logs out
      try {
        disconnect();                                                // Safely disconnect from WebRTC
      } catch (error) {
        // Silently handle disconnect errors                        // Don't show errors during logout
      }
    };

    window.addEventListener('user-logged-out', handleUserLogout);   // Listen for global logout events

    return () => {                                                   // Cleanup function when component unmounts
      window.removeEventListener('user-logged-out', handleUserLogout); // Remove event listener
    };
  }, [disconnect]);                                                  // Re-run if disconnect function changes

  // Show loading state while checking authentication
  if (isLoading) {                                                   // If still checking authentication status
    return (
      <div className="h-screen w-full bg-bg-primary flex items-center justify-center"> {/* Full screen centered container */}
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-DEFAULT"></div> {/* Spinning loading indicator */}
      </div>
    );
  }

  // If not authenticated, show the auth page
  if (!isAuthenticated) {                                            // If user is not logged in
    return <AuthPage />;                                             // Show login/register page
  }

  // If authenticated, show the connection page or room component
  return (
    <div className="h-screen w-full bg-bg-primary overflow-hidden">  {/* Full screen container with hidden overflow */}
      {shouldConnect ? <RoomComponent /> : <ConnectionPage />}       {/* Show room if connected, otherwise show connection page */}
    </div>
  );
}
