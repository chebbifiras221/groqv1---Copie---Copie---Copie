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

# Initialize shutdown handling with the '9' key
shutdown.initialize_shutdown_handling()
print("\n=== Press the '9' key to gracefully shutdown the application ===\n")

# Initialize database - consolidated initialization
from db_utils import enable_wal_mode, ensure_db_file_exists

try:
    # Ensure the database file exists
    ensure_db_file_exists()

    # Enable WAL mode for better crash recovery
    enable_wal_mode()

    # Initialize the database and run migrations
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
    Find an existing empty conversation or create a new one.

    Args:
        teaching_mode: The teaching mode to use ('teacher' or 'qa')
        check_current: Whether to check if the current conversation exists
        user_id: The user ID to associate with the conversation

    Returns:
        str: The ID of the empty or newly created conversation
    """
    global current_conversation_id

    # First, verify if the current conversation exists (if requested)
    if check_current and current_conversation_id:
        try:
            # Get the conversation from the database with user_id check
            conversation = database.get_conversation(current_conversation_id, user_id)

            # If the conversation doesn't exist or user doesn't have access, reset current_conversation_id
            if not conversation:
                logger.warning(f"Current conversation ID {current_conversation_id} does not exist or user {user_id} doesn't have access, will create a new one")
                current_conversation_id = None
        except Exception as e:
            logger.error(f"Error checking if conversation exists: {e}")
            current_conversation_id = None

    # Look for empty conversations for this user with matching teaching mode
    empty_conversation_id = None
    conversations = database.list_conversations(limit=10, user_id=user_id)

    for conv in conversations:
        # Check if this conversation has any messages AND matches the teaching mode
        conversation_mode = conv.get("teaching_mode") or "teacher"  # Default to teacher if no mode set
        has_no_messages = not conv.get("message_count") or conv.get("message_count") == 0

        if has_no_messages and conversation_mode == teaching_mode:
            empty_conversation_id = conv["id"]
            logger.info(f"Found existing empty conversation with matching mode ({teaching_mode}): {empty_conversation_id} for user: {user_id}")
            break

    # If we found an empty conversation, use it
    if empty_conversation_id:
        current_conversation_id = empty_conversation_id
        logger.info(f"Using existing empty conversation: {current_conversation_id}")

        # Update the conversation with the new teaching mode
        try:
            result = database.reuse_empty_conversation(
                conversation_id=current_conversation_id,
                teaching_mode=teaching_mode
            )
            if result and result.get("conversation_id"):
                logger.info(f"Updated empty conversation with teaching mode: {teaching_mode}")
                return result["conversation_id"]
            else:
                logger.warning(f"Failed to reuse conversation {current_conversation_id}, will create new one")
        except Exception as e:
            logger.error(f"Error reusing empty conversation: {e}")
            # Continue to create a new conversation

    # Create a new conversation if no empty one was found
    # Ensure teaching_mode is either 'teacher' or 'qa'
    if teaching_mode not in ['teacher', 'qa']:
        teaching_mode = 'teacher'  # Default to teacher mode if invalid

    current_conversation_id = database.create_conversation(
        title="New Conversation",
        teaching_mode=teaching_mode,
        user_id=user_id
    )
    logger.info(f"Created new conversation with ID: {current_conversation_id} and teaching mode: {teaching_mode} for user: {user_id}")

    return current_conversation_id


async def send_conversation_data(conversation_id, participant):
    """
    Send updated conversation data to the client.

    Args:
        conversation_id: The ID of the conversation to send
        participant: The participant to send the data to

    Returns:
        bool: True if successful, False otherwise
    """
    if not conversation_id:
        logger.error("Cannot send conversation data: No valid conversation ID")
        return False

    try:
        conversation = database.get_conversation(conversation_id)
        if conversation:
            conversation_data = {
                "type": "conversation_data",
                "conversation": conversation
            }
            await safe_publish_data(participant, json.dumps(conversation_data).encode())
            return True
    except Exception as e:
        logger.error(f"Error sending conversation data: {e}")

    return False


def initialize_tts():
    """Initialize TTS"""
    global tts_engine

    try:
        # Initialize with Web TTS
        tts_engine = WebTTS()

        # Test if the engine is working by synthesizing a short text
        test_audio = tts_engine.synthesize("Test...")

        if test_audio:
            if hasattr(tts_engine, 'use_fallback') and tts_engine.use_fallback:
                logger.warning("Web TTS engine initialized but using fallback mechanism")
            else:
                logger.info("Web TTS engine initialized and tested successfully")
            return True
        else:
            logger.warning("Web TTS engine initialized but test synthesis failed")
            return False
    except Exception as e:
        logger.error(f"Error initializing Web TTS engine: {e}")
        return False


async def synthesize_speech(text, room, voice_name=None):
    """Synthesize speech and send it to the room

    Args:
        text (str): The text to synthesize
        room: The LiveKit room to send the audio to
        voice_name (str, optional): The voice name to use. Defaults to None (uses default voice).
    """
    global tts_engine

    # Helper function to get provider name
    def get_provider_name():
        return "fallback" if hasattr(tts_engine, 'use_fallback') and tts_engine.use_fallback else "web"

    # Helper function to get voice name
    def get_voice_name():
        return voice_name or (tts_engine.default_voice_name if hasattr(tts_engine, 'default_voice_name') else config.TTS_DEFAULT_VOICE)

    # Helper function to send error message
    async def send_error(message):
        try:
            error_message = {
                "type": "tts_error",
                "message": message
            }
            await room.local_participant.publish_data(json.dumps(error_message).encode())
        except Exception as publish_error:
            logger.error(f"Error sending error message: {publish_error}")
        return False

    # Check if TTS engine is initialized
    if not tts_engine:
        logger.warning("TTS engine not initialized, attempting to initialize now...")
        if initialize_tts():
            logger.info("TTS engine initialized successfully on demand")
        else:
            logger.error("TTS engine initialization failed, cannot synthesize speech")
            return await send_error("Failed to initialize TTS engine")

    try:
        # Use the default voice from the TTS engine if none provided
        if not voice_name and hasattr(tts_engine, 'default_voice_name'):
            voice_name = tts_engine.default_voice_name

        # Get provider and voice information
        provider = get_provider_name()
        voice = get_voice_name()

        # Create a data message to notify clients that TTS is starting
        tts_start_message = {
            "type": "tts_starting",
            "text": text[:100] + ("..." if len(text) > 100 else ""),
            "provider": provider,
            "voice": voice
        }
        await safe_publish_data(room.local_participant, json.dumps(tts_start_message).encode())

        logger.info(f"Synthesizing speech with {provider.capitalize()} TTS: {text[:50]}...")

        # Generate audio using TTS engine
        audio_data = tts_engine.synthesize(text, voice_name=voice_name)

        if not audio_data:
            logger.error("Failed to synthesize speech: No audio data generated")
            return await send_error(config.ERROR_MESSAGES["tts_synthesis_failed"])

        logger.info(f"Audio data generated, size: {len(audio_data)} bytes")

        # Send voice info message
        voice_info = {
            "type": "voice_info",
            "voice": voice,
            "provider": provider
        }
        await safe_publish_data(room.local_participant, json.dumps(voice_info).encode())
        logger.info("Published voice info message")

        # Try to publish the audio data
        try:
            # Check if this is a web TTS message
            try:
                # Try to decode and parse as JSON
                message_str = audio_data.decode('utf-8')
                message = json.loads(message_str)

                # If it's a web TTS message, publish it as is
                if message.get('type') == 'web_tts':
                    logger.info(f"Publishing web TTS message for text: {message.get('text', '')[:50]}...")
                    await safe_publish_data(room.local_participant, audio_data)
                else:
                    # Otherwise, publish as binary data
                    await safe_publish_data(room.local_participant, audio_data)
                    logger.info(f"Published audio data, size: {len(audio_data)} bytes")
            except (UnicodeDecodeError, json.JSONDecodeError):
                # If it's not valid UTF-8 or JSON, it's binary audio data
                await safe_publish_data(room.local_participant, audio_data)
                logger.info(f"Published binary audio data, size: {len(audio_data)} bytes")
        except Exception as e:
            logger.error(f"Error publishing audio data: {e}")
            return await send_error(f"Error publishing audio: {str(e)}")

        # Create a data message to notify clients that TTS is complete
        tts_complete_message = {
            "type": "tts_complete",
            "provider": provider,
            "voice": voice
        }
        await safe_publish_data(room.local_participant, json.dumps(tts_complete_message).encode())

        logger.info("Speech synthesis and transmission complete")
        return True
    except Exception as e:
        logger.error(f"Error in speech synthesis: {e}")
        return await send_error(f"Speech synthesis error: {str(e)}")

def generate_ai_response(text, conversation_id=None):
    """Generate an AI response using Groq API"""
    global current_conversation_id

    # If no conversation ID is provided, use the current one or create a new one
    if conversation_id is None:
        if current_conversation_id is None:
            current_conversation_id = database.create_conversation(config.DEFAULT_CONVERSATION_TITLE)
        conversation_id = current_conversation_id

    if not config.GROQ_API_KEY:
        logger.error("GROQ_API_KEY is not set in the environment")
        error_msg = config.ERROR_MESSAGES["api_key_missing"]
        database.add_message(conversation_id, "ai", error_msg)
        return error_msg

    # Extract conversation context
    actual_conversation_id, teaching_mode, is_hidden = ai_utils.extract_conversation_context(conversation_id)

    # Add user message to database only if it's not a hidden instruction
    if not is_hidden:
        database.add_message(actual_conversation_id, "user", text)

    # Get conversation history from database
    conversation = database.get_conversation(actual_conversation_id)

    # Generate a title for the conversation based on the first message
    if len(conversation.get("messages", [])) <= 1:
        title = database.generate_conversation_title(actual_conversation_id)
        logger.info(f"Generated title for conversation {actual_conversation_id}: {title}")

    # Prepare conversation history for the AI model
    conversation_history = ai_utils.prepare_conversation_history(conversation["messages"], teaching_mode)

    # Generate AI response using multiple models
    ai_response = ai_utils.generate_ai_response_with_models(conversation_history)

    # Store the response in the database
    database.add_message(actual_conversation_id, "ai", ai_response)

    # Log response length for debugging
    if ai_utils.should_split_response(ai_response):
        logger.info(f"Response is long ({len(ai_response)} chars), but not splitting to avoid TTS and UI issues")

    logger.info("Successfully generated AI response")
    return ai_response

async def _forward_transcription(
    stt_stream: stt.SpeechStream, stt_forwarder: transcription.STTSegmentsForwarder, room: rtc.Room
):
    """Forward the transcription to the client and log the transcript in the console"""
    async for ev in stt_stream:
        if ev.type == stt.SpeechEventType.INTERIM_TRANSCRIPT:
            # you may not want to log interim transcripts, they are not final and may be incorrect
            logger.debug(f" -> {ev.alternatives[0].text}")
        elif ev.type == stt.SpeechEventType.FINAL_TRANSCRIPT:
            transcribed_text = ev.alternatives[0].text
            logger.debug(f" ~> {transcribed_text}")

            # Get the teaching mode from the database for the current conversation
            teaching_mode = ai_utils.get_teaching_mode_from_db(current_conversation_id)
            logger.info(f"Using teaching mode for voice input: {teaching_mode}")

            # Create a context object with conversation ID, teaching mode, and is_hidden flag
            context = {
                "conversation_id": current_conversation_id,
                "teaching_mode": teaching_mode,
                "is_hidden": False  # Voice inputs are never hidden instructions
            }

            # Generate AI response using the current conversation and teaching mode
            ai_response = generate_ai_response(transcribed_text, context)

            # Check if the response is empty or just whitespace
            if not ai_response or not ai_response.strip():
                logger.warning("Received empty AI response for voice input, using fallback message")
                ai_response = generate_fallback_message(transcribed_text)

            logger.info(f"AI Response: {ai_response}")

            # Send the response as a single message (multi-part processing disabled)
            if current_conversation_id:
                # Send AI response to all participants as a single message
                data_message = {
                    "type": "ai_response",
                    "text": ai_response,
                    "conversation_id": current_conversation_id
                }
                # Use our safe publish method with retry logic
                await safe_publish_data(room.local_participant, json.dumps(data_message).encode())
            elif not current_conversation_id:
                # Log an error if we don't have a valid conversation ID
                logger.error(config.ERROR_MESSAGES["no_conversation_id"])

            # Synthesize speech from the AI response
            await synthesize_speech(ai_response, room)

            # Send updated conversation data to ensure UI is in sync
            await send_conversation_data(current_conversation_id, room.local_participant)

        elif ev.type == stt.SpeechEventType.RECOGNITION_USAGE:
            logger.debug(f"metrics: {ev.recognition_usage}")

        stt_forwarder.update(ev)


async def safe_publish_data(participant, data, max_retries=config.DEFAULT_MAX_RETRIES, retry_delay=config.DEFAULT_RETRY_DELAY):
    """
    Safely publish data with retry logic to handle connection timeouts

    Args:
        participant: The participant to publish data to
        data: The data to publish (should be bytes)
        max_retries: Maximum number of retry attempts
        retry_delay: Delay between retries in seconds

    Returns:
        bool: True if successful, False otherwise
    """
    for attempt in range(max_retries):
        try:
            await participant.publish_data(data)
            return True
        except Exception as e:
            error_type = type(e).__name__
            if attempt < max_retries - 1:
                # Not the last attempt, so retry
                logger.warning(f"Publish attempt {attempt+1} failed with {error_type}: {str(e)}. Retrying in {retry_delay}s...")
                await asyncio.sleep(retry_delay * (2 ** attempt))  # Exponential backoff
            else:
                # Last attempt failed
                logger.error(f"Failed to publish data after {max_retries} attempts. Last error: {error_type}: {str(e)}")
                return False
    return False

async def entrypoint(ctx: JobContext):
    logger.info(f"starting transcriber (speech to text) example, room: {ctx.room.name}")

    # Initialize the current conversation ID as None - we'll create one when needed
    global current_conversation_id
    current_conversation_id = None

    # Initialize TTS engine
    if initialize_tts():
        logger.info("TTS engine initialization successful")
    else:
        logger.warning(config.ERROR_MESSAGES["tts_init_failed"])

    # Check if there are any existing conversations
    conversations = database.list_conversations(limit=1)
    if conversations:
        # Use the most recent conversation
        current_conversation_id = conversations[0]["id"]
        logger.info(f"Using existing conversation with ID: {current_conversation_id}")
    else:
        # Don't create a new conversation automatically - let the frontend handle this
        current_conversation_id = None
        logger.info("No existing conversations found. Waiting for frontend to create one.")

    # Check if Groq API key is available
    if config.GROQ_API_KEY:
        # uses "whisper-large-v3-turbo" model by default
        stt_impl = plugin.STT.with_groq()
    else:
        # Fall back to silero VAD with local transcription
        logger.warning("Groq API key not available, using local transcription")
        stt_impl = stt.StreamAdapter(
            stt=stt.STT.with_default(),
            vad=silero.VAD.load(
                min_silence_duration=config.STT_CONFIG["min_silence_duration"],
                min_speech_duration=config.STT_CONFIG["min_speech_duration"],
                prefix_padding_duration=config.STT_CONFIG["prefix_padding_duration"]
            ),
        )

    if not stt_impl.capabilities.streaming:
        # wrap with a stream adapter to use streaming semantics
        stt_impl = stt.StreamAdapter(
            stt=stt_impl,
            vad=silero.VAD.load(
                min_silence_duration=config.STT_CONFIG["min_silence_duration"],
                min_speech_duration=config.STT_CONFIG["min_speech_duration"],
                prefix_padding_duration=config.STT_CONFIG["prefix_padding_duration"]
            ),
        )

    # Handler for text input messages
    # Declare global variable at the beginning of the function
    async def process_text_input(data: rtc.DataPacket):
        global current_conversation_id
        try:
            message_str = data.data.decode('utf-8')
            message = json.loads(message_str)

            # Route messages to appropriate handlers
            message_type = message.get('type')

            if message_type == 'clear_all_conversations':
                current_conversation_id = await handle_clear_conversations(message, ctx, current_conversation_id, safe_publish_data)
            elif message_type == 'rename_conversation':
                await handle_rename_conversation(message, ctx, safe_publish_data)
            elif message_type == 'delete_conversation':
                new_id = await handle_delete_conversation(message, ctx, current_conversation_id, safe_publish_data)
                if new_id:
                    current_conversation_id = new_id
            elif message_type == 'list_conversations':
                await handle_list_conversations(message, ctx, safe_publish_data)
            elif message_type == 'auth_request':
                response_data = await handle_auth_request(message, ctx, safe_publish_data)
                # Update current conversation if login was successful
                if response_data.get('success') and message.get('data', {}).get('type') == 'login':
                    user_id = response_data.get('user', {}).get('id')
                    if user_id:
                        current_conversation_id = find_or_create_empty_conversation(
                            teaching_mode='teacher',
                            check_current=True,
                            user_id=user_id
                        )
            elif message_type == 'get_conversation':
                conversation_id = await handle_get_conversation(message, ctx, safe_publish_data)
                if conversation_id:
                    current_conversation_id = conversation_id
            elif message_type == 'new_conversation':
                current_conversation_id = await handle_new_conversation(message, ctx, safe_publish_data, find_or_create_empty_conversation)
            elif message_type == 'text_input':
                current_conversation_id = await handle_text_input(
                    message, ctx, current_conversation_id, safe_publish_data,
                    find_or_create_empty_conversation, generate_ai_response,
                    synthesize_speech, send_conversation_data
                )
        except Exception as e:
            logger.error(f"Error handling data message: {e}")

    # Non-async wrapper for the data received event
    def handle_data_received(data: rtc.DataPacket):
        # Create a task to process the data asynchronously
        asyncio.create_task(process_text_input(data))

    async def transcribe_track(participant: rtc.RemoteParticipant, track: rtc.Track):
        audio_stream = rtc.AudioStream(track)
        stt_forwarder = transcription.STTSegmentsForwarder(
            room=ctx.room, participant=participant, track=track
        )

        stt_stream = stt_impl.stream()
        asyncio.create_task(_forward_transcription(stt_stream, stt_forwarder, ctx.room))

        async for ev in audio_stream:
            stt_stream.push_frame(ev.frame)

    # Register data received handler with a synchronous function
    ctx.room.on("data_received", handle_data_received)

    # Register track_subscribed handler
    # The decorator automatically passes the track, publication, and participant
    # We use _ prefix for unused parameters to indicate they're intentionally not used
    @ctx.room.on("track_subscribed")
    def _(track: rtc.Track, _: rtc.TrackPublication, participant: rtc.RemoteParticipant):
        # spin up a task to transcribe each track
        if track.kind == rtc.TrackKind.KIND_AUDIO:
            asyncio.create_task(transcribe_track(participant, track))

    await ctx.connect(auto_subscribe=AutoSubscribe.AUDIO_ONLY)


if __name__ == "__main__":
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint))
