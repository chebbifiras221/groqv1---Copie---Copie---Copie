"use client";

import { useEffect, useMemo } from "react";
import {
  useConnectionState,
  useLocalParticipant,
  useTracks,
} from "@livekit/components-react";
import { AnimatePresence, motion } from "framer-motion";
import { ConnectionState, LocalParticipant, Track } from "livekit-client";

import { Button, LoadingSVG } from "@/components/ui/button";
import { MicrophoneButton } from "@/components/microphone-button";
import { useMultibandTrackVolume } from "@/hooks/use-track-volume";
import { Typewriter } from "./typewriter";
import { TextInput } from "./text-input";
import { ConversationManager } from "./conversation-manager";

export interface PlaygroundProps {
  onConnect?: (connect: boolean) => void;
}

export function Playground({ onConnect }: PlaygroundProps) {
  const { localParticipant } = useLocalParticipant();

  const roomState = useConnectionState();
  const tracks = useTracks();

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
    <div className="flex h-full w-full">
      {isConnected && <ConversationManager />}
      <div className="relative flex-col grow gap-4 h-full">
        <Typewriter typingSpeed={25} />
        <div className="absolute left-0 bottom-0 w-full bg-accent-bg border-t border-white/20">
          <div className="pt-2">
            {audioTileContent}
          </div>
          <div className="mt-2 border-t border-white/20">
            <TextInput isConnected={isConnected} />
          </div>
        </div>
      </div>
    </div>
  );
}
