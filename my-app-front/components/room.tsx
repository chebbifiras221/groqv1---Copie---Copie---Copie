"use client";

import { useCallback, useMemo, useEffect, useState } from "react";
import { Room, RoomEvent, Track, LocalAudioTrack, ConnectionState, ConnectionQuality } from "livekit-client";
import { LiveKitRoom, RoomAudioRenderer } from "@livekit/components-react";

import { Playground } from "@/components/playground";
import { useConnection } from "@/hooks/use-connection";

export function RoomComponent() {
  const { shouldConnect, wsUrl, token, disconnect } = useConnection();
  const [connectionAttempts, setConnectionAttempts] = useState(0);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const maxReconnectAttempts = 3;

  const room = useMemo(() => {
    const r = new Room({
      // Improve connection reliability with these options
      dynacast: true, // Optimize publishing based on subscribers
      adaptiveStream: true, // Adapt stream quality based on network
      reconnectPolicy: {
        maxRetries: 10, // More retries for better reliability
        retryInterval: 1, // Start with 1s retry interval
        maxRetryInterval: 10, // Max 10s between retries
        backoffFactor: 1.5, // Exponential backoff
      },
    });

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
        } catch (error) {
          console.warn("Background noise reduction could not be enabled", error);
        }
      }
    });

    // Enhanced connection event handling
    r.on(RoomEvent.Connected, () => {
      setConnectionAttempts(0);
      setIsReconnecting(false);

      // Dispatch a custom event that we can listen for in other components
      const connectedEvent = new CustomEvent('room-connected');
      window.dispatchEvent(connectedEvent);
    });

    r.on(RoomEvent.Disconnected, () => {
      if (shouldConnect && connectionAttempts < maxReconnectAttempts) {
        setIsReconnecting(true);
        setConnectionAttempts(prev => prev + 1);
      }
    });

    r.on(RoomEvent.ConnectionStateChanged, (state: ConnectionState) => {
      if (state === ConnectionState.Reconnecting) {
        setIsReconnecting(true);
      }
    });

    r.on(RoomEvent.ConnectionQualityChanged, (quality: ConnectionQuality) => {
      // Handle poor connection quality if needed
    });

    return r;
  }, [shouldConnect, connectionAttempts]);

  // Add a useEffect to handle reconnection attempts
  useEffect(() => {
    if (isReconnecting) {
      const reconnectTimeout = setTimeout(() => {
        if (shouldConnect && connectionAttempts < maxReconnectAttempts) {
          // Force room reconnection by disconnecting and reconnecting
          if (room.state === ConnectionState.Disconnected) {
            room.connect(wsUrl, token).catch(error => {
              setConnectionAttempts(prev => prev + 1);
            });
          }
        }
      }, 2000); // Wait 2 seconds before attempting to reconnect

      return () => clearTimeout(reconnectTimeout);
    }
  }, [isReconnecting, connectionAttempts, maxReconnectAttempts, room, shouldConnect, token, wsUrl]);

  return (
    <>
      {isReconnecting && (
        <div className="fixed top-0 left-0 right-0 bg-yellow-500 text-black py-1 text-center z-50">
          Connection unstable. Attempting to reconnect... ({connectionAttempts}/{maxReconnectAttempts})
        </div>
      )}
      <LiveKitRoom
        className="w-full h-screen overflow-hidden"
        serverUrl={wsUrl}
        token={token}
        room={room}
        connect={shouldConnect}
        onError={(error) => {
          // Handle LiveKit errors silently or show user-friendly message
        }}
      >
        <Playground />
        <RoomAudioRenderer />
      </LiveKitRoom>
    </>
  );
}
