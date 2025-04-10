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
    <div className="grid place-items-center h-dvh w-full">
      <div className="w-full grid grid-rows-[64px_1fr_8px] lg:border border-white/20 h-full min-h-dvh lg:max-w-5xl mx-auto lg:min-h-[640px] lg:max-h-[640px] rounded-2xl px-4">
        <header className="border-b border-white/20">
          <div className="py-4 px-2 flex items-center justify-between">
            <h1 className="text-xl font-semibold">Live Transcription</h1>
            <div>
              Built with{" "}
              <a
                href="https://docs.livekit.io/agents"
                className="pb-[1px] border-b border-white/40 hover:border-white/80 transition-all duration-75 ease-out"
                target="_blank"
              >
                LiveKit
              </a>
            </div>
          </div>
        </header>
        {shouldConnect ? <RoomComponent /> : <ConnectionPage />}
      </div>
    </div>
  );
}
