"use client";

import { useEffect, useState } from "react";

import { RoomComponent } from "@/components/room";
import { ConnectionProvider } from "@/hooks/use-connection";
import { ConnectionPage } from "@/components/connection-page";
import { useConnection } from "@/hooks/use-connection";
import { ThemeProvider } from "@/hooks/use-theme";
import { SettingsProvider } from "@/hooks/use-settings";
import { AuthProvider } from "@/hooks/use-auth";
import { useAuth } from "@/hooks/use-auth";
import { AuthPage } from "@/components/auth/auth-page";

export default function Home() {
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

function AppContent() {
  const { shouldConnect, disconnect } = useConnection();
  const { isAuthenticated, isLoading, user } = useAuth();

  // Listen for user logout events
  useEffect(() => {
    const handleUserLogout = () => {
      // Disconnect from any active connections when the user logs out
      try {
        disconnect();
      } catch (error) {
        console.error("Error disconnecting on logout:", error);
      }
    };

    window.addEventListener('user-logged-out', handleUserLogout);

    return () => {
      window.removeEventListener('user-logged-out', handleUserLogout);
    };
  }, [disconnect]);

  // Show loading state while checking authentication
  if (isLoading) {
    return (
      <div className="h-screen w-full bg-bg-primary flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-DEFAULT"></div>
      </div>
    );
  }

  // If not authenticated, show the auth page
  if (!isAuthenticated) {
    return <AuthPage />;
  }

  // If authenticated, show the connection page or room component
  return (
    <div className="h-screen w-full bg-bg-primary overflow-hidden">
      {shouldConnect ? <RoomComponent /> : <ConnectionPage />}
    </div>
  );
}
