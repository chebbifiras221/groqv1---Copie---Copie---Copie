import asyncio
import logging
import json
import os
import requests
from livekit import rtc
from livekit.agents import JobContext, WorkerOptions, cli, stt, AutoSubscribe, transcription
from livekit.plugins.openai import stt as plugin
from livekit.plugins import silero
from dotenv import load_dotenv

load_dotenv(dotenv_path=".env.local")

logger = logging.getLogger("groq-whisper-stt-transcriber")

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"

# Track conversation history
conversation_history = []


def generate_ai_response(text):
    """Generate an AI response using Groq API"""
    global conversation_history

    if not GROQ_API_KEY:
        logger.error("GROQ_API_KEY is not set in the environment")
        return "Error: API key not configured. Please set GROQ_API_KEY in .env.local file."

    # Add user message to conversation history
    conversation_history.append({"role": "user", "content": text})

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

        # Add AI response to conversation history
        conversation_history.append({"role": "assistant", "content": ai_response})

        return ai_response
    except Exception as e:
        logger.error(f"Error calling Groq API: {e}")
        return f"Error generating response: {str(e)}"

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

            # Generate AI response
            ai_response = generate_ai_response(transcribed_text)
            logger.info(f"AI Response: {ai_response}")

            # Send AI response to all participants
            data_message = {
                "type": "ai_response",
                "text": ai_response
            }
            # The publish_data method only takes one argument (the data)
            await room.local_participant.publish_data(json.dumps(data_message).encode())

        elif ev.type == stt.SpeechEventType.RECOGNITION_USAGE:
            logger.debug(f"metrics: {ev.recognition_usage}")

        stt_forwarder.update(ev)


async def entrypoint(ctx: JobContext):
    logger.info(f"starting transcriber (speech to text) example, room: {ctx.room.name}")

    # Clear conversation history on startup
    global conversation_history
    conversation_history = []
    logger.info("Conversation history cleared on startup")

    # uses "whisper-large-v3-turbo" model by default
    stt_impl = plugin.STT.with_groq()

    if not stt_impl.capabilities.streaming:
        # wrap with a stream adapter to use streaming semantics
        stt_impl = stt.StreamAdapter(
            stt=stt_impl,
            vad=silero.VAD.load(
                min_silence_duration=0.2,
            ),
        )

    # Handler for text input messages
    async def process_text_input(data: rtc.DataPacket):
        try:
            message_str = data.data.decode('utf-8')
            message = json.loads(message_str)

            if message.get('type') == 'text_input':
                text_input = message.get('text')
                logger.info(f"Received text input: {text_input}")

                # Echo back the user's message to ensure it appears in the UI
                echo_message = {
                    "type": "user_message_echo",
                    "text": text_input
                }
                await ctx.room.local_participant.publish_data(json.dumps(echo_message).encode())

                # Generate AI response
                ai_response = generate_ai_response(text_input)
                logger.info(f"AI Response to text input: {ai_response}")

                # Send AI response to all participants
                response_message = {
                    "type": "ai_response",
                    "text": ai_response
                }
                await ctx.room.local_participant.publish_data(json.dumps(response_message).encode())
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
