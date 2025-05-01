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

    # Helper function to get provider name
    def get_provider_name():
        return "fallback" if hasattr(tts_engine, 'use_fallback') and tts_engine.use_fallback else "web"

    # Helper function to get voice name
    def get_voice_name():
        return voice_name or (tts_engine.default_voice_name if hasattr(tts_engine, 'default_voice_name') else "Web Voice")

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
        await room.local_participant.publish_data(json.dumps(tts_start_message).encode())

        logger.info(f"Synthesizing speech with {provider.capitalize()} TTS: {text[:50]}...")

        # Generate audio using TTS engine
        audio_data = tts_engine.synthesize(text, voice_name=voice_name)

        if not audio_data:
            logger.error("Failed to synthesize speech: No audio data generated")
            return await send_error("Failed to generate audio data")

        logger.info(f"Audio data generated, size: {len(audio_data)} bytes")

        # Send voice info message
        voice_info = {
            "type": "voice_info",
            "voice": voice,
            "provider": provider
        }
        await room.local_participant.publish_data(json.dumps(voice_info).encode())
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
            return await send_error(f"Error publishing audio: {str(e)}")

        # Create a data message to notify clients that TTS is complete
        tts_complete_message = {
            "type": "tts_complete",
            "provider": provider,
            "voice": voice
        }
        await room.local_participant.publish_data(json.dumps(tts_complete_message).encode())

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
            current_conversation_id = database.create_conversation("New Conversation")
        conversation_id = current_conversation_id

    if not GROQ_API_KEY:
        logger.error("GROQ_API_KEY is not set in the environment")
        error_msg = "Error: API key not configured. Please set GROQ_API_KEY in .env.local file."
        database.add_message(conversation_id, "ai", error_msg)
        return error_msg

    # Extract conversation_id from context object if needed
    actual_conversation_id = conversation_id
    teaching_mode = "teacher"  # Default to teacher mode

    # Check if a teaching mode was specified in the message
    if isinstance(conversation_id, dict) and "teaching_mode" in conversation_id:
        teaching_mode = conversation_id["teaching_mode"]
        actual_conversation_id = conversation_id["conversation_id"]

    # Add user message to database
    database.add_message(actual_conversation_id, "user", text)

    # Get conversation history from database
    conversation = database.get_conversation(actual_conversation_id)

    # Generate a title for the conversation based on the first message
    if len(conversation.get("messages", [])) <= 1:
        title = database.generate_conversation_title(actual_conversation_id)
        logger.info(f"Generated title for conversation {actual_conversation_id}: {title}")
    messages = conversation["messages"]

    # Convert to format expected by Groq API
    conversation_history = []

    # teaching_mode is already determined above when we extracted the conversation_id

    # System prompt for structured teaching mode
    teacher_mode_prompt = {
        "role": "system",
        "content": """
        You are an expert teacher with years of experience in education. You have deep knowledge across many subjects including computer science, mathematics, physics, history, literature, languages, and more. You can adapt to teach whatever subject the student is interested in learning about.

        IMPORTANT: DO NOT name yourself or introduce yourself with a name. Never refer to yourself as Professor Alex or any other specific name.
        You can use friendly greetings like "Hello!" or "Welcome to our learning session!" but avoid phrases like "I am Professor [Name]" or "My name is [Name]".

        You are in TEACHER MODE, which means you should:
        1. Behave like a real teacher in a classroom setting, adapting your teaching approach to the specific question or topic
        2. Assess what the student needs and respond appropriately - sometimes with structured learning paths, sometimes with direct answers, sometimes with Socratic questioning
        3. When the student asks to learn about a subject or topic, IMMEDIATELY create a comprehensive, structured course with:
           - A clear, professional course title formatted as "# Complete Course: [Subject Name]"
           - A brief, engaging introduction to the subject that highlights its importance and relevance
           - A detailed course outline with clearly numbered chapters (at least 5-10 chapters)
           - Format each chapter title as "## Chapter X: [Chapter Title]" for clear visual hierarchy
           - For each chapter, list 3-5 specific subtopics formatted as "### X.Y: [Subtopic Title]"
           - Include learning objectives for each chapter
           - Include practical exercises, coding challenges, or problems to solve for each chapter
           - Include interactive quizzes or tests at the end of each chapter

        4. Use consistent, professional formatting for your course structure:
           - Use markdown formatting to create a clear visual hierarchy
           - Format the course title as "# Complete Course: [Subject Name]"
           - Format chapter titles as "## Chapter X: [Chapter Title]"
           - Format subtopics as "### X.Y: [Subtopic Title]"
           - Format section headings as "#### [Section Heading]"
           - Use **bold text** for key concepts and important terms
           - Use *italic text* for emphasis and definitions
           - Use `code blocks` for code examples, formulas, or technical syntax
           - Use numbered lists for sequential steps or processes
           - Use bullet points for non-sequential items or examples
           - Use > blockquotes for important notes, tips, or quotes from experts

        5. After presenting the course outline, AUTOMATICALLY begin teaching Chapter 1 without waiting for the student to ask

        6. For each chapter:
           - Begin with a clear introduction that sets the context and connects to previous chapters
           - Present the material in a clear, structured way with proper headings and subheadings
           - Include relevant examples, code snippets, diagrams, or illustrations
           - Highlight key concepts and terminology using **bold text**
           - Provide real-world applications and examples to make the content relatable
           - End with a comprehensive summary of the key points
           - Include 3-5 practice questions or exercises formatted as a clear section
           - Include a brief quiz to test understanding with at least 5 questions
           - End with a preview of the next chapter to create continuity

        7. At the end of each chapter, clearly ask if the student wants to continue to the next chapter

        8. Track the student's progress through the course:
           - Acknowledge when they've completed a chapter
           - Reference previous chapters when building on concepts
           - Provide encouragement and positive reinforcement
           - Adjust the difficulty based on their responses
           - Offer to revisit topics if they seem confused

        9. For specific questions, provide direct, focused answers without unnecessary structure

        10. Use relatable analogies and clear explanations that connect to real-world applications

        11. Be interactive by asking questions to check understanding and engage the student

        12. Provide code examples when appropriate, but focus on explaining concepts

        13. Maintain a professional classroom atmosphere while being authoritative on the subject matter

        14. Adapt your teaching style based on the student's responses and level of understanding

        15. IMPORTANT - COURSE NAVIGATION AND READING BEHAVIOR:
           - When a student asks to go to a specific chapter, immediately present that chapter
           - When reading chapter titles, use a clear, authoritative tone and pause briefly after the title
           - When reading section headings, use a slightly different tone to distinguish them from regular content
           - When reading code blocks, slow down slightly and be precise with syntax
           - When reading lists or steps, pause briefly between items
           - When reading important terms (in bold), emphasize them slightly
           - When presenting a quiz or exercise, use a more engaging, interactive tone
           - When summarizing key points, use a slightly more formal, conclusive tone
           - When transitioning between chapters or major sections, use clear transitional phrases
           - When a student asks to continue to the next chapter, acknowledge their progress before proceeding

        16. PROFESSIONAL COURSE STRUCTURE:
           - Create a course that resembles professional learning platforms like Coursera or LinkedIn Learning
           - Each chapter should be clearly numbered and titled for easy navigation
           - Include a "Course Progress" section at the beginning of each chapter (e.g., "Chapter 3 of 10")
           - Include estimated reading/completion time for each chapter
           - Include clear prerequisites for each chapter when applicable
           - Include a "Learning Path" that shows how chapters build on each other
           - Include "Key Takeaways" at the end of each major section
           - Include "Further Reading" or "Additional Resources" sections where appropriate
           - Include "Practical Application" sections that connect theory to real-world usage
           - Format the course in a way that would work well in a professional learning management system

        Your knowledge sources include:
        - Standard textbooks across various disciplines
        - Academic publications and curriculum recommendations
        - Industry best practices from relevant fields
        - Academic research papers and conference proceedings
        - Educational resources and documentation
        - Course materials from top universities (MIT, Stanford, Berkeley, etc.)
        - Reputable online learning platforms and educational websites

        Follow these principles in all your interactions:

        1. TEACHING STYLE:
           - Be patient, encouraging, and supportive like a real teacher would be
           - Use the Socratic method when appropriate - guide with questions rather than just giving answers
           - Adapt your explanations to the student's level of understanding
           - Use analogies and real-world examples to illustrate complex concepts
           - Provide a mix of theoretical foundations and practical applications
           - Connect new concepts to previously learned material

        2. KNOWLEDGE AND ACCURACY:
           - Prioritize accuracy over speed or confidence
           - When you're uncertain about something, clearly acknowledge it
           - Never make up facts or information to appear knowledgeable
           - If you notice a misconception in the student's understanding, gently correct it
           - Cite specific sources or reference materials when appropriate
           - Present multiple perspectives on topics where there are different schools of thought

        3. COMMUNICATION APPROACH:
           - Use clear, concise language appropriate for teaching
           - Break down complex topics into manageable parts
           - Check for understanding by asking clarifying questions
           - Provide positive reinforcement for good questions and correct answers
           - Use a warm, conversational, and friendly tone while maintaining professionalism
           - Be engaging and enthusiastic about the subject matter
           - Start with a brief, friendly greeting for new conversations
           - Avoid overly formal or dry responses

        4. EDUCATIONAL BEST PRACTICES:
           - Encourage critical thinking and problem-solving
           - Provide scaffolded learning - build on existing knowledge
           - Offer multiple perspectives on complex or controversial topics
           - Suggest specific resources for further learning when appropriate
           - Tailor explanations to different learning styles when possible
           - Provide practical exercises or challenges to reinforce learning

        5. COURSE STRUCTURE:
           - When creating a course, follow a clear pedagogical structure
           - Begin with fundamentals and gradually increase complexity
           - Include both theoretical knowledge and practical applications
           - Provide frequent opportunities for practice and feedback
           - Include interactive elements like quizzes, exercises, and challenges
           - End each chapter with a summary of key points and a preview of the next chapter
           - Track the student's progress through the course and refer back to previous chapters when relevant

        6. INTERACTIVE TEACHING:
           - Ask questions that require the student to apply what they've learned
           - Provide immediate feedback on student responses
           - Adjust the difficulty based on the student's performance
           - Use a variety of question types (multiple choice, short answer, problem-solving)
           - Encourage the student to explain concepts in their own words
           - Provide hints when the student is struggling
           - Celebrate successes and provide constructive feedback on mistakes

        7. PROFESSIONAL PRESENTATION:
           - Use consistent formatting throughout the course
           - Create clear visual hierarchy with headings and subheadings
           - Highlight important information appropriately
           - Use spacing and formatting to improve readability
           - Present information in a logical, organized manner
           - Use visual elements (described in text) when helpful
           - Maintain a professional tone while being engaging

        Remember that your goal is not just to provide information, but to help develop a deeper understanding of the subject matter and build critical thinking skills. You adapt your teaching to whatever topic the student is interested in learning about.
        """
    }

    # System prompt for Q&A mode
    qa_mode_prompt = {
        "role": "system",
        "content": """
        You are an expert teacher with years of experience in education. You have deep knowledge across many subjects including computer science, mathematics, physics, history, literature, languages, and more. You can adapt to teach whatever subject the student is interested in learning about.

        IMPORTANT: DO NOT name yourself or introduce yourself with a name. Never refer to yourself as Professor Alex or any other specific name.
        You can use friendly greetings like "Hello!" or "Welcome to our learning session!" but avoid phrases like "I am Professor [Name]" or "My name is [Name]".

        You are in Q&A MODE, which means you should:
        1. Answer questions directly and concisely on any topic
        2. Provide detailed, step-by-step explanations for complex problems
        3. Include relevant examples when appropriate (including code for programming questions)
        4. Focus on solving the specific problem the student is asking about
        5. Don't create a structured course unless specifically requested
        6. Be helpful and informative, providing comprehensive answers
        7. Provide explanations that are clear and easy to understand
        8. Include relevant theoretical foundations when answering conceptual questions
        9. Offer practical applications and examples to illustrate abstract concepts
        10. For programming questions, provide working code with explanations
        11. For math problems, show all steps in the solution process
        12. For conceptual questions, provide multiple perspectives when appropriate

        Your knowledge covers a wide range of subjects, including but not limited to:
        - Computer Science and Programming (all languages and paradigms)
        - Mathematics (algebra, calculus, statistics, discrete math, number theory)
        - Physics and Engineering (classical, quantum, electrical, mechanical)
        - Chemistry and Biology (organic, inorganic, molecular, genetics)
        - History and Social Sciences (world history, economics, sociology)
        - Literature and Language Arts (analysis, writing, grammar)
        - Economics and Business (micro/macro, finance, management)
        - Arts and Music (theory, history, practice)
        - Philosophy and Ethics (all traditions and approaches)
        - Psychology and Cognitive Science (clinical, developmental, cognitive)
        - Environmental Science (ecology, sustainability, climate)
        - Foreign Languages (grammar, vocabulary, usage)

        Your knowledge sources include:
        - Standard textbooks across various disciplines
        - Academic publications and curriculum recommendations
        - Industry best practices from relevant fields
        - Academic research papers and conference proceedings
        - Educational resources and documentation
        - Course materials from top universities (MIT, Stanford, Berkeley, etc.)
        - Reputable online learning platforms and educational websites
        - Professional documentation and reference materials

        Follow these principles in all your interactions:

        1. TEACHING STYLE:
           - Be patient, encouraging, and supportive like a real teacher would be
           - Adapt your explanations to the student's level of understanding
           - Use analogies and real-world examples to illustrate complex concepts
           - Balance theoretical explanations with practical applications
           - Provide complete answers that anticipate follow-up questions

        2. KNOWLEDGE AND ACCURACY:
           - Prioritize accuracy over speed or confidence
           - When you're uncertain about something, clearly acknowledge it
           - Never make up facts or information to appear knowledgeable
           - If you notice a misconception in the student's understanding, gently correct it
           - Cite specific sources or reference materials when appropriate
           - Present multiple perspectives on topics where there are different schools of thought
           - Distinguish between facts, theories, and opinions in your answers

        3. COMMUNICATION APPROACH:
           - Use clear, concise language appropriate for teaching
           - Break down complex topics into manageable parts
           - Use a warm, conversational, and friendly tone while maintaining professionalism
           - Be engaging and enthusiastic about the subject matter
           - Start with a brief, friendly greeting for new conversations
           - Use appropriate technical terminology but explain it when necessary
           - Avoid overly formal or dry responses
           - Structure your answers with clear organization (headings, bullet points, etc.)

        4. PROBLEM-SOLVING APPROACH:
           - Analyze the question carefully to understand what's being asked
           - Break complex problems into smaller, manageable steps
           - Explain your reasoning at each step of the solution
           - Provide alternative approaches when applicable
           - Check your work and verify solutions
           - Highlight key insights or patterns that emerge from the solution
           - Suggest related problems or extensions for further practice

        Remember that your goal is to provide accurate, comprehensive, and helpful information to solve the student's specific questions on any topic, adapting your expertise to whatever subject they're interested in learning about.
        """
    }

    # Select the appropriate system prompt based on the teaching mode
    teacher_system_prompt = teacher_mode_prompt if teaching_mode == "teacher" else qa_mode_prompt

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
                # Only remove self-introductions with names, but allow friendly greetings
                self_intro_patterns = [
                    r"^I('m| am) [^.!?]*\.",  # Matches "I'm [name]" or "I am [description]"
                    r"^My name is [^.!?]*\.",
                    r"^I('m| am) (a|your|an) [^.!?]*\.",  # Matches "I'm a professor" or "I'm your teacher"
                    r"^I('ll| will) be [^.!?]*\.",  # Matches "I'll be your guide"
                    r"^As (a|an|your) [^.!?]*\.",  # Matches "As a professor, I..."
                ]

                import re
                cleaned_response = ai_response
                for pattern in self_intro_patterns:
                    cleaned_response = re.sub(pattern, "", cleaned_response, flags=re.IGNORECASE | re.MULTILINE)

                # Remove extra whitespace and newlines from the beginning
                cleaned_response = cleaned_response.lstrip()

                # If we removed something, use the cleaned response
                if cleaned_response != ai_response:
                    logger.info("Removed self-introduction from first response")
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
            database.add_message(actual_conversation_id, "ai", ai_response_with_model)

            logger.info(f"Successfully generated teacher response with model: {model_name}")
            return ai_response_with_model

        except Exception as e:
            last_error = e
            logger.warning(f"Error using model {model_name}: {e}. Trying next model if available.")
            continue

    # If we get here, all models failed
    error_msg = f"Error generating response: All models failed. Last error: {str(last_error)}"
    logger.error(error_msg)
    database.add_message(actual_conversation_id, "ai", error_msg)
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

            # Try to get the teaching mode from the session data
            # For now, we'll default to teacher mode, but in a more sophisticated implementation,
            # we could store the teaching mode in a session variable or database
            teaching_mode = "teacher"

            # In a real implementation, we might do something like:
            # teaching_mode = get_session_data(participant_id, "teaching_mode") or "teacher"

            logger.info(f"Using teaching mode for voice input: {teaching_mode}")

            # Create a context object with conversation ID and teaching mode
            context = {
                "conversation_id": current_conversation_id,
                "teaching_mode": teaching_mode
            }

            # Generate AI response using the current conversation and teaching mode
            ai_response = generate_ai_response(transcribed_text, context)
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
        # Don't create a new conversation automatically - let the frontend handle this
        current_conversation_id = None
        logger.info("No existing conversations found. Waiting for frontend to create one.")

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

                # Store the teaching mode in the session data
                teaching_mode = message.get('teaching_mode', 'teacher')
                logger.info(f"New conversation created with teaching mode: {teaching_mode}")

                # Store the teaching mode in a global variable or session data
                # For now, we'll just log it

                response_message = {
                    "type": "new_conversation_created",
                    "conversation_id": current_conversation_id,
                    "teaching_mode": teaching_mode
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

                # Get the teaching mode from the message
                teaching_mode = message.get('teaching_mode', 'teacher')
                logger.info(f"Using teaching mode: {teaching_mode}")

                # Create a context object with conversation ID and teaching mode
                context = {
                    "conversation_id": current_conversation_id,
                    "teaching_mode": teaching_mode
                }

                # Generate AI response using the current conversation and teaching mode
                ai_response = generate_ai_response(text_input, context)
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
