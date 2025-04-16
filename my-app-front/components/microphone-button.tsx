import { TrackToggle, useLocalParticipant } from "@livekit/components-react";
import { Track } from "livekit-client";
import { MultibandAudioVisualizer } from "@/components/visualization/multiband";
import { DeviceSelector } from "@/components/device-selector";
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
  const [isMuted, setIsMuted] = useState(localParticipant.isMicrophoneEnabled);
  const [isSpaceBarPressed, setIsSpaceBarPressed] = useState(false);

  useEffect(() => {
    setIsMuted(localParticipant.isMicrophoneEnabled === false);
  }, [localParticipant.isMicrophoneEnabled]);

  useEffect(() => {
    if (!isSpaceBarEnabled) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code === "Space") {
        localParticipant.setMicrophoneEnabled(true);
        setIsSpaceBarPressed(true);
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.code === "Space") {
        localParticipant.setMicrophoneEnabled(false);
        setIsSpaceBarPressed(false);
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
          <span>Press and hold <kbd className="px-2 py-1 bg-bg-tertiary rounded border border-border-DEFAULT mx-1">Space</kbd> to speak</span>
        ) : (
          <span>Click the microphone to toggle</span>
        )}
      </div>

      <div
        className={`flex items-center justify-center gap-3 px-4 py-3 bg-bg-tertiary rounded-lg text-text-primary border border-border-DEFAULT hover:border-primary-DEFAULT active:translate-y-[1px] active:scale-[0.99] transition-all ease-out duration-250 ${
          isSpaceBarPressed ? "scale-95 border-primary-DEFAULT bg-bg-overlay" : "scale-100"
        }`}
      >
        <TrackToggle
          source={Track.Source.Microphone}
          className={
            "flex items-center justify-center gap-3 h-full " +
            (isMuted ? "opacity-50" : "")
          }
          showIcon={false}
        >
          {isMuted ? (
            <MicOff className="w-5 h-5 text-text-secondary" />
          ) : (
            <Mic className="w-5 h-5 text-primary-DEFAULT" />
          )}
          <MultibandAudioVisualizer
            state="speaking"
            barWidth={3}
            minBarHeight={3}
            maxBarHeight={20}
            accentColor={"#2188ff"} // primary color
            accentShade={950}
            frequencies={localMultibandVolume}
            borderRadius={5}
            gap={2}
          />
        </TrackToggle>
        <DeviceSelector kind="audioinput" />
      </div>
    </div>
  );
};
