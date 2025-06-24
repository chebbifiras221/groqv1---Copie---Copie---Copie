import asyncio
import json
import logging

from dotenv import load_dotenv
from livekit import rtc
from livekit.agents import JobContext, WorkerOptions, cli, stt, AutoSubscribe, transcription
from livekit.plugins.openai import stt as plugin
from livekit.plugins import silero

import config
import database
import auth_db
import shutdown
import ai_utils
from tts_web import WebTTS
from message_handlers import (
    handle_clear_conversations, handle_rename_conversation, handle_delete_conversation,
    handle_list_conversations, handle_auth_request, handle_get_conversation, handle_new_conversation
)
from text_processor import handle_text_input, generate_fallback_message

load_dotenv(dotenv_path=".env.local")

# Configure detailed logging
logging.basicConfig(
    level=getattr(logging, config.LOGGING_CONFIG["level"]),
    format=config.LOGGING_CONFIG["format"],
    datefmt=config.LOGGING_CONFIG["datefmt"]
)

logger = logging.getLogger("groq-whisper-stt-transcriber")

# Initialize shutdown handling
shutdown.initialize_shutdown_handling()
print("\n=== Press Ctrl+C or send SIGTERM to gracefully shutdown the application ===\n")

# Initialize database - consolidated initialization
from db_utils import ensure_db_file_exists

try:
    # Ensure the database file exists
    ensure_db_file_exists()

    # Initialize the database and run migrations (WAL mode is enabled automatically per connection)
    database.init_db()

    # Initialize the authentication database
    auth_db.init_auth_db()

    logger.info("Database and authentication systems initialized successfully")
except Exception as e:
    logger.error(config.ERROR_MESSAGES["database_init_error"].format(error=e))
    raise

# Current conversation ID
current_conversation_id = None

# Initialize TTS engine
tts_engine = None


def find_or_create_empty_conversation(teaching_mode="teacher", check_current=True, user_id=None):
    """
    Find an existing empty conversation or create a new one for the specified user and teaching mode.

    This function implements conversation reuse logic to avoid creating unnecessary empty conversations.
    It first checks if the current conversation is still valid, then searches for existing empty
    conversations with the same teaching mode, and finally creates a new one if needed.

    Args:
        teaching_mode (str, optional): The teaching mode to use for the conversation. Must be either
                                     'teacher' for structured teaching or 'qa' for question-answer mode.
                                     Defaults to "teacher". Invalid values are automatically corrected to "teacher".
        check_current (bool, optional): Whether to verify if the current global conversation still exists
                                      and is accessible by the user before searching for alternatives.
                                      Defaults to True. Set to False to skip current conversation validation.
        user_id (str, optional): The unique identifier of the user who will own this conversation.
                                Used for data isolation and access control. If None, creates a conversation
                                without user association (legacy mode). Defaults to None.

    Returns:
        str: The unique identifier (UUID) of either an existing empty conversation that was reused
             or a newly created conversation. This ID can be used for all subsequent conversation
             operations like adding messages or retrieving conversation data.

    Raises:
        Exception: If database operations fail during conversation creation or validation.
                  The function logs errors and attempts to continue with fallback behavior.

    Example:
        >>> conversation_id = find_or_create_empty_conversation("qa", True, "user123")
        >>> print(f"Using conversation: {conversation_id}")
        Using conversation: 550e8400-e29b-41d4-a716-446655440000
    """
    global current_conversation_id  # Access the global variable that tracks the active conversation

    # First, verify if the current conversation exists (if requested)
    # This prevents using stale conversation IDs that may have been deleted
    if check_current and current_conversation_id:
        try:
            # Get the conversation from the database with user_id check for access control
            # This ensures users can only access their own conversations
            conversation = database.get_conversation(current_conversation_id, user_id)

            # If the conversation doesn't exist or user doesn't have access, reset current_conversation_id
            # This handles cases where conversations were deleted or user switched accounts
            if not conversation:
                logger.warning(f"Current conversation ID {current_conversation_id} does not exist or user {user_id} doesn't have access, will create a new one")
                current_conversation_id = None  # Clear the invalid conversation ID
        except Exception as e:
            # Log any database errors and reset the conversation ID to ensure clean state
            logger.error(f"Error checking if conversation exists: {e}")
            current_conversation_id = None  # Reset to None to trigger new conversation creation

    # Look for empty conversations for this user with matching teaching mode
    # This implements conversation reuse to avoid cluttering the UI with empty conversations
    empty_conversation_id = None  # Initialize variable to store found empty conversation ID
    conversations = database.list_conversations(limit=10, user_id=user_id)  # Get recent conversations for this user

    # Iterate through existing conversations to find an empty one with matching teaching mode
    for conv in conversations:
        # Check if this conversation has any messages AND matches the teaching mode
        # Get the teaching mode, defaulting to "teacher" for backward compatibility
        conversation_mode = conv.get("teaching_mode") or "teacher"  # Default to teacher if no mode set
        # Check if conversation has no messages (is empty)
        has_no_messages = not conv.get("message_count") or conv.get("message_count") == 0

        # If conversation is empty and has the right teaching mode, we can reuse it
        if has_no_messages and conversation_mode == teaching_mode:
            empty_conversation_id = conv["id"]  # Store the ID of the reusable conversation
            logger.info(f"Found existing empty conversation with matching mode ({teaching_mode}): {empty_conversation_id} for user: {user_id}")
            break  # Exit loop since we found a suitable conversation

    # If we found an empty conversation, use it
    if empty_conversation_id:
        current_conversation_id = empty_conversation_id  # Update global conversation ID
        logger.info(f"Using existing empty conversation: {current_conversation_id}")

        # Update the conversation with the new teaching mode and refresh timestamp
        # This ensures the conversation appears at the top of the list and has correct mode
        try:
            result = database.reuse_empty_conversation(
                conversation_id=current_conversation_id,
                teaching_mode=teaching_mode
            )
            # Check if the reuse operation was successful
            if result and result.get("conversation_id"):
                logger.info(f"Updated empty conversation with teaching mode: {teaching_mode}")
                return result["conversation_id"]  # Return the successfully reused conversation ID
            else:
                # If reuse failed, log warning and continue to create new conversation
                logger.warning(f"Failed to reuse conversation {current_conversation_id}, will create new one")
        except Exception as e:
            # Log any errors during reuse and continue to create new conversation
            logger.error(f"Error reusing empty conversation: {e}")
            # Continue to create a new conversation

    # Create a new conversation if no empty one was found
    # Ensure teaching_mode is either 'teacher' or 'qa' for data integrity
    if teaching_mode not in ['teacher', 'qa']:
        teaching_mode = 'teacher'  # Default to teacher mode if invalid value provided

    # Create a new conversation with the specified parameters
    current_conversation_id = database.create_conversation(
        title="New Conversation",  # Default title that will be updated when first message is added
        teaching_mode=teaching_mode,  # The validated teaching mode
        user_id=user_id  # User ID for ownership and access control
    )
    logger.info(f"Created new conversation with ID: {current_conversation_id} and teaching mode: {teaching_mode} for user: {user_id}")

    return current_conversation_id  # Return the newly created conversation ID


async def send_conversation_data(conversation_id, participant):
    """
    Send updated conversation data to the client through the LiveKit data channel.

    This function retrieves the complete conversation data from the database and sends it
    to the specified participant. It's used to keep the client UI synchronized with the
    current conversation state, including all messages and metadata.

    Args:
        conversation_id (str): The unique identifier of the conversation to retrieve and send.
                              Must be a valid UUID string that exists in the database.
                              If None or empty, the function will return False immediately.
        participant (rtc.Participant): The LiveKit participant object representing the client
                                     that should receive the conversation data. Must have an
                                     active connection and the ability to receive data messages.

    Returns:
        bool: True if the conversation data was successfully retrieved from the database
              and sent to the participant without errors. False if the conversation_id
              is invalid, the conversation doesn't exist, or there was an error during
              the send operation.

    Raises:
        Exception: Database errors are caught and logged, but not re-raised. Network
                  errors during data transmission are handled by the safe_publish_data function.

    Example:
        >>> success = await send_conversation_data("550e8400-e29b-41d4-a716-446655440000", participant)
        >>> if success:
        ...     print("Conversation data sent successfully")
    """
    # Validate that we have a valid conversation ID before proceeding
    if not conversation_id:
        logger.error("Cannot send conversation data: No valid conversation ID")
        return False  # Return immediately if no conversation ID provided

    try:
        # Retrieve the complete conversation data from the database
        # This includes conversation metadata and all associated messages
        conversation = database.get_conversation(conversation_id)

        # Check if the conversation exists in the database
        if conversation:
            # Create a structured data message for the client
            # The "type" field helps the client identify how to handle this message
            conversation_data = {
                "type": "conversation_data",  # Message type identifier for client routing
                "conversation": conversation  # Complete conversation object with messages and metadata
            }

            # Send the conversation data to the participant using safe retry logic
            # Convert the dictionary to JSON string and then to bytes for transmission
            await safe_publish_data(participant, json.dumps(conversation_data).encode())
            return True  # Indicate successful transmission
    except Exception as e:
        # Log any errors that occur during database retrieval or data preparation
        logger.error(f"Error sending conversation data: {e}")

    return False  # Return False if conversation not found or any error occurred


def initialize_tts():
    """
    Initialize the Text-to-Speech (TTS) engine and verify its functionality.

    This function sets up the global TTS engine using the WebTTS implementation and
    performs a test synthesis to ensure the engine is working correctly. It handles
    both successful initialization and fallback scenarios gracefully.

    Returns:
        bool: True if the TTS engine was successfully initialized and passed the test
              synthesis. False if initialization failed or the test synthesis did not
              produce audio data. The function will still return True if the engine
              initializes but uses a fallback mechanism.

    Raises:
        Exception: All exceptions during initialization are caught and logged, but not
                  re-raised. The function returns False to indicate failure instead.

    Global Variables:
        tts_engine: Sets the global tts_engine variable to the initialized WebTTS instance.
                   This variable is used throughout the application for speech synthesis.

    Example:
        >>> if initialize_tts():
        ...     print("TTS engine ready for use")
        ... else:
        ...     print("TTS engine initialization failed")
    """
    global tts_engine  # Access the global TTS engine variable

    try:
        # Initialize with Web TTS implementation
        # WebTTS handles browser-based speech synthesis with fallback mechanisms
        tts_engine = WebTTS()

        # Test if the engine is working by synthesizing a short text
        # This verifies that the TTS pipeline is functional before actual use
        test_audio = tts_engine.synthesize("Test...")

        # Check if test synthesis produced audio data
        if test_audio:
            # Check if the engine is using a fallback mechanism
            # The use_fallback attribute indicates degraded functionality
            if hasattr(tts_engine, 'use_fallback') and tts_engine.use_fallback:
                logger.warning("Web TTS engine initialized but using fallback mechanism")
            else:
                # Engine is fully functional with primary TTS method
                logger.info("Web TTS engine initialized and tested successfully")
            return True  # Engine is working, even if using fallback
        else:
            # Test synthesis failed to produce audio data
            logger.warning("Web TTS engine initialized but test synthesis failed")
            return False  # Engine not functional
    except Exception as e:
        # Log any errors that occur during initialization
        logger.error(f"Error initializing Web TTS engine: {e}")
        return False  # Initialization failed


async def synthesize_speech(text, room, voice_name=None):
    """
    Synthesize speech from text and send the audio data to all participants in the LiveKit room.

    This function handles the complete text-to-speech pipeline including engine initialization,
    audio generation, and transmission to clients. It provides comprehensive error handling
    and status notifications to keep clients informed of the synthesis progress.

    Args:
        text (str): The text content to convert to speech. Should be non-empty and contain
                   readable text. Very long text may be truncated or cause timeouts.
                   Special characters and markup are handled by the TTS engine.
        room (rtc.Room): The LiveKit room object where the synthesized audio will be sent.
                        Must be an active room with connected participants. The audio is
                        sent through the local participant's data channel.
        voice_name (str, optional): The specific voice identifier to use for synthesis.
                                  If None, uses the default voice configured in the TTS engine.
                                  Voice availability depends on the TTS provider. Defaults to None.

    Returns:
        bool: True if speech synthesis and transmission completed successfully.
              False if any step failed, including engine initialization, audio generation,
              or data transmission errors.

    Raises:
        Exception: All exceptions are caught and handled internally. Errors are logged
                  and error messages are sent to the client instead of raising exceptions.

    Global Variables:
        tts_engine: Uses and potentially initializes the global TTS engine instance.

    Example:
        >>> success = await synthesize_speech("Hello world", room, "en-US-AriaNeural")
        >>> if success:
        ...     print("Speech synthesis completed")
    """
    global tts_engine  # Access the global TTS engine instance

    # Helper function to get provider name for status messages
    def get_provider_name():
        """
        Determine which TTS provider is currently being used.

        Returns:
            str: "fallback" if using fallback mechanism, "web" for primary web TTS
        """
        # Check if engine has fallback attribute and is using fallback mode
        return "fallback" if hasattr(tts_engine, 'use_fallback') and tts_engine.use_fallback else "web"

    # Helper function to send error message to client
    async def send_error(message):
        """
        Send an error message to the client through the data channel.

        Args:
            message (str): The error message to send to the client

        Returns:
            bool: Always returns False to indicate synthesis failure
        """
        try:
            # Create structured error message for client
            error_message = {
                "type": "tts_error",  # Message type for client error handling
                "message": message    # Human-readable error description
            }
            # Send error message to all participants in the room
            await room.local_participant.publish_data(json.dumps(error_message).encode())
        except Exception as publish_error:
            # Log errors that occur while sending error messages
            logger.error(f"Error sending error message: {publish_error}")
        return False  # Always return False to indicate synthesis failure

    # Check if TTS engine is initialized
    if not tts_engine:
        logger.warning("TTS engine not initialized, attempting to initialize now...")
        # Try to initialize the TTS engine on demand
        if initialize_tts():
            logger.info("TTS engine initialized successfully on demand")
        else:
            # If initialization fails, send error to client and return
            logger.error("TTS engine initialization failed, cannot synthesize speech")
            return await send_error("Failed to initialize TTS engine")

    try:
        # Get provider and voice information for status messages
        provider = get_provider_name()  # Determine if using web or fallback TTS
        # Use provided voice name or fall back to engine default or config default
        voice = voice_name or (tts_engine.default_voice_name if hasattr(tts_engine, 'default_voice_name') else config.TTS_DEFAULT_VOICE)

        # Create a data message to notify clients that TTS is starting
        # This helps clients show loading states and manage UI expectations
        tts_start_message = {
            "type": "tts_starting",  # Message type for client TTS state management
            "text": text[:100] + ("..." if len(text) > 100 else ""),  # Truncated text preview for UI
            "provider": provider,    # TTS provider being used (web/fallback)
            "voice": voice          # Voice name being used for synthesis
        }
        # Send the start notification to all participants
        await safe_publish_data(room.local_participant, json.dumps(tts_start_message).encode())

        # Log synthesis start with truncated text for debugging
        logger.info(f"Synthesizing speech with {provider.capitalize()} TTS: {text[:50]}...")

        # Generate audio using TTS engine
        # This is the core synthesis operation that converts text to audio data
        audio_data = tts_engine.synthesize(text, voice_name=voice_name)

        # Validate that audio data was successfully generated
        if not audio_data:
            logger.error("Failed to synthesize speech: No audio data generated")
            # Send error message to client using configured error message
            return await send_error(config.ERROR_MESSAGES["tts_synthesis_failed"])

        # Log successful audio generation with data size for debugging
        logger.info(f"Audio data generated, size: {len(audio_data)} bytes")

        # Send voice info message to inform clients about the voice being used
        # This helps clients display voice information in the UI
        voice_info = {
            "type": "voice_info",  # Message type for voice information
            "voice": voice,        # The actual voice name used
            "provider": provider   # The TTS provider that generated the audio
        }
        # Send voice information to all participants
        await safe_publish_data(room.local_participant, json.dumps(voice_info).encode())
        logger.info("Published voice info message")

        # Try to publish the audio data to all participants
        try:
            # Check if this is a web TTS message (JSON format) or binary audio data
            # Different TTS engines may return different data formats
            try:
                # Try to decode and parse as JSON first
                # Web TTS engines often return structured JSON messages
                message_str = audio_data.decode('utf-8')  # Decode bytes to string
                message = json.loads(message_str)         # Parse JSON structure

                # If it's a web TTS message, publish it as is
                # Web TTS messages contain metadata and instructions for client-side playback
                if message.get('type') == 'web_tts':
                    logger.info(f"Publishing web TTS message for text: {message.get('text', '')[:50]}...")
                    # Send the JSON message directly to the client
                    await safe_publish_data(room.local_participant, audio_data)
                else:
                    # Otherwise, publish as binary data even though it's JSON
                    # This handles unexpected JSON formats
                    await safe_publish_data(room.local_participant, audio_data)
            except (UnicodeDecodeError, json.JSONDecodeError):
                # If it's not valid UTF-8 or JSON, it's binary audio data
                # This handles traditional audio formats like WAV, MP3, etc.
                await safe_publish_data(room.local_participant, audio_data)

            # Log successful audio data publishing with size for debugging
            logger.info(f"Published audio data, size: {len(audio_data)} bytes")
        except Exception as e:
            # Handle any errors during audio data publishing
            logger.error(f"Error publishing audio data: {e}")
            # Send error message to client with specific error details
            return await send_error(f"Error publishing audio: {str(e)}")

        # Create a data message to notify clients that TTS is complete
        # This allows clients to update UI state and stop loading indicators
        tts_complete_message = {
            "type": "tts_complete",  # Message type for TTS completion
            "provider": provider,    # Provider that completed the synthesis
            "voice": voice          # Voice that was used for synthesis
        }
        # Send completion notification to all participants
        await safe_publish_data(room.local_participant, json.dumps(tts_complete_message).encode())

        # Log successful completion of the entire synthesis pipeline
        logger.info("Speech synthesis and transmission complete")
        return True  # Indicate successful completion
    except Exception as e:
        # Handle any unexpected errors in the synthesis pipeline
        logger.error(f"Error in speech synthesis: {e}")
        # Send error message to client with error details
        return await send_error(f"Speech synthesis error: {str(e)}")

def generate_ai_response(text, conversation_id=None):
    """
    Generate an AI response using the Groq API with multiple model fallback support.

    This function handles the complete AI response generation pipeline including conversation
    context extraction, message storage, AI model interaction, and response persistence.
    It supports both regular conversations and hidden instructions that don't appear in history.

    Args:
        text (str): The user's input text that needs an AI response. This can be a question,
                   instruction, or any text that should be processed by the AI model.
                   Empty or None text will still be processed but may produce generic responses.
        conversation_id (str or dict, optional): Either a simple conversation ID string or a
                                                dictionary containing conversation context with keys:
                                                - 'conversation_id': The actual conversation ID
                                                - 'teaching_mode': 'teacher' or 'qa' mode
                                                - 'is_hidden': Whether this is a hidden instruction
                                                If None, uses or creates the current global conversation.

    Returns:
        str: The generated AI response text. If all AI models fail, returns an error message
             from the configuration. The response is automatically stored in the database
             unless there are critical errors.

    Raises:
        Exception: Database errors during message storage or conversation retrieval may be
                  raised. API errors are handled internally with fallback logic.

    Global Variables:
        current_conversation_id: May be updated if a new conversation is created.

    Example:
        >>> response = generate_ai_response("What is Python?", {"conversation_id": "123", "teaching_mode": "teacher"})
        >>> print(f"AI Response: {response}")
    """
    global current_conversation_id  # Access global conversation tracking variable

    # If no conversation ID is provided, use the current one or create a new one
    # This ensures every AI response is associated with a valid conversation
    if conversation_id is None:
        # Check if we have a current conversation, create one if not
        if current_conversation_id is None:
            # Create a new conversation with default title and settings
            current_conversation_id = database.create_conversation(config.DEFAULT_CONVERSATION_TITLE)
        conversation_id = current_conversation_id  # Use the current conversation

    # Validate that the Groq API key is configured
    if not config.GROQ_API_KEY:
        logger.error("GROQ_API_KEY is not set in the environment")
        # Get the configured error message for missing API key
        error_msg = config.ERROR_MESSAGES["api_key_missing"]
        # Store the error message in the conversation for user visibility
        database.add_message(conversation_id, "ai", error_msg)
        return error_msg  # Return error message to display to user

    # Extract conversation context from the conversation_id parameter
    # This handles both simple string IDs and complex context dictionaries
    actual_conversation_id, teaching_mode, is_hidden = ai_utils.extract_conversation_context(conversation_id)

    # Add user message to database only if it's not a hidden instruction
    # Hidden instructions are used for system commands that shouldn't appear in chat history
    if not is_hidden:
        database.add_message(actual_conversation_id, "user", text)

    # Get conversation history from database including all messages and metadata
    conversation = database.get_conversation(actual_conversation_id)

    # Generate a title for the conversation based on the first message
    # This improves UX by showing meaningful conversation titles in the sidebar
    if len(conversation.get("messages", [])) <= 1:
        database.generate_conversation_title(actual_conversation_id)
        logger.info(f"Generated title for conversation {actual_conversation_id}")

    # Prepare conversation history for the AI model
    # This formats messages and adds the appropriate system prompt for the teaching mode
    conversation_history = ai_utils.prepare_conversation_history(conversation["messages"], teaching_mode)

    # Generate AI response using multiple models with fallback logic
    # This tries multiple AI models in sequence until one succeeds
    ai_response = ai_utils.generate_ai_response_with_models(conversation_history)

    # Store the response in the database for conversation persistence
    database.add_message(actual_conversation_id, "ai", ai_response)

    # Log response length for debugging and monitoring
    # Long responses might cause issues with TTS or UI rendering
    if ai_utils.should_split_response(ai_response):
        logger.info(f"Response is long ({len(ai_response)} chars), but not splitting to avoid TTS and UI issues")

    logger.info("Successfully generated AI response")
    return ai_response  # Return the generated response

async def _forward_transcription(
    stt_stream: stt.SpeechStream, stt_forwarder: transcription.STTSegmentsForwarder, room: rtc.Room
):
    """
    Forward speech-to-text transcription events to clients and process final transcripts for AI responses.

    This function handles the real-time speech recognition pipeline, processing both interim and final
    transcripts, generating AI responses for completed speech, and managing the complete voice interaction flow.

    Args:
        stt_stream (stt.SpeechStream): The speech-to-text stream that provides transcription events
                                     including interim transcripts, final transcripts, and usage metrics
        stt_forwarder (transcription.STTSegmentsForwarder): LiveKit forwarder that sends transcription
                                                           segments to connected clients for real-time display
        room (rtc.Room): The LiveKit room object used for publishing AI responses and audio data
                        to all connected participants

    Returns:
        None: This is an async generator function that processes events continuously
    """
    # Process each transcription event from the speech-to-text stream
    async for ev in stt_stream:
        # Handle interim transcription results (partial, potentially inaccurate)
        if ev.type == stt.SpeechEventType.INTERIM_TRANSCRIPT:
            # you may not want to log interim transcripts, they are not final and may be incorrect
            # Extract the most likely transcription alternative from the event
            interim_text = ev.alternatives[0].text  # Get the best guess transcription
            logger.debug(f" -> {interim_text}")  # Log interim result with arrow indicator

        # Handle final transcription results (complete, accurate speech recognition)
        elif ev.type == stt.SpeechEventType.FINAL_TRANSCRIPT:
            # Extract the final transcribed text from the best alternative
            transcribed_text = ev.alternatives[0].text  # Get the final, accurate transcription
            logger.debug(f" ~> {transcribed_text}")  # Log final result with different indicator

            # Get the teaching mode from the database for the current conversation
            # This determines how the AI will respond (teacher vs qa mode)
            teaching_mode = ai_utils.get_teaching_mode_from_db(current_conversation_id)
            logger.info(f"Using teaching mode for voice input: {teaching_mode}")

            # Create a context object with conversation ID, teaching mode, and is_hidden flag
            # This packages all necessary information for AI response generation
            context = {
                "conversation_id": current_conversation_id,  # The active conversation to add messages to
                "teaching_mode": teaching_mode,              # The AI behavior mode (teacher/qa)
                "is_hidden": False  # Voice inputs are never hidden instructions (always visible in chat)
            }

            # Generate AI response using the current conversation and teaching mode
            # Pass the transcribed speech and context to the AI response generator
            ai_response = generate_ai_response(transcribed_text, context)

            # Check if the response is empty or just whitespace
            # This handles cases where AI generation fails or returns empty content
            if not ai_response or not ai_response.strip():
                logger.warning("Received empty AI response for voice input, using fallback message")
                # Use fallback message generator to provide a helpful response
                ai_response = generate_fallback_message(transcribed_text)

            # Log the AI response for debugging and monitoring
            logger.info(f"AI Response: {ai_response}")

            # Send the response as a single message (multi-part processing disabled)
            # Check if we have a valid conversation ID before sending response
            if current_conversation_id:
                # Send AI response to all participants as a single message
                # Create structured message for client consumption
                data_message = {
                    "type": "ai_response",                      # Message type for client routing
                    "text": ai_response,                        # The generated AI response text
                    "conversation_id": current_conversation_id  # Associated conversation ID
                }
                # Use our safe publish method with retry logic for reliable delivery
                await safe_publish_data(room.local_participant, json.dumps(data_message).encode())
            else:
                # Log an error if we don't have a valid conversation ID
                # This indicates a system state issue that needs investigation
                logger.error(config.ERROR_MESSAGES["no_conversation_id"])

            # Synthesize speech from the AI response to provide audio feedback
            # This converts the text response to speech for the user
            await synthesize_speech(ai_response, room)

            # Send updated conversation data to ensure UI is in sync
            # This keeps the client interface updated with the latest conversation state
            await send_conversation_data(current_conversation_id, room.local_participant)

        # Handle speech recognition usage metrics and statistics
        elif ev.type == stt.SpeechEventType.RECOGNITION_USAGE:
            # Log usage metrics for monitoring and debugging speech recognition performance
            logger.debug(f"metrics: {ev.recognition_usage}")

        # Forward the transcription event to connected clients for real-time display
        # This updates the client UI with transcription progress and results
        stt_forwarder.update(ev)


async def safe_publish_data(participant, data, max_retries=config.DEFAULT_MAX_RETRIES, retry_delay=config.DEFAULT_RETRY_DELAY):
    """
    Safely publish data to a LiveKit participant with comprehensive retry logic and error handling.

    This function implements exponential backoff retry logic to handle network issues, connection
    timeouts, and temporary service disruptions. It's essential for reliable client communication
    in the real-time application environment.

    Args:
        participant (rtc.Participant): The LiveKit participant object to send data to. Must have
                                     an active connection and the ability to receive data messages.
                                     Typically room.local_participant for server-to-client communication.
        data (bytes): The data to publish, must be in bytes format. Usually JSON strings that have
                     been encoded to bytes using .encode(). Contains structured messages for client
                     consumption including AI responses, status updates, and conversation data.
        max_retries (int, optional): Maximum number of retry attempts before giving up. Defaults to
                                   config.DEFAULT_MAX_RETRIES. Higher values increase reliability but
                                   may delay error detection. Typical values: 3-5 retries.
        retry_delay (float, optional): Base delay between retries in seconds. Defaults to
                                     config.DEFAULT_RETRY_DELAY. Used with exponential backoff to
                                     gradually increase delay between attempts. Typical values: 0.5-2.0 seconds.

    Returns:
        bool: True if data was successfully published to the participant within the retry limit.
              False if all retry attempts failed or if an unrecoverable error occurred.
              Calling code should handle False return values appropriately.

    Example:
        >>> success = await safe_publish_data(participant, json.dumps(message).encode())
        >>> if not success:
        ...     logger.error("Failed to send message to client")
    """
    # Iterate through retry attempts, starting from 0 up to max_retries-1
    for attempt in range(max_retries):
        try:
            # Attempt to publish data to the participant through LiveKit data channel
            # This is the core operation that may fail due to network issues
            await participant.publish_data(data)
            return True  # Success - data was published successfully
        except Exception as e:
            # Extract the exception type name for more informative error messages
            error_type = type(e).__name__  # Get class name like 'ConnectionError', 'TimeoutError', etc.

            # Check if this is not the last attempt (we have more retries available)
            if attempt < max_retries - 1:
                # Not the last attempt, so retry after a delay
                # Calculate exponential backoff delay: base_delay * 2^attempt
                backoff_delay = retry_delay * (2 ** attempt)  # Exponential backoff: 0.5s, 1s, 2s, 4s...
                logger.warning(f"Publish attempt {attempt+1} failed with {error_type}: {str(e)}. Retrying in {backoff_delay}s...")
                # Wait for the calculated delay before next attempt
                await asyncio.sleep(backoff_delay)  # Async sleep to not block other operations
            else:
                # Last attempt failed - log error and give up
                logger.error(f"Failed to publish data after {max_retries} attempts. Last error: {error_type}: {str(e)}")
                return False  # All retries exhausted, return failure

    # This line should never be reached due to the logic above, but included for safety
    return False  # Fallback return for any unexpected code path

async def entrypoint(ctx: JobContext):
    """
    Main entry point for the LiveKit agent that sets up speech-to-text, message handling, and room connections.

    This function initializes all core components of the AI teaching assistant including TTS engine,
    conversation management, speech recognition, and client message handling. It serves as the
    orchestrator for the entire real-time communication system.

    Args:
        ctx (JobContext): LiveKit job context containing room information, participant details,
                         and connection management utilities. Provides access to the room object
                         for publishing data and managing real-time communication.

    Returns:
        None: This function runs continuously until the connection is terminated.
    """
    # Log the start of the transcriber service with room identification
    logger.info(f"starting transcriber (speech to text) example, room: {ctx.room.name}")

    # Use the global current_conversation_id - it's already initialized as None
    # This variable tracks the active conversation across all client interactions
    global current_conversation_id

    # Initialize TTS engine and verify it's working properly
    # This sets up the text-to-speech system for AI response audio generation
    if initialize_tts():
        logger.info("TTS engine initialization successful")  # TTS is ready for use
    else:
        # Log warning but continue - TTS failure shouldn't stop the service
        logger.warning(config.ERROR_MESSAGES["tts_init_failed"])

    # Check if there are any existing conversations in the database
    # This helps maintain continuity if the service restarts
    conversations = database.list_conversations(limit=1)  # Get the most recent conversation
    if conversations:
        # Use the most recent conversation to maintain context
        current_conversation_id = conversations[0]["id"]  # Extract conversation UUID
        logger.info(f"Using existing conversation with ID: {current_conversation_id}")
    else:
        # Don't create a new conversation automatically - let the frontend handle this
        # This prevents unnecessary empty conversations and gives clients control
        logger.info("No existing conversations found. Waiting for frontend to create one.")

    # Check if Groq API key is available for cloud-based speech recognition
    if config.GROQ_API_KEY:
        # uses "whisper-large-v3-turbo" model by default for fast, accurate transcription
        # Groq provides high-quality cloud-based speech-to-text services
        stt_impl = plugin.STT.with_groq()
    else:
        # Fall back to silero VAD with local transcription when no API key available
        logger.warning("Groq API key not available, using local transcription")
        # Create a local speech-to-text implementation with voice activity detection
        stt_impl = stt.StreamAdapter(
            stt=stt.STT.with_default(),  # Use default local STT implementation
            vad=silero.VAD.load(         # Load Silero Voice Activity Detection model
                min_silence_duration=config.STT_CONFIG["min_silence_duration"],      # Minimum silence to end speech
                min_speech_duration=config.STT_CONFIG["min_speech_duration"],        # Minimum speech duration to process
                prefix_padding_duration=config.STT_CONFIG["prefix_padding_duration"] # Padding before speech starts
            ),
        )

    # Check if the STT implementation supports streaming and wrap if necessary
    if not stt_impl.capabilities.streaming:
        # wrap with a stream adapter to use streaming semantics for real-time transcription
        # This ensures consistent streaming behavior regardless of the underlying STT implementation
        stt_impl = stt.StreamAdapter(
            stt=stt_impl,                # The base STT implementation to wrap
            vad=silero.VAD.load(         # Voice Activity Detection for stream processing
                min_silence_duration=config.STT_CONFIG["min_silence_duration"],      # Silence threshold for speech end
                min_speech_duration=config.STT_CONFIG["min_speech_duration"],        # Minimum speech duration to process
                prefix_padding_duration=config.STT_CONFIG["prefix_padding_duration"] # Audio padding before speech
            ),
        )

    # Handler for text input messages from clients
    # This nested function processes all incoming data messages and routes them appropriately
    async def process_text_input(data: rtc.DataPacket):
        """
        Process incoming data packets from clients and route them to appropriate message handlers.

        This function serves as the main message router for all client communications including
        text input, conversation management, authentication, and system commands.
        """
        # Declare global variable at the beginning of the function for conversation tracking
        global current_conversation_id
        try:
            # Decode the incoming data packet from bytes to string
            message_str = data.data.decode('utf-8')  # Convert bytes to UTF-8 string
            # Parse the JSON message from the client
            message = json.loads(message_str)        # Convert JSON string to Python dictionary

            # Route messages to appropriate handlers based on message type
            # Extract the message type to determine which handler to use
            message_type = message.get('type')       # Get the 'type' field from message dictionary

            # Handle conversation clearing requests (delete all conversations of a specific mode)
            if message_type == 'clear_all_conversations':
                # Clear conversations and get the new conversation ID
                current_conversation_id = await handle_clear_conversations(message, ctx, current_conversation_id, safe_publish_data)

            # Handle conversation renaming requests
            elif message_type == 'rename_conversation':
                # Rename a specific conversation with a new title
                await handle_rename_conversation(message, ctx, safe_publish_data)

            # Handle conversation deletion requests
            elif message_type == 'delete_conversation':
                # Delete a conversation and potentially get a new current conversation
                new_id = await handle_delete_conversation(message, ctx, current_conversation_id, safe_publish_data)
                if new_id:  # Update current conversation if a new one was created
                    current_conversation_id = new_id

            # Handle requests to list all conversations
            elif message_type == 'list_conversations':
                # Send the list of conversations to the client
                await handle_list_conversations(message, ctx, safe_publish_data)

            # Handle authentication requests (login, register, verify, logout)
            elif message_type == 'auth_request':
                # Process authentication and get response data
                response_data = await handle_auth_request(message, ctx, safe_publish_data)
                # Update current conversation if login was successful
                # Check if this was a successful login operation
                if response_data.get('success') and message.get('data', {}).get('type') == 'login':
                    # Extract user ID from successful login response
                    user_id = response_data.get('user', {}).get('id')
                    if user_id:  # If we have a valid user ID, create/find a conversation
                        # Find or create an empty conversation for the newly logged-in user
                        current_conversation_id = find_or_create_empty_conversation(
                            teaching_mode='teacher',  # Default to teacher mode for new users
                            check_current=True,       # Validate current conversation
                            user_id=user_id          # Associate with the logged-in user
                        )

            # Handle requests to get a specific conversation
            elif message_type == 'get_conversation':
                # Retrieve and send a specific conversation to the client
                conversation_id = await handle_get_conversation(message, ctx, safe_publish_data)
                if conversation_id:  # Update current conversation if retrieval was successful
                    current_conversation_id = conversation_id

            # Handle requests to create a new conversation
            elif message_type == 'new_conversation':
                # Create a new conversation and make it the current one
                current_conversation_id = await handle_new_conversation(message, ctx, safe_publish_data, find_or_create_empty_conversation)

            # Handle text input for AI processing (the main interaction type)
            elif message_type == 'text_input':
                # Process user text input through the complete AI pipeline
                current_conversation_id = await handle_text_input(
                    message, ctx, current_conversation_id, safe_publish_data,  # Basic parameters
                    find_or_create_empty_conversation, generate_ai_response,   # Conversation and AI functions
                    synthesize_speech, send_conversation_data                  # Audio and data sync functions
                )
        except Exception as e:
            # Log any errors that occur during message processing
            # This prevents one bad message from crashing the entire service
            logger.error(f"Error handling data message: {e}")

    # Non-async wrapper for the data received event
    # LiveKit event handlers must be synchronous, so we need a wrapper for our async function
    def handle_data_received(data: rtc.DataPacket):
        """
        Synchronous wrapper for handling incoming data packets from clients.

        Since LiveKit event handlers must be synchronous but our processing is async,
        this function creates an async task to handle the data processing.
        """
        # Create a task to process the data asynchronously without blocking the event handler
        # This allows the LiveKit event system to continue processing other events
        asyncio.create_task(process_text_input(data))

    # Async function to handle audio track transcription
    async def transcribe_track(participant: rtc.RemoteParticipant, track: rtc.Track):
        """
        Set up and manage speech-to-text transcription for an audio track.

        This function creates the audio processing pipeline that converts speech
        to text and forwards transcription events to clients and the AI system.
        """
        # Create an audio stream from the track for processing
        audio_stream = rtc.AudioStream(track)  # Converts track to processable audio stream

        # Create a forwarder to send transcription segments to clients in real-time
        stt_forwarder = transcription.STTSegmentsForwarder(
            room=ctx.room,           # The room to send transcription data to
            participant=participant, # The participant whose audio is being transcribed
            track=track             # The specific audio track being processed
        )

        # Create a speech-to-text stream for processing audio frames
        stt_stream = stt_impl.stream()  # Initialize STT stream with configured implementation

        # Start the transcription forwarding task asynchronously
        # This task will process STT events and generate AI responses
        asyncio.create_task(_forward_transcription(stt_stream, stt_forwarder, ctx.room))

        # Process each audio frame from the stream and send to STT
        async for ev in audio_stream:
            # Push each audio frame to the speech-to-text stream for processing
            stt_stream.push_frame(ev.frame)  # Send audio data to STT engine

    # Register data received handler with a synchronous function
    # This sets up the event listener for all incoming client messages
    ctx.room.on("data_received", handle_data_received)

    # Register track_subscribed handler for audio processing
    # The decorator automatically passes the track, publication, and participant
    # We use _ prefix for unused parameters to indicate they're intentionally not used
    @ctx.room.on("track_subscribed")
    def _(track: rtc.Track, _: rtc.TrackPublication, participant: rtc.RemoteParticipant):
        """
        Handle new audio tracks by setting up transcription processing.

        This event handler is called whenever a participant starts sharing audio.
        It sets up the speech-to-text pipeline for the new audio track.
        """
        # spin up a task to transcribe each track, but only for audio tracks
        if track.kind == rtc.TrackKind.KIND_AUDIO:  # Only process audio tracks, ignore video
            # Create an async task to handle transcription for this audio track
            asyncio.create_task(transcribe_track(participant, track))

    # Connect to the LiveKit room and start processing
    # This establishes the connection and begins handling events
    await ctx.connect(auto_subscribe=AutoSubscribe.AUDIO_ONLY)  # Only subscribe to audio tracks


if __name__ == "__main__":
    """
    Main execution block that starts the LiveKit agent application.

    This block only executes when the script is run directly (not imported as a module).
    It initializes and starts the LiveKit worker with our entrypoint function.
    """
    # Start the LiveKit agent application with our entrypoint function
    # cli.run_app() handles the LiveKit agent lifecycle and connection management
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint))  # Pass our entrypoint function to the LiveKit CLI
