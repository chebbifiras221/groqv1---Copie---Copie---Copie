"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Button, LoadingSVG } from "@/components/ui/button";
import { useConnection } from "@/hooks/use-connection";

export function ConnectionPage() {
  const { connect } = useConnection();
  const [isLoading, setIsLoading] = useState(false);

  const handleConnect = async () => {
    setIsLoading(true);
    try {
      await connect();
    } catch (error) {
      console.error('Connection error:', error);
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-full w-full">
      <motion.div
        className="flex flex-col items-center gap-8 max-w-md text-center"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <h1 className="text-3xl font-bold">Live Transcription</h1>
        <p className="text-white/70">
          Connect to start a conversation with the AI assistant. Your voice will be transcribed in real-time.
        </p>
        <div className="w-full">
          <Button
            state="primary"
            size="large"
            className={`relative w-full text-base text-black ${isLoading ? "pointer-events-none" : ""}`}
            onClick={handleConnect}
          >
            <div className={`w-full ${isLoading ? "opacity-0" : "opacity-100"}`}>
              Connect to LiveKit
            </div>
            <div
              className={`absolute left-1/2 top-1/2 -translate-y-1/2 -translate-x-1/2 ${isLoading ? "opacity-100" : "opacity-0"}`}
            >
              <LoadingSVG diameter={16} strokeWidth={3} />
            </div>
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
