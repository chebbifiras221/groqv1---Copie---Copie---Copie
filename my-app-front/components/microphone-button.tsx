import { TrackToggle, useLocalParticipant } from "@livekit/components-react";
import { Track } from "livekit-client";
import { MultibandAudioVisualizer } from "@/components/visualization/multiband";
import { DeviceSelector } from "@/components/device-selector";
import { useEffect, useState } from "react";
import { Mic, MicOff } from "lucide-react";
// import { RobotFace } from "@/components/ui/robot-face";

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
      <div className="text-text-secondary text-sm text-center mb-1">
        {isSpaceBarEnabled ? (
          <span>Press and hold <kbd className="px-2 py-1 rounded border border-border-DEFAULT/20 bg-[#3a424e]/50 mx-1 text-text-primary">Space</kbd> to speak</span>
        ) : (
          <span>Click the microphone to toggle</span>
        )}
      </div>

      <div
        className={`flex items-center justify-center gap-3 px-4 py-3 rounded-lg text-text-primary border transition-all ease-out duration-250 ${
          !isMuted
            ? "bg-primary-DEFAULT/20 border-primary-DEFAULT shadow-md scale-[1.02]"
            : isSpaceBarPressed
              ? "scale-95 border-primary-DEFAULT/50 bg-bg-tertiary/50"
              : "scale-100 bg-[#3a424e]/50 border-border-DEFAULT/20 hover:border-primary-DEFAULT/30"
        }`}
        role="group"
        aria-label="Microphone controls"
      >
        <TrackToggle
          source={Track.Source.Microphone}
          className={
            `flex items-center justify-center gap-3 h-full transition-all duration-300 ${isMuted ? "" : "opacity-100"}`
          }
          showIcon={false}
          aria-label={isMuted ? "Unmute microphone" : "Mute microphone"}
          aria-pressed={!isMuted}
          onChange={(enabled) => {
            console.log('TrackToggle onChange:', enabled ? 'enabled' : 'disabled');
            setIsMuted(!enabled);
          }}
        >
          {isMuted ? (
            <MicOff className="w-5 h-5 text-text-secondary transition-colors duration-200" />
          ) : (
            <Mic className="w-5 h-5 text-primary-DEFAULT animate-pulse transition-colors duration-200" />
          )}
          <div className={`transition-all duration-300 ${!isMuted ? "scale-110" : "scale-100"}`}>
            <MultibandAudioVisualizer
              state={!isMuted ? "speaking" : "idle"}
              barWidth={3}
              minBarHeight={3}
              maxBarHeight={!isMuted ? 24 : 20}
              accentColor={!isMuted ? "#2188ff" : "#6e7681"} // primary color when active, gray when muted
              accentShade={950}
              frequencies={localMultibandVolume}
              borderRadius={5}
              gap={2}
            />
          </div>
        </TrackToggle>
        <DeviceSelector kind="audioinput" />
      </div>
    </div>
  );
};
