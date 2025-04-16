import asyncio
import logging
import json
import os
import requests
import uuid
from datetime import datetime
from livekit import rtc
from livekit.agents import JobContext, WorkerOptions, cli, stt, AutoSubscribe, transcription
from livekit.plugins.openai import stt as plugin
from livekit.plugins import silero
from dotenv import load_dotenv
import database
from tts_elevenlabs import ElevenLabsTTS

load_dotenv(dotenv_path=".env.local")

logger = logging.getLogger("groq-whisper-stt-transcriber")

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"
ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY")

# Initialize the database
database.init_db()

# Current conversation ID
current_conversation_id = None

# Initialize TTS engine
tts_engine = None


def initialize_tts():
    """Initialize TTS"""
    global tts_engine

    try:
        # Make sure we have a valid API key
        if not ELEVENLABS_API_KEY or ELEVENLABS_API_KEY == "your_elevenlabs_api_key_here":
            logger.warning("No valid ElevenLabs API key found")
            raise ValueError("Invalid ElevenLabs API key")

        # Pass the API key from environment variable
        tts_engine = ElevenLabsTTS(api_key=ELEVENLABS_API_KEY)

        # Test if the engine is working by synthesizing a short text with Daniel's voice
        test_audio = tts_engine.synthesize("Test...", voice_name="Daniel")

        if test_audio:
            logger.info("ElevenLabs TTS engine initialized and tested successfully")
            return True
        else:
            logger.warning("ElevenLabs TTS engine initialized but test synthesis failed")
            return False
    except Exception as e:
        logger.error(f"Error initializing ElevenLabs TTS engine: {e}")
        return False


async def synthesize_speech(text, room, voice_name=None):
    """Synthesize speech and send it to the room

    Args:
        text (str): The text to synthesize
        room: The LiveKit room to send the audio to
        voice_name (str, optional): The voice name to use. Defaults to None (uses default voice).
    """
    global tts_engine

    if not tts_engine:
        logger.warning("TTS engine not initialized, attempting to initialize now...")
        if initialize_tts():
            logger.info("TTS engine initialized successfully on demand")
        else:
            logger.error("TTS engine initialization failed, cannot synthesize speech")
            # Send a message to the client that TTS failed
            error_message = {
                "type": "tts_error",
                "message": "Failed to initialize TTS engine"
            }
            await room.local_participant.publish_data(json.dumps(error_message).encode())
            return False

    try:
        # Use the default voice from the TTS engine
        if not voice_name and hasattr(tts_engine, 'default_voice_name'):
            voice_name = tts_engine.default_voice_name

        # Create a data message to notify clients that TTS is starting
        tts_start_message = {
            "type": "tts_starting",
            "text": text[:100] + ("..." if len(text) > 100 else ""),
            "provider": "elevenlabs",
            "voice": voice_name
        }
        await room.local_participant.publish_data(json.dumps(tts_start_message).encode())

        logger.info(f"Synthesizing speech with ElevenLabs using voice '{voice_name}': {text[:50]}...")

        # Generate audio using TTS engine with the specified voice (or Daniel by default)
        audio_data = tts_engine.synthesize(text, voice_name=voice_name)

        if audio_data:
            logger.info(f"Audio data generated, size: {len(audio_data)} bytes")

            # Publish the audio to the room
            logger.info(f"Publishing audio data to room, size: {len(audio_data)} bytes")

            # Create an audio track from the audio data
            try:
                # Send a message to the client that audio data is coming with voice info
                # (This audio_info is not used directly, but kept for reference)
                # We'll send a simpler voice_info message instead

                # First send the audio info with a specific topic
                try:
                    # Send a message about the voice being used
                    voice_info = {
                        "type": "voice_info",
                        "voice": tts_engine.default_voice_name if hasattr(tts_engine, 'default_voice_name') else "default",
                        "provider": "elevenlabs"
                    }
                    await room.local_participant.publish_data(json.dumps(voice_info).encode())
                    logger.info("Published voice info message")

                    # Then publish the binary data
                    await room.local_participant.publish_data(audio_data)
                    logger.info(f"Published audio data, size: {len(audio_data)} bytes")
                except Exception as e:
                    logger.error(f"Error publishing audio data: {e}")
                logger.info("Successfully published audio data")
            except Exception as e:
                logger.error(f"Unexpected error publishing audio data: {e}")
                # Send an error message to the client
                error_message = {
                    "type": "tts_error",
                    "message": f"Error publishing audio: {str(e)}"
                }
                await room.local_participant.publish_data(json.dumps(error_message).encode())
                return False

            # Create a data message to notify clients that TTS is complete
            tts_complete_message = {
                "type": "tts_complete",
                "provider": "elevenlabs",
                "voice": voice_name or "default"
            }
            await room.local_participant.publish_data(json.dumps(tts_complete_message).encode())

            logger.info("Speech synthesis and transmission complete")
            return True
        else:
            logger.error("Failed to synthesize speech: No audio data generated")
            # Send an error message to the client
            error_message = {
                "type": "tts_error",
                "message": "Failed to generate audio data"
            }
            await room.local_participant.publish_data(json.dumps(error_message).encode())
            return False
    except Exception as e:
        logger.error(f"Error in speech synthesis: {e}")
        # Send an error message to the client
        try:
            error_message = {
                "type": "tts_error",
                "message": f"Speech synthesis error: {str(e)}"
            }
            await room.local_participant.publish_data(json.dumps(error_message).encode())
        except Exception as publish_error:
            logger.error(f"Error sending error message: {publish_error}")
        return False


def generate_ai_response(text, conversation_id=None):
    """Generate an AI response using Groq API"""
    global current_conversation_id

    # If no conversation ID is provided, use the current one or create a new one
    if conversation_id is None:
        if current_conversation_id is None:
            current_conversation_id = database.create_conversation("New Conversation")
        conversation_id = current_conversation_id

    if not GROQ_API_KEY:
        logger.error("GROQ_API_KEY is not set in the environment")
        error_msg = "Error: API key not configured. Please set GROQ_API_KEY in .env.local file."
        database.add_message(conversation_id, "ai", error_msg)
        return error_msg

    # Add user message to database
    database.add_message(conversation_id, "user", text)

    # Get conversation history from database
    conversation = database.get_conversation(conversation_id)

    # Generate a title for the conversation based on the first message
    if len(conversation.get("messages", [])) <= 1:
        title = database.generate_conversation_title(conversation_id)
        logger.info(f"Generated title for conversation {conversation_id}: {title}")
    messages = conversation["messages"]

    # Convert to format expected by Groq API
    conversation_history = []
    for msg in messages:
        role = "user" if msg["type"] == "user" else "assistant"
        conversation_history.append({"role": role, "content": msg["content"]})

    # Keep only the last 10 messages to avoid token limits
    if len(conversation_history) > 10:
        conversation_history = conversation_history[-10:]

    headers = {
        "Authorization": f"Bearer {GROQ_API_KEY}",
        "Content-Type": "application/json"
    }

    data = {
        "model": "llama3-8b-8192",
        "messages": conversation_history,
        "temperature": 0.7,
        "max_tokens": 1024
    }

    try:
        response = requests.post(GROQ_API_URL, headers=headers, json=data)
        response.raise_for_status()
        result = response.json()
        ai_response = result["choices"][0]["message"]["content"]

        # Add AI response to database
        database.add_message(conversation_id, "ai", ai_response)

        return ai_response
    except Exception as e:
        logger.error(f"Error calling Groq API: {e}")
        error_msg = f"Error generating response: {str(e)}"
        database.add_message(conversation_id, "ai", error_msg)
        return error_msg

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

            # Generate AI response using the current conversation
            ai_response = generate_ai_response(transcribed_text, current_conversation_id)
            logger.info(f"AI Response: {ai_response}")

            # Send AI response to all participants
            data_message = {
                "type": "ai_response",
                "text": ai_response,
                "conversation_id": current_conversation_id
            }
            # The publish_data method only takes one argument (the data)
            await room.local_participant.publish_data(json.dumps(data_message).encode())

            # Synthesize speech from the AI response
            await synthesize_speech(ai_response, room)

            # Also send updated conversation data to ensure UI is in sync
            conversation = database.get_conversation(current_conversation_id)
            conversation_data = {
                "type": "conversation_data",
                "conversation": conversation
            }
            await room.local_participant.publish_data(json.dumps(conversation_data).encode())

        elif ev.type == stt.SpeechEventType.RECOGNITION_USAGE:
            logger.debug(f"metrics: {ev.recognition_usage}")

        stt_forwarder.update(ev)


async def entrypoint(ctx: JobContext):
    logger.info(f"starting transcriber (speech to text) example, room: {ctx.room.name}")

    # Initialize the current conversation ID as None - we'll create one when needed
    global current_conversation_id
    current_conversation_id = None

    # Initialize TTS engine
    if initialize_tts():
        logger.info("TTS engine initialization successful")
    else:
        logger.warning("TTS engine initialization failed, speech synthesis will not be available")

    # Check if there are any existing conversations
    conversations = database.list_conversations(limit=1)
    if conversations:
        # Use the most recent conversation
        current_conversation_id = conversations[0]["id"]
        logger.info(f"Using existing conversation with ID: {current_conversation_id}")
    else:
        # Create a new conversation only if none exist
        current_conversation_id = database.create_conversation(f"New Conversation")
        logger.info(f"Created new conversation with ID: {current_conversation_id}")

    # Check if Groq API key is available
    if GROQ_API_KEY:
        # uses "whisper-large-v3-turbo" model by default
        stt_impl = plugin.STT.with_groq()
    else:
        # Fall back to silero VAD with local transcription
        logger.warning("Groq API key not available, using local transcription")
        stt_impl = stt.StreamAdapter(
            stt=stt.STT.with_default(),
            vad=silero.VAD.load(min_silence_duration=0.2),
        )

    if not stt_impl.capabilities.streaming:
        # wrap with a stream adapter to use streaming semantics
        stt_impl = stt.StreamAdapter(
            stt=stt_impl,
            vad=silero.VAD.load(
                min_silence_duration=0.2,
            ),
        )

    # Handler for text input messages
    # Declare global variable at the beginning of the function
    async def process_text_input(data: rtc.DataPacket):
        global current_conversation_id
        try:
            message_str = data.data.decode('utf-8')
            message = json.loads(message_str)

            if message.get('type') == 'clear_all_conversations':
                # Clear all conversations
                deleted_count = database.clear_all_conversations()
                logger.info(f"Cleared {deleted_count} conversations")

                # Create a new conversation
                current_conversation_id = database.create_conversation(f"New Conversation")
                logger.info(f"Created new conversation with ID: {current_conversation_id}")

                response_message = {
                    "type": "all_conversations_cleared",
                    "new_conversation_id": current_conversation_id
                }
                await ctx.room.local_participant.publish_data(json.dumps(response_message).encode())
            elif message.get('type') == 'rename_conversation':
                # Rename a conversation
                conversation_id = message.get('conversation_id')
                new_title = message.get('title')

                if conversation_id and new_title:
                    success = database.update_conversation_title(conversation_id, new_title)

                    if success:
                        response_message = {
                            "type": "conversation_renamed",
                            "conversation_id": conversation_id,
                            "title": new_title
                        }
                        await ctx.room.local_participant.publish_data(json.dumps(response_message).encode())
            elif message.get('type') == 'delete_conversation':
                # Delete a conversation
                conversation_id = message.get('conversation_id')

                if conversation_id:
                    success = database.delete_conversation(conversation_id)

                    if success:
                        # If we deleted the current conversation, find another one to use
                        if current_conversation_id == conversation_id:
                            # Get remaining conversations
                            remaining_conversations = database.list_conversations(limit=1)
                            if remaining_conversations:
                                # Use the most recent conversation
                                current_conversation_id = remaining_conversations[0]["id"]
                                logger.info(f"Switched to existing conversation with ID: {current_conversation_id}")
                            else:
                                # Create a new conversation if none exist
                                current_conversation_id = database.create_conversation(f"New Conversation")
                                logger.info(f"Created new conversation with ID: {current_conversation_id}")

                        # If we deleted the current conversation, we need to send the new conversation ID
                        # Otherwise, we don't need to send a new conversation ID
                        new_conversation_id = None
                        if current_conversation_id == conversation_id:
                            new_conversation_id = current_conversation_id

                        response_message = {
                            "type": "conversation_deleted",
                            "conversation_id": conversation_id,
                            "new_conversation_id": new_conversation_id
                        }
                        await ctx.room.local_participant.publish_data(json.dumps(response_message).encode())
            elif message.get('type') == 'list_conversations':
                # Return the list of conversations
                conversations = database.list_conversations(limit=20)
                response_message = {
                    "type": "conversations_list",
                    "conversations": conversations
                }
                await ctx.room.local_participant.publish_data(json.dumps(response_message).encode())
            elif message.get('type') == 'get_conversation':
                # Return a specific conversation
                conversation_id = message.get('conversation_id')
                if conversation_id:
                    conversation = database.get_conversation(conversation_id)
                    if conversation:
                        # Set this as the current conversation
                        current_conversation_id = conversation_id

                        response_message = {
                            "type": "conversation_data",
                            "conversation": conversation
                        }
                        await ctx.room.local_participant.publish_data(json.dumps(response_message).encode())
            elif message.get('type') == 'new_conversation':
                # Create a new conversation
                current_conversation_id = database.create_conversation(message.get('title', f"Conversation-{datetime.now().isoformat()}"))

                response_message = {
                    "type": "new_conversation_created",
                    "conversation_id": current_conversation_id
                }
                await ctx.room.local_participant.publish_data(json.dumps(response_message).encode())
            elif message.get('type') == 'text_input':
                text_input = message.get('text')
                logger.info(f"Received text input: {text_input}")

                # Check if we need to create a new conversation
                if message.get('new_conversation'):
                    current_conversation_id = database.create_conversation(f"Conversation-{ctx.room.name}-{datetime.now().isoformat()}")
                    logger.info(f"Created new conversation with ID: {current_conversation_id}")

                # Echo back the user's message to ensure it appears in the UI
                echo_message = {
                    "type": "user_message_echo",
                    "text": text_input,
                    "conversation_id": current_conversation_id
                }
                await ctx.room.local_participant.publish_data(json.dumps(echo_message).encode())

                # Generate AI response using the current conversation
                ai_response = generate_ai_response(text_input, current_conversation_id)
                logger.info(f"AI Response to text input: {ai_response}")

                # Send AI response to all participants
                response_message = {
                    "type": "ai_response",
                    "text": ai_response,
                    "conversation_id": current_conversation_id
                }
                await ctx.room.local_participant.publish_data(json.dumps(response_message).encode())

                # Synthesize speech from the AI response
                await synthesize_speech(ai_response, ctx.room)

                # Also send updated conversation data to ensure UI is in sync
                conversation = database.get_conversation(current_conversation_id)
                conversation_data = {
                    "type": "conversation_data",
                    "conversation": conversation
                }
                await ctx.room.local_participant.publish_data(json.dumps(conversation_data).encode())
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

    @ctx.room.on("track_subscribed")
    def on_track_subscribed(
        track: rtc.Track,
        publication: rtc.TrackPublication,
        participant: rtc.RemoteParticipant,
    ):
        # spin up a task to transcribe each track
        if track.kind == rtc.TrackKind.KIND_AUDIO:
            asyncio.create_task(transcribe_track(participant, track))

    await ctx.connect(auto_subscribe=AutoSubscribe.AUDIO_ONLY)


if __name__ == "__main__":
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint))
