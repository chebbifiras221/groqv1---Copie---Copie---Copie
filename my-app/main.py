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
from tts_web import WebTTS

load_dotenv(dotenv_path=".env.local")

logger = logging.getLogger("groq-whisper-stt-transcriber")

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"
# TTS provider will be configured later

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

        # Determine the provider based on whether we're using fallback
        provider = "web"
        if hasattr(tts_engine, 'use_fallback') and tts_engine.use_fallback:
            provider = "fallback"

        # Create a data message to notify clients that TTS is starting
        tts_start_message = {
            "type": "tts_starting",
            "text": text[:100] + ("..." if len(text) > 100 else ""),
            "provider": provider,
            "voice": voice_name or (tts_engine.default_voice_name if hasattr(tts_engine, 'default_voice_name') else "Web Voice")
        }
        await room.local_participant.publish_data(json.dumps(tts_start_message).encode())

        logger.info(f"Synthesizing speech with {provider.capitalize()} TTS: {text[:50]}...")

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
                    # Determine the provider based on whether we're using fallback
                    provider = "web"
                    if hasattr(tts_engine, 'use_fallback') and tts_engine.use_fallback:
                        provider = "fallback"

                    # Send a message about the voice being used
                    voice_info = {
                        "type": "voice_info",
                        "voice": tts_engine.default_voice_name if hasattr(tts_engine, 'default_voice_name') else "Web Voice",
                        "provider": provider
                    }
                    await room.local_participant.publish_data(json.dumps(voice_info).encode())
                    logger.info("Published voice info message")

                    # Check if this is a web TTS message
                    try:
                        # Try to decode and parse as JSON
                        message_str = audio_data.decode('utf-8')
                        message = json.loads(message_str)

                        # If it's a web TTS message, publish it as is
                        if message.get('type') == 'web_tts':
                            logger.info(f"Publishing web TTS message for text: {message.get('text', '')[:50]}...")
                            await room.local_participant.publish_data(audio_data)
                        else:
                            # Otherwise, publish as binary data
                            await room.local_participant.publish_data(audio_data)
                            logger.info(f"Published audio data, size: {len(audio_data)} bytes")
                    except (UnicodeDecodeError, json.JSONDecodeError):
                        # If it's not valid UTF-8 or JSON, it's binary audio data
                        await room.local_participant.publish_data(audio_data)
                        logger.info(f"Published binary audio data, size: {len(audio_data)} bytes")
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

            # Determine the provider based on whether we're using fallback
            provider = "web"
            if hasattr(tts_engine, 'use_fallback') and tts_engine.use_fallback:
                provider = "fallback"

            # Create a data message to notify clients that TTS is complete
            tts_complete_message = {
                "type": "tts_complete",
                "provider": provider,
                "voice": voice_name or (tts_engine.default_voice_name if hasattr(tts_engine, 'default_voice_name') else "Web Voice")
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

    # Add a system message to instruct the model to act like a teacher
    teacher_system_prompt = {
        "role": "system",
        "content": """
        You are an expert teacher with years of experience in education.

        IMPORTANT: DO NOT introduce yourself or name yourself. Never refer to yourself as Professor Alex or any other name.
        Just respond directly to questions without any self-introduction or greeting preamble.

        Follow these principles in all your interactions:

        1. TEACHING STYLE:
           - Be patient, encouraging, and supportive like a real teacher would be
           - Use the Socratic method when appropriate - guide with questions rather than just giving answers
           - Adapt your explanations to the student's level of understanding
           - Use analogies and real-world examples to illustrate complex concepts

        2. KNOWLEDGE AND ACCURACY:
           - Prioritize accuracy over speed or confidence
           - When you're uncertain about something, clearly acknowledge it
           - Never make up facts or information to appear knowledgeable
           - If you notice a misconception in the student's understanding, gently correct it
           - Cite sources or reference materials when appropriate

        3. COMMUNICATION APPROACH:
           - Use clear, concise language appropriate for teaching
           - Break down complex topics into manageable parts
           - Check for understanding by asking clarifying questions
           - Provide positive reinforcement for good questions and correct answers
           - Use a conversational, friendly tone while maintaining professionalism
           - DO NOT use lengthy greetings or introductions
           - Get straight to the point and answer questions directly

        4. EDUCATIONAL BEST PRACTICES:
           - Encourage critical thinking and problem-solving
           - Provide scaffolded learning - build on existing knowledge
           - Offer multiple perspectives on complex or controversial topics
           - Suggest additional resources for further learning when appropriate
           - Tailor explanations to different learning styles when possible

        Remember that your goal is not just to provide information, but to help develop a deeper understanding of the subject matter and build critical thinking skills.
        """
    }

    # Add the system message at the beginning
    conversation_history.append(teacher_system_prompt)

    # Add the conversation history
    for msg in messages:
        role = "user" if msg["type"] == "user" else "assistant"
        conversation_history.append({"role": role, "content": msg["content"]})

    # Keep only the last 15 messages to avoid token limits, but always keep the system prompt
    if len(conversation_history) > 16:  # 15 messages + 1 system prompt
        conversation_history = [conversation_history[0]] + conversation_history[-15:]

    headers = {
        "Authorization": f"Bearer {GROQ_API_KEY}",
        "Content-Type": "application/json"
    }

    # Define models to try in order of preference - optimized for teaching tasks
    models_to_try = [
        {"name": "llama-3.1-8b-instant", "temperature": 0.6},  # First choice: Llama 3.1 8B Instant (128K context)
        {"name": "llama-3.3-70b-versatile", "temperature": 0.6},  # Second choice: Llama 3.3 70B (more powerful)
        {"name": "llama3-70b-8192", "temperature": 0.6},      # Third choice: Llama3 70B
        {"name": "llama3-8b-8192", "temperature": 0.6},       # Fourth choice: Llama3 8B
        {"name": "gemma2-9b-it", "temperature": 0.6}          # Fifth choice: Gemma 2 9B
    ]

    last_error = None

    # Try each model in sequence until one works
    for model_info in models_to_try:
        model_name = model_info["name"]
        temperature = model_info["temperature"]

        data = {
            "model": model_name,
            "messages": conversation_history,
            "temperature": temperature,
            "max_tokens": 1024,
            "top_p": 0.9,  # More focused on likely responses (good for factual teaching)
            "frequency_penalty": 0.2,  # Slightly reduce repetition
            "presence_penalty": 0.1  # Slightly encourage topic diversity
        }

        try:
            logger.info(f"Trying to generate teacher response with model: {model_name}")
            response = requests.post(GROQ_API_URL, headers=headers, json=data)
            response.raise_for_status()
            result = response.json()
            ai_response = result["choices"][0]["message"]["content"]

            # Add model info to the response for transparency
            model_descriptions = {
                "llama-3.1-8b-instant": "Llama 3.1 8B Instant - Fast model with 128K context window",
                "llama-3.3-70b-versatile": "Llama 3.3 70B Versatile - Powerful model with 128K context window",
                "llama3-70b-8192": "Llama 3 70B - Powerful model with strong reasoning capabilities",
                "llama3-8b-8192": "Llama 3 8B - Balanced model for general tasks",
                "gemma2-9b-it": "Gemma 2 9B - Google's instruction-tuned model"
            }
            model_description = model_descriptions.get(model_name, model_name)

            # Check if this is the first message and remove any introductions/greetings
            is_first_message = len([msg for msg in messages if msg["type"] == "ai"]) == 0

            if is_first_message:
                # Remove common greeting patterns from the beginning of the response
                greeting_patterns = [
                    r"^Hello[!,.]?",
                    r"^Hi[!,.]?",
                    r"^Greetings[!,.]?",
                    r"^Welcome[!,.]?",
                    r"^Good (morning|afternoon|evening|day)[!,.]?",
                    r"^Hey( there)?[!,.]?",
                    r"^I('m| am) [^.!?]*\.",  # Matches "I'm [name]" or "I am [description]"
                    r"^My name is [^.!?]*\.",
                    r"^It's (great|nice|a pleasure) to [^.!?]*\.",
                    r"^(I'm|I am) (happy|glad|excited|pleased|delighted) to [^.!?]*\."
                ]

                import re
                cleaned_response = ai_response
                for pattern in greeting_patterns:
                    cleaned_response = re.sub(pattern, "", cleaned_response, flags=re.IGNORECASE | re.MULTILINE)

                # Remove extra whitespace and newlines from the beginning
                cleaned_response = cleaned_response.lstrip()

                # If we removed something, use the cleaned response
                if cleaned_response != ai_response:
                    logger.info("Removed greeting/introduction from first response")
                    ai_response = cleaned_response

            # Decide whether to include model info based on user preference
            # You can set this to False if you don't want to show model info
            show_model_info = False

            if show_model_info:
                # Prepend model info to the response
                ai_response_with_model = f"[Using {model_description}]\n\n{ai_response}"
            else:
                # Just use the response without model info
                ai_response_with_model = ai_response

            # Add AI response to database
            database.add_message(conversation_id, "ai", ai_response_with_model)

            logger.info(f"Successfully generated teacher response with model: {model_name}")
            return ai_response_with_model

        except Exception as e:
            last_error = e
            logger.warning(f"Error using model {model_name}: {e}. Trying next model if available.")
            continue

    # If we get here, all models failed
    error_msg = f"Error generating response: All models failed. Last error: {str(last_error)}"
    logger.error(error_msg)
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
