"use client";

import { useCallback, useMemo, useEffect, useState } from "react";
import { Room, RoomEvent, Track, LocalAudioTrack, ConnectionState, ConnectionQuality } from "livekit-client";
import { LiveKitRoom, RoomAudioRenderer } from "@livekit/components-react";

import { Playground } from "@/components/playground";
import { useConnection } from "@/hooks/use-connection";
import { useSettings } from "@/hooks/use-settings";

export function RoomComponent() {
  const { shouldConnect, wsUrl, token, disconnect } = useConnection();
  const { settings } = useSettings();
  const [connectionAttempts, setConnectionAttempts] = useState(0);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const maxReconnectAttempts = 3;

  const handleDisconnect = () => {
    if (confirm('Are you sure you want to disconnect?')) {
      disconnect();
    }
  };

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
        } catch (e) {
          void e;
          console.warn("Background noise reduction could not be enabled");
        }
      }
    });

    // Enhanced connection event handling
    r.on(RoomEvent.Connected, () => {
      console.log('Room connected successfully');
      setConnectionAttempts(0);
      setIsReconnecting(false);

      // Dispatch a custom event that we can listen for in other components
      const connectedEvent = new CustomEvent('room-connected');
      window.dispatchEvent(connectedEvent);
    });

    r.on(RoomEvent.Disconnected, () => {
      console.log('Room disconnected');
      if (shouldConnect && connectionAttempts < maxReconnectAttempts) {
        setIsReconnecting(true);
        setConnectionAttempts(prev => prev + 1);
        console.info('Connection lost. Attempting to reconnect...');
      } else if (connectionAttempts >= maxReconnectAttempts) {
        console.error('Failed to connect after multiple attempts. Please refresh the page.');
      }
    });

    r.on(RoomEvent.ConnectionStateChanged, (state: ConnectionState) => {
      console.log('Connection state changed:', state);
      if (state === ConnectionState.Reconnecting) {
        setIsReconnecting(true);
        console.info('Connection unstable. Attempting to reconnect...');
      }
    });

    r.on(RoomEvent.ConnectionQualityChanged, (quality: ConnectionQuality) => {
      console.log('Connection quality changed:', quality);
      if (quality === ConnectionQuality.Poor) {
        console.info('Connection quality is poor. Some features may be affected.');
      }
    });

    return r;
  }, [shouldConnect, connectionAttempts]);

  // We'll use a different approach to send the teaching mode
  // Instead of using metadata, we'll send it with each message

  // Add a useEffect to handle reconnection attempts
  useEffect(() => {
    if (isReconnecting) {
      const reconnectTimeout = setTimeout(() => {
        if (shouldConnect && connectionAttempts < maxReconnectAttempts) {
          console.log(`Reconnection attempt ${connectionAttempts + 1}/${maxReconnectAttempts}`);
          // Force room reconnection by disconnecting and reconnecting
          if (room.state === ConnectionState.Disconnected) {
            room.connect(wsUrl, token).catch(error => {
              console.error('Reconnection failed:', error);
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
          console.error('LiveKit error:', error);
          console.error('Connection error. Please try refreshing the page.');
        }}
      >
        <Playground />
        <RoomAudioRenderer />
      </LiveKitRoom>
    </>
  );
}
