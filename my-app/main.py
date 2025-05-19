import asyncio
import logging
import json
import os
import requests
from livekit import rtc
from livekit.agents import JobContext, WorkerOptions, cli, stt, AutoSubscribe, transcription
from livekit.plugins.openai import stt as plugin
from dotenv import load_dotenv
import database
import database_updates
import auth
from tts_web import WebTTS

# Import silero conditionally to avoid unused import
from livekit.plugins import silero

load_dotenv(dotenv_path=".env.local")

logger = logging.getLogger("groq-whisper-stt-transcriber")

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"
# TTS provider will be configured later

# Initialize the database and run migrations
database.init_db()

# Run database migrations separately to ensure they're applied
# This is a safeguard in case the migrations in init_db didn't run
try:
    database.migrate_db()
    logger.info("Database migrations completed successfully")
except Exception as e:
    logger.error(f"Error running database migrations: {e}")

# Current conversation ID
current_conversation_id = None

# Initialize TTS engine
tts_engine = None

# Maximum message length for splitting long responses
MAX_MESSAGE_LENGTH = 4000


def get_teaching_mode_from_db(conversation_id):
    """
    Get the teaching mode for a conversation from the database.

    Args:
        conversation_id: The ID of the conversation

    Returns:
        str: The teaching mode ('teacher' or 'qa'), defaults to 'teacher' if not found
    """
    teaching_mode = "teacher"  # Default to teacher mode

    if not conversation_id:
        return teaching_mode

    try:
        # Get the conversation from the database
        conversation = database.get_conversation(conversation_id)

        # If the conversation exists and has a teaching_mode, use it
        if conversation and "teaching_mode" in conversation and conversation["teaching_mode"]:
            teaching_mode = conversation["teaching_mode"]
            logger.info(f"Retrieved teaching mode from database: {teaching_mode}")
        else:
            logger.warning(f"No teaching mode found for conversation {conversation_id}, using default mode")

            # Try to run the migration to add the column if needed
            try:
                database.migrate_db()
                logger.info("Ran migration in get_teaching_mode_from_db")
            except Exception as e:
                logger.error(f"Failed to run migration in get_teaching_mode_from_db: {e}")
    except Exception as e:
        logger.error(f"Error getting teaching mode from database: {e}")

    return teaching_mode


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
            # Get the conversation from the database
            conversation = database.get_conversation(current_conversation_id)

            # If the conversation doesn't exist, reset current_conversation_id
            if not conversation:
                logger.warning(f"Current conversation ID {current_conversation_id} does not exist, will create a new one")
                current_conversation_id = None
        except Exception as e:
            logger.error(f"Error checking if conversation exists: {e}")

    # Look for empty conversations for this user
    empty_conversation_id = None
    conversations = database.list_conversations(limit=10, user_id=user_id)

    for conv in conversations:
        # Check if this conversation has any messages
        if not conv.get("message_count") or conv.get("message_count") == 0:
            empty_conversation_id = conv["id"]
            logger.info(f"Found existing empty conversation: {empty_conversation_id} for user: {user_id}")
            break

    # If we found an empty conversation, use it
    if empty_conversation_id:
        current_conversation_id = empty_conversation_id
        logger.info(f"Using existing empty conversation: {current_conversation_id}")

        # Update the conversation with the new teaching mode
        try:
            database.reuse_empty_conversation(
                conversation_id=current_conversation_id,
                teaching_mode=teaching_mode
            )
            logger.info(f"Updated empty conversation with teaching mode: {teaching_mode}")
            return current_conversation_id
        except Exception as e:
            logger.error(f"Error reusing empty conversation: {e}")

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


def generate_fallback_message(input_text):
    """
    Generate a fallback message when the AI response is empty.

    Args:
        input_text: The user's input text

    Returns:
        str: A fallback message based on the input
    """
    # Check if this is a course outline section request
    if "learning objectives" in input_text.lower():
        return "Here are the Learning Objectives for this chapter:\n\n• Understand the key concepts covered in this chapter\n• Learn how to apply these concepts in practical situations\n• Develop skills to solve problems related to this topic\n• Build a foundation for more advanced topics in future chapters"
    elif "practice exercises" in input_text.lower():
        return "Here are some Practice Exercises for this chapter:\n\n**Exercise 1: Basic Application**\n• Try implementing the concepts from this chapter in a simple program\n• Start with the examples provided and modify them to solve a similar problem\n\n**Exercise 2: Problem Solving**\n• Apply what you've learned to solve a more complex problem\n• Break down the problem into smaller steps and tackle each one using the techniques from this chapter"
    elif "quiz" in input_text.lower():
        return "Let's test your knowledge with a quiz on this chapter:\n\n1. What is the main purpose of the concepts covered in this chapter?\n   a) To improve code efficiency\n   b) To enhance code readability\n   c) To organize code better\n   d) All of the above\n\n2. When would you typically use these techniques?\n   a) For small projects only\n   b) For large projects only\n   c) For any project where they provide value\n   d) Only when required by specifications\n\nAnswers: 1-d, 2-c"
    elif "summary" in input_text.lower():
        return "**Summary of this chapter:**\n\n• We covered the fundamental concepts and their importance in programming\n• We explored practical applications and common use cases\n• We examined best practices and how to avoid common pitfalls\n• We connected these ideas to the broader context of software development"
    else:
        return "I apologize, but I couldn't generate a proper response. Please try again with a different question or instruction."


async def process_multi_part_messages(ai_response, conversation_id, participant):
    """
    Process long AI responses by splitting them into multiple parts and sending them.

    Args:
        ai_response: The full AI response text
        conversation_id: The ID of the current conversation
        participant: The participant to send the messages to

    Returns:
        bool: True if multi-part messages were processed, False otherwise
    """
    # Initialize multi_part_messages to an empty list by default
    multi_part_messages = []

    # Check if the response is long enough to need splitting and we have a valid conversation ID
    if len(ai_response) <= MAX_MESSAGE_LENGTH or not conversation_id:
        return False

    try:
        # Get the most recent messages from the database
        recent_messages = database.get_messages(conversation_id)
        recent_ai_messages = [msg for msg in recent_messages if msg["type"] == "ai"]

        # Estimate how many parts this response was split into
        estimated_parts = (len(ai_response) // MAX_MESSAGE_LENGTH) + 1

        # Take the most recent N messages where N is our estimated number of parts
        chunk_messages = recent_ai_messages[-estimated_parts:] if estimated_parts <= len(recent_ai_messages) else []

        # Create metadata for each chunk
        total_chunks = len(chunk_messages)
        for i, msg in enumerate(chunk_messages):
            part_number = i + 1
            is_final = (i == total_chunks - 1)

            multi_part_messages.append({
                "content": msg["content"],
                "part": part_number,
                "total_parts": total_chunks,
                "is_final": is_final
            })

        logger.info(f"Created {len(multi_part_messages)} multi-part messages")
    except Exception as e:
        # Log any errors but continue with empty multi_part_messages
        logger.error(f"Error processing multi-part messages: {e}")
        multi_part_messages = []

    # If we found multi-part messages, send them individually
    if multi_part_messages:
        # Sort by part number to ensure correct order
        multi_part_messages.sort(key=lambda x: x["part"])

        for part in multi_part_messages:
            # Send each part as a separate message
            message = {
                "type": "ai_response",
                "text": part["content"],
                "conversation_id": conversation_id,
                "is_part": True,
                "part_number": part["part"],
                "total_parts": part["total_parts"],
                "is_final": part["is_final"]
            }

            # Use our safe publish method with retry logic
            await safe_publish_data(participant, json.dumps(message).encode())

            # Add a small delay between parts to ensure they're received in order
            await asyncio.sleep(0.1)

        return True

    return False


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
        await safe_publish_data(room.local_participant, json.dumps(tts_start_message).encode())

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


def extract_conversation_context(conversation_id):
    """
    Extract conversation context from the conversation_id parameter.

    Args:
        conversation_id: Can be a string ID or a dictionary with context

    Returns:
        Tuple of (actual_conversation_id, teaching_mode, is_hidden)
    """
    # Default values
    actual_conversation_id = conversation_id
    teaching_mode = "teacher"
    is_hidden = False

    # Check if conversation_id is a dictionary with additional context
    if isinstance(conversation_id, dict):
        # Extract teaching mode if provided
        if "teaching_mode" in conversation_id:
            teaching_mode = conversation_id["teaching_mode"]

        # Extract actual conversation ID
        if "conversation_id" in conversation_id:
            actual_conversation_id = conversation_id["conversation_id"]

        # Check if this is a hidden instruction
        if "is_hidden" in conversation_id:
            is_hidden = conversation_id["is_hidden"]

    # If no teaching mode was specified in the message, try to get it from the database
    elif teaching_mode == "teacher" and actual_conversation_id:
        teaching_mode = get_teaching_mode_from_db(actual_conversation_id)

    return actual_conversation_id, teaching_mode, is_hidden

def prepare_conversation_history(messages, teaching_mode):
    """
    Prepare conversation history for the AI model.

    Args:
        messages: List of message objects from the database
        teaching_mode: The teaching mode to use ('teacher' or 'qa')

    Returns:
        List of message objects formatted for the Groq API
    """
    # System prompt for structured teaching mode
    teacher_mode_prompt = {
        "role": "system",
        "content": """
        You are a world-class educator with extensive expertise in computer science and programming. Combine academic rigor with engaging delivery to make complex subjects accessible. Embody a tenured professor with decades of industry and academic experience.

        IMPORTANT: DO NOT name yourself or introduce yourself with a name. Never refer to yourself as Professor Alex or any other specific name.
        DO NOT use greetings like "Hi there!" or "Hello!" at the beginning of your responses.
        Never use phrases like "I am Professor [Name]" or "My name is [Name]".

        In TEACHER MODE:
        1. Adapt your pedagogical approach to each question or topic
        2. Use scholarly language that conveys expertise without excessive formality
        3. Assess learner needs precisely, providing structured learning paths, direct answers, or Socratic questioning
        4. Include relevant examples with proper context and well-formatted code
        5. When a learner expresses interest in a subject, create a comprehensive course with:
           - Title formatted as "# Course: [Subject Name]"
           - Introduction establishing significance, relevance, and applications
           - A meticulously structured outline with 7-12 clearly numbered chapters
           - Chapter titles formatted as "## Chapter X: [Chapter Title]"
           - 3-5 specific subtopics per chapter formatted as "### X.Y: [Subtopic Title]"
           - Clearly defined learning objectives at the beginning of each chapter
           - Clear learning objectives that outline specific skills and knowledge students will gain

        When teaching programming concepts, always follow each new piece of information with a brief explanation. After introducing any concept, fact, or code example (even if just one line), immediately add a concise explanation using the [EXPLAIN][/EXPLAIN] format. These explanations should be shorter than the information they clarify and should provide context, reasoning, or practical insights.

        For example:
        1. Present information: "Variables in Python are dynamically typed."
        2. Follow with: "[EXPLAIN]This means you don't need to declare variable types explicitly, allowing for more flexible code writing but requiring careful attention to avoid type-related bugs.[/EXPLAIN]"

        This pattern of information followed by explanation creates a rhythm that reinforces learning and ensures students understand not just what something is, but why it matters.

        Use these professorial language patterns:
        - "Let's consider this from first principles..." or "A critical insight here is..."
        - "When we examine this algorithm, we notice..."
        - "What might happen if we altered this parameter?"
        - "In my years of teaching this concept, students often..."
        - "While the theoretical foundation is important, the practical implementation reveals..."

        Structure explanations with:
        1. Conceptual overview establishing the "big picture"
        2. Detailed explanation with appropriate technical depth
        3. Concrete examples, suitable metaphors, and code demonstrations
        4. Connections to broader contexts and applications

        For programming topics:
        - Explain jargon when introduced
        - Emphasize both how and why code works
        - Highlight design patterns and architectural considerations
        - Discuss performance implications and optimization opportunities
        - Address common misconceptions and debugging strategies
        - Connect concepts to industry best practices

        When creating educational content, employ sophisticated, consistent formatting throughout your responses:
        - Use markdown formatting to create a clear visual hierarchy
        - Format the course title as "# Course: [Subject Name]"
        - Format chapter titles as "## Chapter X: [Chapter Title]"
        - Format subtopics as "### X.Y: [Subtopic Title]"
        - Format section headings as "#### [Section Heading]"
        - Use **bold text** for key concepts, important terminology, and critical insights
        - Use *italic text* for definitions, emphasis, and nuanced points
        - Use numbered lists for sequential processes, methodologies, or chronological information
        - Use > blockquotes for important notes, expert insights, or significant quotations
        - Use tables for comparative data, structured information, or organized content
        - Use horizontal rules (---) to separate major sections elegantly

        At the conclusion of each chapter, professionally ask if the learner wishes to proceed to the next chapter with a question such as: "Would you like to continue to Chapter X+1, or would you prefer to explore a specific aspect of this chapter in more detail?"

        When beginning a new course, after presenting the outline, ask if the learner would like to begin with Chapter 1 or if they prefer to jump to a specific chapter of interest.

        When creating a course outline, ALWAYS include a dedicated "## Course Outline" section after the introduction that lists all chapters with their numbers and titles. This section is critical for the frontend to properly parse and display the course structure.

        For code examples, use triple backticks with the appropriate language identifier:

        ```python
        # Example code
        x = 10
        print(x)
        ```

        IMPORTANT: Never place [EXPLAIN] tags inside code blocks. Always place code examples within triple backticks, and then add explanations after the code block using [EXPLAIN][/EXPLAIN] tags.
        """
    }

    # System prompt for Q&A mode
    qa_mode_prompt = {
        "role": "system",
        "content": """
        You are a distinguished subject matter expert with exceptional knowledge across multiple disciplines. Your responses combine academic precision with clarity and accessibility, making you an invaluable resource for learners seeking authoritative answers.

        In Q&A MODE:
        1. Provide precise, authoritative answers with optimal clarity and concision
        2. Deliver methodical, step-by-step explanations for complex problems
        3. Incorporate relevant examples with proper context (including well-formatted code)
        4. Address specific inquiries with focused expertise while providing sufficient context
        5. Maintain a direct Q&A approach rather than creating structured courses
        6. Deliver comprehensive answers that demonstrate depth of knowledge
        7. Structure explanations with logical progression and clear organization

        When explaining programming concepts, always follow each new piece of information with a brief explanation. After introducing any concept, fact, or code example (even if just one line), immediately add a concise explanation using the [EXPLAIN][/EXPLAIN] format. These explanations should be shorter than the information they clarify and should provide context, reasoning, or practical insights.

        For example:
        1. Present information: "Variables in Python are dynamically typed."
        2. Follow with: "[EXPLAIN]This means you don't need to declare variable types explicitly, allowing for more flexible code writing but requiring careful attention to avoid type-related bugs.[/EXPLAIN]"

        This pattern of information followed by explanation creates a rhythm that reinforces learning and ensures students understand not just what something is, but why it matters.

        For programming questions:
        - Begin with a direct answer to the specific question
        - Provide necessary context and background information
        - Include well-commented code examples that demonstrate the solution
        - Explain both the how and why behind the solution
        - Address potential edge cases or alternative approaches
        - Highlight best practices and common pitfalls
        - Connect the solution to broader programming principles

        Structure your responses:
        1. Direct answer to the question
        2. Brief explanation of relevant concepts
        3. Practical examples or code demonstrations
        4. Additional context or considerations when appropriate

        IMPORTANT: DO NOT name yourself or introduce yourself with a name. Never refer to yourself as Professor or any specific name. DO NOT use greetings at the beginning of your responses. Never use phrases like "I am Professor [Name]" or "My name is [Name]".

        For code examples, use triple backticks with the appropriate language identifier:

        ```python
        # Example code
        x = 10
        print(x)
        ```

        IMPORTANT: Never place [EXPLAIN] tags inside code blocks. Always place code examples within triple backticks, and then add explanations after the code block using [EXPLAIN][/EXPLAIN] tags.
        """
    }

    # Select the appropriate system prompt based on the teaching mode
    system_prompt = teacher_mode_prompt if teaching_mode == "teacher" else qa_mode_prompt

    # Start with the system message
    conversation_history = [system_prompt]

    # Add the conversation history
    for msg in messages:
        role = "user" if msg["type"] == "user" else "assistant"
        conversation_history.append({"role": role, "content": msg["content"]})

    # Keep only the last 15 messages to avoid token limits, but always keep the system prompt
    if len(conversation_history) > 16:  # 15 messages + 1 system prompt
        conversation_history = [conversation_history[0]] + conversation_history[-15:]

    return conversation_history

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

    # Extract conversation context
    actual_conversation_id, teaching_mode, is_hidden = extract_conversation_context(conversation_id)

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
    conversation_history = prepare_conversation_history(conversation["messages"], teaching_mode)

    # teaching_mode is already determined above when we extracted the conversation_id

    # We've already prepared the conversation history in the prepare_conversation_history function

    headers = {
        "Authorization": f"Bearer {GROQ_API_KEY}",
        "Content-Type": "application/json"
    }

    # Only use the 70B model for best results
    models_to_try = [
        {"name": "llama-3.3-70b-versatile", "temperature": 0.6},  # First choice: Llama 3.3 70B (most powerful)
        {"name": "llama3-70b-8192", "temperature": 0.6}       # Backup: Llama3 70B
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
            is_first_message = len([msg for msg in conversation["messages"] if msg["type"] == "ai"]) == 0

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

            # Check if the response is too long and needs to be split
            # Use the global MAX_MESSAGE_LENGTH constant

            if len(ai_response_with_model) > MAX_MESSAGE_LENGTH:
                logger.info(f"Response is long ({len(ai_response_with_model)} chars), splitting into multiple messages")

                # Split the response into chunks of approximately MAX_MESSAGE_LENGTH
                # Try to split at paragraph boundaries for more natural breaks
                chunks = []
                remaining = ai_response_with_model

                while remaining:
                    # If remaining text is shorter than max length, use it all
                    if len(remaining) <= MAX_MESSAGE_LENGTH:
                        chunks.append(remaining)
                        break

                    # Try to find a paragraph break near the max length
                    split_point = remaining[:MAX_MESSAGE_LENGTH].rfind('\n\n')

                    # If no paragraph break found, try a single newline
                    if split_point == -1:
                        split_point = remaining[:MAX_MESSAGE_LENGTH].rfind('\n')

                    # If still no newline found, try a sentence end
                    if split_point == -1:
                        for end_char in ['. ', '! ', '? ']:
                            potential_split = remaining[:MAX_MESSAGE_LENGTH].rfind(end_char)
                            if potential_split != -1:
                                split_point = potential_split + 1  # Include the period and space
                                break

                    # If all else fails, just split at the max length
                    if split_point == -1:
                        split_point = MAX_MESSAGE_LENGTH

                    # Add the chunk and continue with the remaining text
                    chunks.append(remaining[:split_point])
                    remaining = remaining[split_point:].lstrip()

                # Add each chunk as a separate message to the database
                # We'll store them as regular messages, not as JSON
                total_chunks = len(chunks)

                for i, chunk in enumerate(chunks):
                    # Store each chunk as a regular message
                    # We'll add the metadata when sending to the client
                    database.add_message(actual_conversation_id, "ai", chunk)

                    # Log the chunk storage
                    logger.info(f"Stored chunk {i+1}/{total_chunks} of length {len(chunk)}")

                logger.info(f"Successfully split and stored response in {total_chunks} parts")

                # Return the full response for TTS purposes
                return ai_response_with_model
            else:
                # For normal-sized responses, just add to database as before
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

            # Get the teaching mode from the database for the current conversation
            teaching_mode = get_teaching_mode_from_db(current_conversation_id)
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

            # Process multi-part messages if needed
            multi_part_processed = await process_multi_part_messages(ai_response, current_conversation_id, room.local_participant)

            # If multi-part messages weren't processed, send the response as a single message
            if not multi_part_processed and current_conversation_id:
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
                logger.error("Cannot send AI response: No valid conversation ID")

            # Synthesize speech from the AI response
            await synthesize_speech(ai_response, room)

            # Send updated conversation data to ensure UI is in sync
            await send_conversation_data(current_conversation_id, room.local_participant)

        elif ev.type == stt.SpeechEventType.RECOGNITION_USAGE:
            logger.debug(f"metrics: {ev.recognition_usage}")

        stt_forwarder.update(ev)


async def safe_publish_data(participant, data, max_retries=3, retry_delay=0.5):
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
            vad=silero.VAD.load(
                min_silence_duration=1.0,  # Increased from 0.2 to allow for natural pauses in speech
                min_speech_duration=0.1,   # Minimum duration to consider as speech
                prefix_padding_duration=0.5  # Add padding to the beginning of speech segments
            ),
        )

    if not stt_impl.capabilities.streaming:
        # wrap with a stream adapter to use streaming semantics
        stt_impl = stt.StreamAdapter(
            stt=stt_impl,
            vad=silero.VAD.load(
                min_silence_duration=1.0,  # Increased from 0.2 to allow for natural pauses in speech
                min_speech_duration=0.1,   # Minimum duration to consider as speech
                prefix_padding_duration=0.5  # Add padding to the beginning of speech segments
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
                # Get the teaching mode from the message
                teaching_mode = message.get('teaching_mode', 'teacher')

                # Clear conversations for the specified teaching mode
                result = database_updates.clear_conversations_by_mode(teaching_mode)
                deleted_count = result["deleted_count"]
                current_conversation_id = result["new_conversation_id"]

                logger.info(f"Cleared {deleted_count} conversations with teaching mode: {teaching_mode}")
                logger.info(f"Created new conversation with ID: {current_conversation_id} and teaching mode: {teaching_mode}")

                response_message = {
                    "type": "all_conversations_cleared",
                    "new_conversation_id": current_conversation_id,
                    "teaching_mode": teaching_mode,
                    "deleted_count": deleted_count
                }
                await safe_publish_data(ctx.room.local_participant, json.dumps(response_message).encode())
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
                        await safe_publish_data(ctx.room.local_participant, json.dumps(response_message).encode())
            elif message.get('type') == 'delete_conversation':
                # Delete a conversation
                conversation_id = message.get('conversation_id')
                user_id = message.get('user_id')

                if conversation_id:
                    # Pass user_id for data isolation
                    success = database.delete_conversation(conversation_id, user_id)

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
                                current_conversation_id = database.create_conversation("New Conversation")
                                logger.info(f"Created new conversation with ID: {current_conversation_id}")

                        # If we deleted the current conversation, we need to send the new conversation ID
                        # Otherwise, we don't need to send a new conversation ID
                        new_conversation_id = None
                        if current_conversation_id == conversation_id:
                            # The current conversation is the one we just deleted
                            # We need to create or find a new one
                            # Get remaining conversations with the current teaching mode
                            teaching_mode = None
                            try:
                                # Try to get the teaching mode from the deleted conversation
                                conn = database.get_db_connection()
                                cursor = conn.cursor()
                                cursor.execute(
                                    "SELECT teaching_mode FROM conversations WHERE id = ?",
                                    (conversation_id,)
                                )
                                result = cursor.fetchone()
                                if result:
                                    teaching_mode = result['teaching_mode']
                            except Exception as e:
                                logger.error(f"Error getting teaching mode: {e}")
                            finally:
                                database.release_connection(conn)

                            # Create a new conversation with the same teaching mode
                            current_conversation_id = database.create_conversation(
                                title="New Conversation",
                                teaching_mode=teaching_mode
                            )
                            new_conversation_id = current_conversation_id
                            logger.info(f"Created new conversation with ID: {new_conversation_id} and teaching mode: {teaching_mode}")

                        response_message = {
                            "type": "conversation_deleted",
                            "conversation_id": conversation_id,
                            "new_conversation_id": new_conversation_id
                        }
                        await safe_publish_data(ctx.room.local_participant, json.dumps(response_message).encode())
            elif message.get('type') == 'list_conversations':
                # Return the list of conversations for a specific user
                user_id = message.get('user_id')
                conversations = database.list_conversations(limit=20, user_id=user_id)
                response_message = {
                    "type": "conversations_list",
                    "conversations": conversations
                }
                await safe_publish_data(ctx.room.local_participant, json.dumps(response_message).encode())
            elif message.get('type') == 'register_user':
                # Register a new user
                username = message.get('username')
                password = message.get('password')
                email = message.get('email')

                if username and password:
                    success, msg, user_data = auth.register_user(username, password, email)

                    response_message = {
                        "type": "register_response",
                        "success": success,
                        "message": msg
                    }

                    if success and user_data:
                        # Don't include sensitive data in the response
                        response_message["user"] = {
                            "id": user_data["id"],
                            "username": user_data["username"],
                            "email": user_data.get("email")
                        }

                    await safe_publish_data(ctx.room.local_participant, json.dumps(response_message).encode())
                else:
                    error_message = {
                        "type": "register_response",
                        "success": False,
                        "message": "Username and password are required"
                    }
                    await safe_publish_data(ctx.room.local_participant, json.dumps(error_message).encode())
            elif message.get('type') == 'login_user':
                # Login a user
                username = message.get('username')
                password = message.get('password')

                if username and password:
                    success, token, user_data = auth.login_user(username, password)

                    response_message = {
                        "type": "login_response",
                        "success": success,
                        "message": token if success else token  # Token or error message
                    }

                    if success and user_data:
                        # Don't include sensitive data in the response
                        response_message["user"] = {
                            "id": user_data["id"],
                            "username": user_data["username"],
                            "email": user_data.get("email")
                        }
                        response_message["token"] = token

                    await safe_publish_data(ctx.room.local_participant, json.dumps(response_message).encode())
                else:
                    error_message = {
                        "type": "login_response",
                        "success": False,
                        "message": "Username and password are required"
                    }
                    await safe_publish_data(ctx.room.local_participant, json.dumps(error_message).encode())
            elif message.get('type') == 'verify_token':
                # Verify a token
                token = message.get('token')

                if token:
                    success, user_data = auth.verify_token(token)

                    response_message = {
                        "type": "token_verification",
                        "success": success
                    }

                    if success and user_data:
                        # Don't include sensitive data in the response
                        response_message["user"] = {
                            "id": user_data["id"],
                            "username": user_data["username"],
                            "email": user_data.get("email")
                        }

                    await safe_publish_data(ctx.room.local_participant, json.dumps(response_message).encode())
                else:
                    error_message = {
                        "type": "token_verification",
                        "success": False,
                        "message": "Token is required"
                    }
                    await safe_publish_data(ctx.room.local_participant, json.dumps(error_message).encode())
            elif message.get('type') == 'get_conversation':
                # Return a specific conversation
                conversation_id = message.get('conversation_id')
                user_id = message.get('user_id')

                if conversation_id:
                    # Get the conversation with user_id check for data isolation
                    conversation = database.get_conversation(conversation_id, user_id)

                    if conversation:
                        # Set this as the current conversation
                        current_conversation_id = conversation_id

                        response_message = {
                            "type": "conversation_data",
                            "conversation": conversation
                        }
                        await safe_publish_data(ctx.room.local_participant, json.dumps(response_message).encode())
                    else:
                        # Send error response if conversation not found or not accessible
                        error_message = {
                            "type": "error",
                            "error": "conversation_not_found",
                            "message": "Conversation not found or you don't have access to it"
                        }
                        await safe_publish_data(ctx.room.local_participant, json.dumps(error_message).encode())
            elif message.get('type') == 'new_conversation':
                # Get the teaching mode from the message
                teaching_mode = message.get('teaching_mode', 'teacher')
                user_id = message.get('user_id')

                # Find or create an empty conversation
                current_conversation_id = find_or_create_empty_conversation(teaching_mode, user_id=user_id)

                # Get the updated conversation list
                try:
                    conversations = database.list_conversations(limit=20, user_id=user_id)
                    list_response = {
                        "type": "conversations_list",
                        "conversations": conversations
                    }
                    await safe_publish_data(ctx.room.local_participant, json.dumps(list_response).encode())
                except Exception as e:
                    logger.error(f"Error getting conversation list: {e}")

                # Send the new conversation created response
                response_message = {
                    "type": "new_conversation_created",
                    "conversation_id": current_conversation_id,
                    "teaching_mode": teaching_mode,
                    "user_id": user_id
                }
                await safe_publish_data(ctx.room.local_participant, json.dumps(response_message).encode())
            elif message.get('type') == 'text_input':
                text_input = message.get('text')
                logger.info(f"Received text input: {text_input}")

                # Check if we need to create a new conversation
                if message.get('new_conversation'):
                    # Get the teaching mode from the message
                    teaching_mode = message.get('teaching_mode', 'teacher')
                    user_id = message.get('user_id')

                    # Log the user ID for debugging
                    logger.info(f"Creating new conversation for user: {user_id}")

                    # Find or create an empty conversation
                    current_conversation_id = find_or_create_empty_conversation(teaching_mode, check_current=True, user_id=user_id)

                    # Get the updated conversation list
                    try:
                        # Always filter by user_id for data isolation
                        conversations = database.list_conversations(limit=20, user_id=user_id)
                        list_response = {
                            "type": "conversations_list",
                            "conversations": conversations
                        }
                        await safe_publish_data(ctx.room.local_participant, json.dumps(list_response).encode())
                    except Exception as e:
                        logger.error(f"Error getting conversation list: {e}")

                # Check if this is a hidden instruction
                is_hidden = message.get('hidden', False)

                # Only echo back the user's message if it's not a hidden instruction
                if not is_hidden:
                    echo_message = {
                        "type": "user_message_echo",
                        "text": text_input,
                        "conversation_id": current_conversation_id
                    }
                    await safe_publish_data(ctx.room.local_participant, json.dumps(echo_message).encode())

                # Get the teaching mode from the message
                teaching_mode = message.get('teaching_mode', 'teacher')
                logger.info(f"Using teaching mode: {teaching_mode}")

                # Create a context object with conversation ID, teaching mode, and hidden flag
                context = {
                    "conversation_id": current_conversation_id,
                    "teaching_mode": teaching_mode,
                    "is_hidden": is_hidden
                }

                # Generate AI response using the current conversation and teaching mode
                ai_response = generate_ai_response(text_input, context)

                # Check if the response is empty or just whitespace
                if not ai_response or not ai_response.strip():
                    logger.warning("Received empty AI response, using fallback message")
                    ai_response = generate_fallback_message(text_input)

                logger.info(f"AI Response to text input: {ai_response}")

                # Process multi-part messages if needed
                multi_part_processed = await process_multi_part_messages(ai_response, current_conversation_id, ctx.room.local_participant)

                # If multi-part messages weren't processed, send the response as a single message
                if not multi_part_processed and current_conversation_id:
                    # Send AI response as a single message
                    response_message = {
                        "type": "ai_response",
                        "text": ai_response,
                        "conversation_id": current_conversation_id
                    }
                    await safe_publish_data(ctx.room.local_participant, json.dumps(response_message).encode())
                elif not current_conversation_id:
                    # Log an error if we don't have a valid conversation ID
                    logger.error("Cannot send AI response: No valid conversation ID")

                # Synthesize speech from the AI response
                await synthesize_speech(ai_response, ctx.room)

                # Send updated conversation data to ensure UI is in sync
                await send_conversation_data(current_conversation_id, ctx.room.local_participant)
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
