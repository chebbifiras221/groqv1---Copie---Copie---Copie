"use client";

import { useEffect, useState } from "react";

import { RoomComponent } from "@/components/room";
import { ConnectionProvider } from "@/hooks/use-connection";
import { ConnectionPage } from "@/components/connection-page";
import { useConnection } from "@/hooks/use-connection";
import { ThemeProvider } from "@/hooks/use-theme";
import { SettingsProvider } from "@/hooks/use-settings";

export default function Home() {
  return (
    <ThemeProvider>
      <SettingsProvider>
        <ConnectionProvider>
          <AppContent />
        </ConnectionProvider>
      </SettingsProvider>
    </ThemeProvider>
  );
}

function AppContent() {
  const { shouldConnect } = useConnection();

  return (
    <div className="h-dvh w-full bg-bg-primary">
      {shouldConnect ? <RoomComponent /> : <ConnectionPage />}
      {/* Powered by LiveKit text removed */}
    </div>
  );
}
