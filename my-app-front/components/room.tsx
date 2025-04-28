"use client";

import { useCallback, useMemo, useEffect } from "react";
import { Room, RoomEvent, Track, LocalAudioTrack } from "livekit-client";
import { LiveKitRoom, RoomAudioRenderer } from "@livekit/components-react";

import { Playground } from "@/components/playground";
import { useConnection } from "@/hooks/use-connection";
import { useSettings } from "@/hooks/use-settings";

export function RoomComponent() {
  const { shouldConnect, wsUrl, token, disconnect } = useConnection();
  const { settings } = useSettings();

  const handleDisconnect = () => {
    if (confirm('Are you sure you want to disconnect?')) {
      disconnect();
    }
  };

  const room = useMemo(() => {
    const r = new Room();

    // Set up event listeners
    r.on(RoomEvent.LocalTrackPublished, async (trackPublication) => {
      if (
        trackPublication.source === Track.Source.Microphone &&
        trackPublication.track instanceof LocalAudioTrack
      ) {
        const { KrispNoiseFilter, isKrispNoiseFilterSupported } = await import(
          "@livekit/krisp-noise-filter"
        );
        if (!isKrispNoiseFilterSupported()) {
          console.error(
            "Enhanced noise filter is not supported for this browser",
          );
          return;
        }
        try {
          await trackPublication.track?.setProcessor(KrispNoiseFilter());
        } catch (e) {
          void e;
          console.warn("Background noise reduction could not be enabled");
        }
      }
    });

    // Set up any additional room event handlers here if needed
    r.on(RoomEvent.Connected, () => {
      console.log('Room connected');

      // Dispatch a custom event that we can listen for in other components
      const connectedEvent = new CustomEvent('room-connected');
      window.dispatchEvent(connectedEvent);
    });

    return r;
  }, []);

  // We'll use a different approach to send the teaching mode
  // Instead of using metadata, we'll send it with each message

  return (
    <>
      <LiveKitRoom
        className="overflow-y-hidden w-full h-full"
        serverUrl={wsUrl}
        token={token}
        room={room}
        connect={shouldConnect}
        onError={console.error}
      >
        <Playground />
        <RoomAudioRenderer />
      </LiveKitRoom>
    </>
  );
}
