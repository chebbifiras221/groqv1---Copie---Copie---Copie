"use client";

import { useEffect, useMemo, useState } from "react";
import {
  useConnectionState,
  useLocalParticipant,
  useTracks,
} from "@livekit/components-react";
import { AnimatePresence, motion } from "framer-motion";
import { ConnectionState, LocalParticipant, Track } from "livekit-client";

import { Button } from "@/components/ui/button";
import { Header } from "@/components/ui/header";
import { MicrophoneButton } from "@/components/microphone-button";
import { useMultibandTrackVolume } from "@/hooks/use-track-volume";
import { Typewriter } from "./typewriter";
import { TextInput } from "./text-input";
import { ConversationManager } from "./conversation-manager";
import { StatusIndicator, ConnectionToast } from "./ui/status-indicator";

export interface PlaygroundProps {
  onConnect?: (connect: boolean) => void;
}

export function Playground({ onConnect }: PlaygroundProps) {
  const { localParticipant } = useLocalParticipant();
  const roomState = useConnectionState();
  const tracks = useTracks();
  const [showConnectionToast, setShowConnectionToast] = useState(false);
  const [lastConnectionState, setLastConnectionState] = useState<ConnectionState | null>(null);

  // Show connection toast when connection state changes
  useEffect(() => {
    if (lastConnectionState !== roomState &&
        (roomState === ConnectionState.Connected ||
         roomState === ConnectionState.Disconnected ||
         roomState === ConnectionState.Reconnecting)) {
      setShowConnectionToast(true);
      const timer = setTimeout(() => setShowConnectionToast(false), 3000);
      return () => clearTimeout(timer);
    }
    setLastConnectionState(roomState);
  }, [roomState, lastConnectionState]);

  useEffect(() => {
    if (roomState === ConnectionState.Connected) {
      localParticipant.setMicrophoneEnabled(true);
    }
  }, [localParticipant, roomState]);

  const localTracks = tracks.filter(
    ({ participant }) => participant instanceof LocalParticipant
  );

  const localMicTrack = localTracks.find(
    ({ source }) => source === Track.Source.Microphone
  );

  const localMultibandVolume = useMultibandTrackVolume(
    localMicTrack?.publication.track,
    9
  );

  const audioTileContent = useMemo(() => {
    const isLoading = roomState === ConnectionState.Connecting;
    const isActive = !isLoading && roomState !== ConnectionState.Disconnected;

    const conversationToolbar = (
      <div className="w-full absolute left-1/2 top-1/2 -translate-y-1/2 -translate-x-1/2">
        <motion.div
          className="flex justify-center gap-3 px-2"
          initial={{ opacity: 0, y: 25 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 25 }}
          transition={{
            type: "spring",
            stiffness: 260,
            damping: 20,
          }}
        >
          <MicrophoneButton
            localMultibandVolume={localMultibandVolume}
            isSpaceBarEnabled={true}
          />
        </motion.div>
      </div>
    );



    const visualizerContent = (
      <div className="flex flex-col justify-space-between h-full w-full">
        <div className="min-h-12 h-12 w-full relative">
          <AnimatePresence>
            {isActive ? conversationToolbar : null}
          </AnimatePresence>
        </div>
      </div>
    );

    return visualizerContent;
  }, [localMultibandVolume, roomState]);

  const isConnected = roomState === ConnectionState.Connected;

  return (
    <div className="flex flex-col h-full w-full">
      <Header title="AI Teacher Assistant" />

      <AnimatePresence>
        {showConnectionToast && (
          <ConnectionToast
            state={roomState}
            onClose={() => setShowConnectionToast(false)}
          />
        )}
      </AnimatePresence>

      <div className="flex flex-1 overflow-hidden">
        {isConnected && (
          <div className="hidden md:block w-80 lg:w-96 border-r border-border-DEFAULT">
            <ConversationManager />
          </div>
        )}
        <div className="relative flex-col grow h-full bg-bg-primary">
          <div className="h-full pb-48 overflow-hidden">
            <Typewriter typingSpeed={25} />
          </div>
          <div className="absolute left-0 bottom-0 w-full bg-bg-secondary border-t border-border-DEFAULT shadow-lg">
            <div className="pt-4 pb-2 px-4">
              {audioTileContent}
            </div>
            <div className="border-t border-border-DEFAULT">
              <TextInput isConnected={isConnected} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
