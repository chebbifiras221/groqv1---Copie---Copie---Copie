import { LocalParticipant, ConnectionState, Room } from 'livekit-client';

/**
 * Maximum number of retry attempts for publishing data
 */
const MAX_RETRIES = 3;

/**
 * Base delay for exponential backoff in milliseconds
 */
const BASE_DELAY = 300;

/**
 * Safely publish data with retry logic and connection state checking
 * 
 * @param participant - The LocalParticipant to publish data through
 * @param data - The data to publish (either string or object that will be JSON stringified)
 * @param room - Optional Room object to check connection state
 * @param topic - Optional topic for the data
 * @returns Promise that resolves when data is published or rejects after max retries
 */
export async function safePublishData(
  participant: LocalParticipant | null | undefined,
  data: string | object,
  room?: Room | null,
  topic?: string
): Promise<void> {
  if (!participant) {
    throw new Error('No local participant available');
  }

  // Check if room is connected if provided
  if (room && room.state !== ConnectionState.Connected) {
    throw new Error(`Room is not connected (state: ${room.state})`);
  }

  // Prepare the data
  const dataToSend = typeof data === 'string' 
    ? new TextEncoder().encode(data)
    : new TextEncoder().encode(JSON.stringify(data));

  let lastError: Error | null = null;
  let retryCount = 0;

  while (retryCount < MAX_RETRIES) {
    try {
      // Check if the participant is still valid before attempting to publish
      if (!participant.connected) {
        throw new Error('Participant is not connected');
      }

      // Attempt to publish the data
      await participant.publishData(dataToSend, topic);
      return; // Success, exit the function
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      retryCount++;

      // If we've reached max retries, throw the last error
      if (retryCount >= MAX_RETRIES) {
        throw new Error(`Failed to publish data after ${MAX_RETRIES} attempts: ${lastError.message}`);
      }

      // Wait with exponential backoff before retrying
      const delay = BASE_DELAY * Math.pow(2, retryCount - 1);
      console.warn(`Publish attempt ${retryCount} failed: ${lastError.message}. Retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

/**
 * Check if the LiveKit connection is in a valid state for publishing data
 * 
 * @param room - The LiveKit Room to check
 * @returns boolean indicating if the connection is valid for publishing
 */
export function isConnectionValid(room: Room | null | undefined): boolean {
  if (!room) return false;
  return room.state === ConnectionState.Connected;
}

/**
 * Safely disconnect and reconnect to LiveKit
 * 
 * @param room - The LiveKit Room to reconnect
 * @returns Promise that resolves when reconnection is complete
 */
export async function safeReconnect(room: Room | null | undefined): Promise<void> {
  if (!room) {
    throw new Error('No room available for reconnection');
  }

  try {
    // First try to disconnect cleanly
    await room.disconnect();
    
    // Wait a moment before reconnecting
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Reconnect using the same token
    await room.connect();
    
    console.log('Successfully reconnected to LiveKit');
  } catch (error) {
    console.error('Error during reconnection:', error);
    throw error;
  }
}
