"use client";

import { useEffect, useState } from "react";
import {
  useConnectionState,
  useLocalParticipant,
} from "@livekit/components-react";
import { AnimatePresence, motion } from "framer-motion";
import { ConnectionState } from "livekit-client";
import { MessageSquare } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Header } from "@/components/ui/header";
import { Typewriter } from "./typewriter";
import { TextInput } from "./text-input";
import { ConversationManager } from "./conversation-manager";
import { ConnectionToast } from "./ui/status-indicator";
import { MobileConversationDrawer } from "./ui/mobile-conversation-drawer";
import { useSettings } from "@/hooks/use-settings";

export interface PlaygroundProps {
  onConnect?: (connect: boolean) => void;
}

export function Playground({ onConnect: _ }: PlaygroundProps) {
  const { localParticipant } = useLocalParticipant();
  const roomState = useConnectionState();
  const { settings } = useSettings();
  const [showConnectionToast, setShowConnectionToast] = useState(false);
  const [lastConnectionState, setLastConnectionState] = useState<ConnectionState | null>(null);
  const [showMobileConversations, setShowMobileConversations] = useState(false);

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

      // If we just connected, trigger the conversation manager
      if (roomState === ConnectionState.Connected) {
        console.log("Connection established, conversation manager should initialize automatically");

        // The conversation manager will now handle loading on its own
        // We'll just dispatch a storage event as a backup trigger
        setTimeout(() => {
          if (typeof window !== 'undefined') {
            console.log("Dispatching backup storage event to trigger conversation manager");
            const event = new Event('storage');
            window.dispatchEvent(event);
          }
        }, 1500); // Longer delay as a backup mechanism
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
      // Simply mute the microphone
      muteOnConnection();

      // Listen for track published events to ensure mic stays muted
      const handleTrackPublished = () => {
        muteOnConnection();
      };

      // Add event listener safely
      if (localParticipant && localParticipant.on) {
        localParticipant.on('trackPublished', handleTrackPublished);

        // Cleanup listener if component unmounts
        return () => {
          if (localParticipant && localParticipant.off) {
            localParticipant.off('trackPublished', handleTrackPublished);
          }
        };
      }
    } catch (error) {
      console.error('Error in microphone muting effect:', error);
    }
  }, [localParticipant, roomState]);
  // to the text input component

  const isConnected = roomState === ConnectionState.Connected;

  return (
    <div className="flex flex-col h-screen w-full">
      <Header title="Teacher Assistant" />

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

        {/* Desktop sidebar with smooth animation */}
        <AnimatePresence mode="wait">
          {isConnected && settings.sidebarVisible && (
            <motion.div
              className="hidden md:flex bg-bg-secondary border-r border-bg-tertiary/30 flex-shrink-0"
              initial={{ width: 0, opacity: 0 }}
              animate={{
                width: 256, // Fixed width for smoother animation (16rem = 256px)
                opacity: 1
              }}
              exit={{ width: 0, opacity: 0 }}
              transition={{
                duration: 0.35,
                ease: [0.25, 0.1, 0.25, 1], // Optimized cubic-bezier for smoothest animation
                width: { duration: 0.35, ease: [0.25, 0.1, 0.25, 1] },
                opacity: { duration: 0.25, ease: "easeOut" }
              }}
              style={{
                willChange: 'width, opacity',
                backfaceVisibility: 'hidden',
                transform: 'translateZ(0)' // Force hardware acceleration
              }}
            >
              <div className="h-full overflow-y-auto w-64">
                <ConversationManager />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex flex-col flex-1 bg-bg-primary relative">
          {/* Mobile conversation button */}
          {isConnected && (
            <div className="md:hidden absolute top-4 left-4 z-10">
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

          <div className="flex-1 overflow-y-auto">
            <div className="h-full">
              <Typewriter typingSpeed={25} />
            </div>
          </div>
          <div className="flex-shrink-0 bg-bg-secondary border-t border-bg-tertiary/30">
            <TextInput isConnected={isConnected} />
          </div>
        </div>
      </div>
    </div>
  );
}
