"use client";

import { useEffect, useState } from "react";

import { RoomComponent } from "@/components/room";
import { ConnectionProvider } from "@/hooks/use-connection";
import { ConnectionPage } from "@/components/connection-page";
import { useConnection } from "@/hooks/use-connection";

export default function Home() {
  return (
    <ConnectionProvider>
      <AppContent />
    </ConnectionProvider>
  );
}

function AppContent() {
  const { shouldConnect } = useConnection();

  return (
    <div className="h-dvh w-full bg-bg-primary">
      {shouldConnect ? <RoomComponent /> : <ConnectionPage />}
      <div className="fixed bottom-2 right-2 text-xs text-text-tertiary">
        <span>Powered by </span>
        <a
          href="https://docs.livekit.io/agents"
          className="text-primary-DEFAULT hover:underline"
          target="_blank"
        >
          LiveKit
        </a>
      </div>
    </div>
  );
}
