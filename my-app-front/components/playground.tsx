"use client";

import { useEffect, useMemo, useState } from "react";
import {
  useConnectionState,
  useLocalParticipant,
  useTracks,
} from "@livekit/components-react";
import { AnimatePresence, motion } from "framer-motion";
import { ConnectionState, LocalParticipant, Track } from "livekit-client";
import { MessageSquare } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Header } from "@/components/ui/header";
import { MicrophoneButton } from "@/components/microphone-button";
import { useMultibandTrackVolume } from "@/hooks/use-track-volume";
import { Typewriter } from "./typewriter";
import { TextInput } from "./text-input";
import { ConversationManager } from "./conversation-manager";
import { StatusIndicator, ConnectionToast } from "./ui/status-indicator";
import { MobileConversationDrawer } from "./ui/mobile-conversation-drawer";
import { useErrorHandler } from "@/hooks/use-error-handler";

export interface PlaygroundProps {
  onConnect?: (connect: boolean) => void;
}

export function Playground({ onConnect }: PlaygroundProps) {
  const { localParticipant } = useLocalParticipant();
  const roomState = useConnectionState();
  const tracks = useTracks();
  const [showConnectionToast, setShowConnectionToast] = useState(false);
  const [lastConnectionState, setLastConnectionState] = useState<ConnectionState | null>(null);
  const [showMobileConversations, setShowMobileConversations] = useState(false);
  const { handleError } = useErrorHandler();

  /**
   * Show connection toast when connection state changes
   * Also trigger conversation loading when connected
   */
  useEffect(() => {
    if (lastConnectionState !== roomState &&
        (roomState === ConnectionState.Connected ||
         roomState === ConnectionState.Disconnected ||
         roomState === ConnectionState.Reconnecting)) {
      setShowConnectionToast(true);
      const timer = setTimeout(() => setShowConnectionToast(false), 3000);

      // If we just connected, trigger conversation loading
      if (roomState === ConnectionState.Connected) {
        // Use a short delay to ensure everything is initialized
        setTimeout(() => {
          // Trigger the conversation manager to load conversations
          // This will create a new conversation if none exist
          const event = new Event('storage');
          window.dispatchEvent(event);
        }, 500);
      }

      return () => clearTimeout(timer);
    }
    setLastConnectionState(roomState);
  }, [roomState, lastConnectionState]);

  /**
   * Ensure microphone is muted whenever connection state changes
   * This prevents the microphone from being automatically enabled
   */
  useEffect(() => {
    // Only proceed if we have a valid connection and participant
    if (roomState !== ConnectionState.Connected || !localParticipant) {
      return;
    }

    // Safety check to ensure localParticipant is fully initialized
    if (!localParticipant.setMicrophoneEnabled || typeof localParticipant.setMicrophoneEnabled !== 'function') {
      return;
    }

    // Mute microphone when connection is established
    const muteOnConnection = () => {
      try {
        if (localParticipant.isMicrophoneEnabled) {
          localParticipant.setMicrophoneEnabled(false);
        }
      } catch (error) {
        console.error('Error muting microphone:', error);
      }
    };

    try {
      // Check if tracks property exists and is initialized
      if (localParticipant.tracks && typeof localParticipant.tracks.size === 'number' && localParticipant.tracks.size > 0) {
        // Execute immediately if tracks are already published
        muteOnConnection();
      } else {
        // Otherwise listen for the trackPublished event
        const handleTrackPublished = () => {
          muteOnConnection();
          // Remove listener after execution to prevent multiple mutes
          if (localParticipant && localParticipant.off) {
            localParticipant.off('trackPublished', handleTrackPublished);
          }
        };

        // Add event listener safely
        if (localParticipant && localParticipant.on) {
          localParticipant.on('trackPublished', handleTrackPublished);

          // Cleanup listener if component unmounts before track is published
          return () => {
            if (localParticipant && localParticipant.off) {
              localParticipant.off('trackPublished', handleTrackPublished);
            }
          };
        }
      }
    } catch (error) {
      console.error('Error in microphone muting effect:', error);
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
            stiffness: 300,
            damping: 25,
            mass: 0.5
          }}
          style={{ willChange: 'opacity, transform' }}
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
      <Header title="Programming Teacher" />

      <AnimatePresence>
        {showConnectionToast && (
          <ConnectionToast
            state={roomState}
            onClose={() => setShowConnectionToast(false)}
          />
        )}
      </AnimatePresence>

      <div className="flex flex-1 overflow-hidden">
        {/* Mobile conversation drawer */}
        <MobileConversationDrawer
          isOpen={showMobileConversations}
          onClose={() => setShowMobileConversations(false)}
        />

        {/* Desktop sidebar */}
        {isConnected && (
          <div className="hidden md:block w-64 lg:w-72 bg-bg-secondary relative overflow-hidden">
            <ConversationManager />
          </div>
        )}

        <div className="relative flex-col grow h-full bg-bg-primary">
          {/* Mobile conversation button */}
          {isConnected && (
            <div className="md:hidden absolute top-16 left-4 z-10">
              <Button
                variant="ghost"
                size="icon"
                className="bg-bg-secondary/80 backdrop-blur-sm rounded-full p-2 shadow-md"
                onClick={() => setShowMobileConversations(true)}
              >
                <MessageSquare className="w-5 h-5 text-primary-DEFAULT" />
              </Button>
            </div>
          )}

          <div className="h-full pb-48 overflow-hidden">
            <Typewriter typingSpeed={25} />
          </div>
          <div className="absolute left-0 bottom-0 w-full bg-bg-secondary border-t border-bg-tertiary/30">
            <div className="pt-4 pb-2 px-4">
              {audioTileContent}
            </div>
            <div className="bg-bg-secondary">
              <TextInput isConnected={isConnected} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
