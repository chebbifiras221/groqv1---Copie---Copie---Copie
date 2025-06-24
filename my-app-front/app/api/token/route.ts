import {
  AccessToken,                                                  // LiveKit access token class for JWT generation
  AccessTokenOptions,                                           // Options for configuring access tokens
  VideoGrant,                                                   // Permissions for video/audio/data in LiveKit rooms
} from "livekit-server-sdk";                                    // LiveKit server SDK for token generation
import { NextResponse } from "next/server";                    // Next.js response utility for API routes

const API_KEY = process.env.LIVEKIT_API_KEY;                   // LiveKit API key from environment variables
const API_SECRET = process.env.LIVEKIT_API_SECRET;             // LiveKit API secret from environment variables
const LIVEKIT_URL = process.env.NEXT_PUBLIC_LIVEKIT_URL;       // LiveKit server URL from environment variables

export type ConnectionDetails = {                              // TypeScript type for connection response
  identity: string;                                             // Unique participant identifier
  accessToken: string;                                          // JWT token for LiveKit authentication
};

export async function GET() {                                     // Handle GET requests to generate LiveKit tokens
  try {                                                          // Wrap in try-catch for error handling
    if (LIVEKIT_URL === undefined) {                            // Check if LiveKit URL is configured
      throw new Error("LIVEKIT_URL is not defined");           // Throw error if missing
    }
    if (API_KEY === undefined) {                                // Check if API key is configured
      throw new Error("LIVEKIT_API_KEY is not defined");       // Throw error if missing
    }
    if (API_SECRET === undefined) {                             // Check if API secret is configured
      throw new Error("LIVEKIT_API_SECRET is not defined");    // Throw error if missing
    }

    // Generate participant token with random identifiers
    const participantIdentity = `voice_assistant_user_${Math.floor(Math.random() * 10_000)}`; // Create unique user ID
    const roomName = `voice_assistant_room_${Math.floor(Math.random() * 10_000)}`;            // Create unique room name
    const participantToken = await createParticipantToken(     // Generate JWT token for this participant
      { identity: participantIdentity },                        // Pass participant identity
      roomName,                                                 // Pass room name
    );

    // Return connection details to the client
    const data: ConnectionDetails = {                           // Create response object
      identity: participantIdentity,                            // Participant's unique identifier
      accessToken: participantToken,                            // JWT token for authentication
    };
    return NextResponse.json(data);                             // Send JSON response to client
  } catch (error) {                                             // Handle any errors that occurred
    if (error instanceof Error) {                               // Check if it's a proper Error object
      console.error(error);                                     // Log error to server console
      return new NextResponse(error.message, { status: 500 }); // Return error message with 500 status
    }
  }
}

function createParticipantToken(                                  // Helper function to create LiveKit JWT tokens
  userInfo: AccessTokenOptions,                                 // User information (identity, etc.)
  roomName: string,                                             // Name of the room to join
) {
  const at = new AccessToken(API_KEY, API_SECRET, {            // Create new access token with API credentials
    ...userInfo,                                                // Spread user info (identity)
    ttl: "15m",                                                 // Token expires in 15 minutes
  });
  const grant: VideoGrant = {                                   // Define permissions for this token
    room: roomName,                                             // Which room the user can access
    roomJoin: true,                                             // Permission to join the room
    canPublish: true,                                           // Permission to publish audio/video
    canPublishData: true,                                       // Permission to send data messages
    canSubscribe: true,                                         // Permission to receive audio/video from others
    canUpdateOwnMetadata: true,                                 // Permission to update own metadata
  };
  at.addGrant(grant);                                           // Add the permissions to the token
  return at.toJwt();                                            // Convert to JWT string and return
}
