import { Room, ConnectionState } from "livekit-client";

/**
 * Helper function to check if a room is connected
 * This avoids TypeScript errors with ConnectionState comparison
 */
export function isRoomConnected(room: Room): boolean {
  return room.state === ConnectionState.Connected;
}

/**
 * Publishes data to a room with retry logic
 */
const RECONNECT_TIMEOUT_SECONDS = 5;
const RECONNECT_WAIT_MS = 1000;
const RETRY_BASE_DELAY_MS = 300;
const DEFAULT_EVENT_TIMEOUT_MS = 3000;
const DATA_MESSAGE_EVENT = 'data-message-received';

export async function publishDataWithRetry(
  room: Room,
  message: any,
  maxRetries: number = 3
): Promise<void> {
  if (!isRoomConnected(room)) {
    console.warn('Room not connected, attempting to reconnect...');

    // Wait for the room to reconnect (up to 5 seconds)
    for (let i = 0; i < RECONNECT_TIMEOUT_SECONDS; i++) {
      await new Promise(resolve => setTimeout(resolve, RECONNECT_WAIT_MS));

      if (isRoomConnected(room)) {
        console.log('Room reconnected successfully');
        break;
      }

      // If we've waited the full timeout and still not connected, throw an error
      if (i === RECONNECT_TIMEOUT_SECONDS - 1) {
        throw new Error(`Room failed to reconnect after ${RECONNECT_TIMEOUT_SECONDS} seconds`);
      }
    }
  }

  // Send the request to the server with retry logic
  let retryCount = 0;

  while (retryCount < maxRetries) {
    try {
      await room.localParticipant.publishData(
        new TextEncoder().encode(JSON.stringify(message))
      );
      console.log('Successfully published data:', message?.type || 'unknown');
      return; // Success, exit the function
    } catch (publishError) {
      retryCount++;
      console.warn(`Publish attempt ${retryCount} failed:`, publishError);

      if (retryCount >= maxRetries) {
        throw publishError; // Rethrow after max retries
      }

      // Wait with exponential backoff before retrying
      const delay = RETRY_BASE_DELAY_MS * Math.pow(2, retryCount - 1);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

/**
 * Checks if a conversation is empty (has no user messages or meaningful AI messages)
 */
export function isConversationEmpty(conversation: any): boolean {
  // If we have the full conversation data with messages
  if (conversation.messages) {
    // Check if it has no user messages or meaningful AI messages
    const hasUserMessages = conversation.messages.some(
      (msg: any) => msg.type === 'user' || (msg.type === 'ai' && msg.content.trim().length > 0)
    );
    return !hasUserMessages;
  }

  // If we don't have full data, check if it has any messages at all
  return !conversation.message_count || conversation.message_count === 0;
}

/**
 * Waits for a specific event to be dispatched
 */
export function waitForEvent(eventName: string, timeout: number = DEFAULT_EVENT_TIMEOUT_MS): Promise<void> {
  return new Promise<void>((resolve) => {
    // Create a one-time event listener
    const handleEvent = (event: any) => {
      try {
        const data = JSON.parse(event.detail);
        if (data.type === eventName) {
          console.log(`Received ${eventName} event, resolving promise`);
          // Remove the event listener
          window.removeEventListener(DATA_MESSAGE_EVENT, handleEvent);
          resolve();
        }
      } catch (e) {
        // Ignore parsing errors
      }
    };

    // Add the event listener
    window.addEventListener(DATA_MESSAGE_EVENT, handleEvent);

    // Also set a timeout as a fallback
    setTimeout(() => {
      console.log(`Timed out waiting for ${eventName} event, resolving anyway`);
      window.removeEventListener(DATA_MESSAGE_EVENT, handleEvent);
      resolve();
    }, timeout);
  });
}
