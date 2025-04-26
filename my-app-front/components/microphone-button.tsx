import { TrackToggle, useLocalParticipant } from "@livekit/components-react";
import { Track } from "livekit-client";
import { MultibandAudioVisualizer } from "@/components/visualization/multiband";
import { useEffect, useState } from "react";
import { Mic, MicOff } from "lucide-react";

type MicrophoneButtonProps = {
  localMultibandVolume: Float32Array[];
  isSpaceBarEnabled?: boolean;
};

export const MicrophoneButton = ({
  localMultibandVolume,
  isSpaceBarEnabled = false,
}: MicrophoneButtonProps) => {
  const { localParticipant } = useLocalParticipant();
  const [isMuted, setIsMuted] = useState(true); // Start muted by default
  const [isSpaceBarPressed, setIsSpaceBarPressed] = useState(false);

  // Ensure microphone is muted on component mount
  useEffect(() => {
    // Set microphone to muted on initial load
    if (localParticipant) {
      // Force mute the microphone
      localParticipant.setMicrophoneEnabled(false);
    }
  }, [localParticipant]); // Only run once when component mounts with localParticipant

  // Keep isMuted state in sync with actual microphone state
  useEffect(() => {
    // Safety check to ensure localParticipant is fully initialized
    if (localParticipant && typeof localParticipant.isMicrophoneEnabled !== 'undefined') {
      setIsMuted(localParticipant.isMicrophoneEnabled === false);

      // Add event listener for microphone state changes
      const handleMicrophoneUpdate = () => {
        setIsMuted(localParticipant.isMicrophoneEnabled === false);
        console.log('Microphone state updated:', localParticipant.isMicrophoneEnabled ? 'enabled' : 'disabled');
      };

      // Listen for track mute/unmute events
      localParticipant.on('trackMuted', handleMicrophoneUpdate);
      localParticipant.on('trackUnmuted', handleMicrophoneUpdate);

      // Check state immediately
      handleMicrophoneUpdate();

      return () => {
        // Clean up event listeners
        localParticipant.off('trackMuted', handleMicrophoneUpdate);
        localParticipant.off('trackUnmuted', handleMicrophoneUpdate);
      };
    }
  }, [localParticipant]);

  useEffect(() => {
    // Don't add event listeners if spacebar control is disabled or localParticipant is not available
    if (!isSpaceBarEnabled || !localParticipant) return;

    // Safety check to ensure localParticipant is fully initialized
    if (!localParticipant.setMicrophoneEnabled || typeof localParticipant.setMicrophoneEnabled !== 'function') {
      console.warn('LocalParticipant not fully initialized yet for spacebar control');
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      try {
        // Only activate spacebar if not in an input, textarea, or contentEditable element
        const target = event.target as HTMLElement;
        const isInputElement =
          target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable;

        if (event.code === "Space" && !isInputElement) {
          // Prevent page scrolling when using spacebar for mic
          event.preventDefault();

          // Check if localParticipant is still valid
          if (localParticipant && localParticipant.setMicrophoneEnabled) {
            localParticipant.setMicrophoneEnabled(true);
            setIsSpaceBarPressed(true);
          }
        }
      } catch (error) {
        console.error('Error in spacebar keydown handler:', error);
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      try {
        // Only handle spacebar if not in an input element
        const target = event.target as HTMLElement;
        const isInputElement =
          target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable;

        if (event.code === "Space" && !isInputElement) {
          event.preventDefault();

          // Check if localParticipant is still valid
          if (localParticipant && localParticipant.setMicrophoneEnabled) {
            localParticipant.setMicrophoneEnabled(false);
            setIsSpaceBarPressed(false);
          }
        }
      } catch (error) {
        console.error('Error in spacebar keyup handler:', error);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [isSpaceBarEnabled, localParticipant]);

  return (
    <div className="flex flex-col items-center gap-4 max-w-xl mx-auto w-full">
      <div className="flex flex-col items-center gap-2">

        {/* Simple, clean microphone button */}
        <div className="flex items-center gap-2">
          {/* Main mic button */}
          <TrackToggle
            source={Track.Source.Microphone}
            className={`relative flex items-center justify-center h-10 w-10 rounded-full transition-all duration-200 ${
              !isMuted
                ? "bg-primary-DEFAULT text-white"
                : isSpaceBarPressed
                  ? "scale-95 bg-bg-tertiary/80"
                  : "bg-bg-tertiary/50 hover:bg-bg-tertiary/70"
            }`}
            showIcon={false}
            aria-label={isMuted ? "Unmute microphone" : "Mute microphone"}
            aria-pressed={!isMuted}
            onChange={(enabled) => {
              console.log('TrackToggle onChange:', enabled ? 'enabled' : 'disabled');
              setIsMuted(!enabled);
            }}
          >
            {isMuted ? (
              <MicOff className="w-4 h-4 text-text-secondary" />
            ) : (
              <Mic className="w-4 h-4 text-white" />
            )}
          </TrackToggle>

          {/* Audio visualizer button */}
          <div className={`flex items-center justify-center h-10 w-10 rounded-full bg-bg-tertiary/50 transition-all duration-200 ${!isMuted ? "opacity-100" : "opacity-60"}`}>
            <div className="w-6 h-6 flex items-center justify-center">
              <MultibandAudioVisualizer
                state={!isMuted ? "speaking" : "idle"}
                barWidth={2}
                minBarHeight={2}
                maxBarHeight={!isMuted ? 12 : 8}
                accentColor={!isMuted ? "#2188ff" : "#6e7681"}
                accentShade={950}
                frequencies={localMultibandVolume}
                borderRadius={2}
                gap={1}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
