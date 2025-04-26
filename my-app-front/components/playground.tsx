"use client";

import { useEffect, useState } from "react";
import {
  useConnectionState,
  useLocalParticipant,
} from "@livekit/components-react";
import { AnimatePresence } from "framer-motion";
import { ConnectionState } from "livekit-client";
import { MessageSquare } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Header } from "@/components/ui/header";
import { Typewriter } from "./typewriter";
import { TextInput } from "./text-input";
import { ConversationManager } from "./conversation-manager";
import { ConnectionToast } from "./ui/status-indicator";
import { MobileConversationDrawer } from "./ui/mobile-conversation-drawer";

export interface PlaygroundProps {
  onConnect?: (connect: boolean) => void;
}

export function Playground({ onConnect: _ }: PlaygroundProps) {
  const { localParticipant } = useLocalParticipant();
  const roomState = useConnectionState();
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
            {/* Removed the audio tile content with the microphone button */}
            <div className="bg-bg-secondary">
              <TextInput isConnected={isConnected} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
