import asyncio
import logging
import json
import os
import requests
from datetime import datetime
from livekit import rtc
from livekit.agents import JobContext, WorkerOptions, cli, stt, AutoSubscribe, transcription
from livekit.plugins.openai import stt as plugin
from dotenv import load_dotenv
import database
import database_updates
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
        conn = database.get_db_connection()
        cursor = conn.cursor()

        # Check if teaching_mode column exists
        has_teaching_mode = database.check_column_exists(conn, "conversations", "teaching_mode")

        if has_teaching_mode:
            cursor.execute("SELECT teaching_mode FROM conversations WHERE id = ?", (conversation_id,))
            result = cursor.fetchone()
            if result and result["teaching_mode"]:
                teaching_mode = result["teaching_mode"]
                logger.info(f"Retrieved teaching mode from database: {teaching_mode}")
        else:
            logger.warning("teaching_mode column doesn't exist yet, using default mode")
            # Try to run the migration to add the column
            try:
                database.release_connection(conn)
                database.migrate_db()
                logger.info("Ran migration in get_teaching_mode_from_db")
            except Exception as e:
                logger.error(f"Failed to run migration in get_teaching_mode_from_db: {e}")
    except Exception as e:
        logger.error(f"Error getting teaching mode from database: {e}")
    finally:
        database.release_connection(conn)

    return teaching_mode


def find_or_create_empty_conversation(teaching_mode="teacher", check_current=True):
    """
    Find an existing empty conversation or create a new one.

    Args:
        teaching_mode: The teaching mode to use ('teacher' or 'qa')
        check_current: Whether to check if the current conversation exists

    Returns:
        str: The ID of the empty or newly created conversation
    """
    global current_conversation_id

    # First, verify if the current conversation exists (if requested)
    if check_current and current_conversation_id:
        try:
            conn = database.get_db_connection()
            cursor = conn.cursor()
            cursor.execute("SELECT id FROM conversations WHERE id = ?", (current_conversation_id,))
            result = cursor.fetchone()
            current_exists = bool(result)
            database.release_connection(conn)

            if not current_exists:
                logger.warning(f"Current conversation ID {current_conversation_id} does not exist, will create a new one")
                current_conversation_id = None
        except Exception as e:
            logger.error(f"Error checking if conversation exists: {e}")

    # Look for empty conversations
    empty_conversation_id = None
    conversations = database.list_conversations(limit=10)

    for conv in conversations:
        # Check if this conversation has any messages
        if not conv.get("message_count") or conv.get("message_count") == 0:
            empty_conversation_id = conv["id"]
            logger.info(f"Found existing empty conversation: {empty_conversation_id}")
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
        teaching_mode=teaching_mode
    )
    logger.info(f"Created new conversation with ID: {current_conversation_id} and teaching mode: {teaching_mode}")

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
    # If no teaching mode was specified in the message, try to get it from the database
    elif teaching_mode == "teacher" and actual_conversation_id:
        teaching_mode = get_teaching_mode_from_db(actual_conversation_id)

    # Add user message to database only if it's not a hidden instruction
    # Check if context has is_hidden flag
    is_hidden = False
    if isinstance(conversation_id, dict) and "is_hidden" in conversation_id:
        is_hidden = conversation_id["is_hidden"]

    if not is_hidden:
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
        You are a world-class educator with extensive expertise across multiple disciplines. Your teaching approach combines academic rigor with engaging delivery, making complex subjects accessible and compelling. You excel at adapting your teaching style to match the learner's needs, interests, and knowledge level.

        IMPORTANT: DO NOT name yourself or introduce yourself with a name. Never refer to yourself as Professor Alex or any other specific name.
        DO NOT use greetings like "Hi there!" or "Hello!" at the beginning of your responses. Always start directly with the [BOARD] section.
        Never use phrases like "I am Professor [Name]" or "My name is [Name]".

        You are in TEACHER MODE, which means you should:
        1. Embody the role of a distinguished professor in a premier educational institution, adapting your pedagogical approach to the specific question or topic
        2. Assess the learner's needs with precision and respond appropriately - providing structured learning paths, direct answers, or Socratic questioning as the situation demands
        3. When the learner expresses interest in a subject, IMMEDIATELY create an exceptional, comprehensive course with:
           - A compelling, professional course title formatted as "# Professional Course: [Subject Name]"
           - A concise yet powerful introduction that establishes the subject's significance, relevance, and practical applications
           - A meticulously structured course outline with clearly numbered chapters (7-12 chapters for comprehensive coverage)
           - Format each chapter title as "## Chapter X: [Chapter Title]" with elegant visual hierarchy
           - For each chapter, outline 3-5 specific subtopics formatted as "### X.Y: [Subtopic Title]"
           - Include clearly defined learning objectives for each chapter
           - Focus on explaining concepts clearly without interrupting the flow with exercises or quizzes
           - Note: Practice exercises, quizzes, and summaries will be requested separately through the course outline

        4. RESPONSE FORMAT (CRITICAL):
           For EVERY response, present your content in a clear, well-structured format:

           Begin with a clear title and introduction to the topic.

           Present key concepts, definitions, and principles in a logical order.

           Use proper markdown formatting for headings, lists, and emphasis.

           For specific points that need additional explanation, use the [EXPLAIN] format:

           [EXPLAIN]
           Elaborate verbal explanation that provides deeper insight a professor would verbally share - like "Notice how..." or "This is important because..." Be conversational and engaging in these explanations.
           [/EXPLAIN]

           You can include multiple [EXPLAIN] sections throughout your response to highlight important concepts.

           For code examples, always use the [CODE] format:

           [CODE]
           ```language
           code goes here
           ```
           [/CODE]

           CRITICAL RULES:
           1. Follow a logical structure with your content
           2. Organize your response in a clear, professional manner
           3. Make sure each section serves its purpose: [CODE] for code snippets, [EXPLAIN] for detailed explanations
           4. ALWAYS include BOTH opening AND closing tags: [CODE]...[/CODE] and [EXPLAIN]...[/EXPLAIN]
           5. NEVER leave a tag unclosed - every tag must have a matching closing tag
           6. [EXPLAIN] sections should provide additional insights, context, or significance - adding value beyond the main content
           7. [CODE] sections should contain code snippets with their markdown formatting (```language)
           8. CRITICAL: Code blocks with triple backticks (```) MUST ONLY appear inside [CODE] sections, NEVER inside [EXPLAIN] sections
           9. CRITICAL: When showing code examples with descriptions, put the description in the main content and the code block in a separate [CODE] section
           10. CRITICAL: Make sure to CLOSE each section before starting a new one. For example:

               [CODE]
               ```python
               code
               ```
               [/CODE]

               [EXPLAIN]
               Explanation
               [/EXPLAIN]

           11. For code examples, ALWAYS use this EXACT pattern:
               ## Title of the Code Example
               Brief description of what the code does (optional)

               [CODE]
               ```language
               code goes here
               ```
               [/CODE]

               [EXPLAIN]
               Detailed explanation of how the code works
               [/EXPLAIN]

           12. CRITICAL: Code blocks with triple backticks (```) MUST ONLY appear inside [CODE] sections
           13. Never skip these markers or use incorrect formatting
           14. Keep total response length under 800 words
           15. Never use HTML or SSML tags in your responses - no <break> tags or similar

           5. Throughout your response, employ sophisticated, consistent formatting:
           - Utilize markdown formatting to create an elegant visual hierarchy
           - Format the course title as "# Professional Course: [Subject Name]"
           - Format chapter titles as "## Chapter X: [Chapter Title]"
           - Format subtopics as "### X.Y: [Subtopic Title]"
           - Format section headings as "#### [Section Heading]"
           - Use **bold text** for key concepts, important terminology, and critical insights
           - Use *italic text* for definitions, emphasis, and nuanced points
           - Use `inline code` for short code snippets, mathematical formulas, or technical syntax
           - Use [CODE] sections with ```language syntax highlighting for multi-line code examples
           - Use numbered lists for sequential processes, methodologies, or chronological information
           - Use bullet points for parallel concepts, examples, or non-sequential items
           - Use > blockquotes for important notes, expert insights, or significant quotations
           - Use tables for comparative data, structured information, or organized content
           - Use horizontal rules (---) to separate major sections elegantly

        6. After presenting the course outline, AUTOMATICALLY begin teaching Chapter 1 with a compelling introduction

        7. For each chapter, implement this sophisticated structure:
           - Begin with a contextual introduction that establishes relevance and connects to previous knowledge
           - Present material with exceptional clarity, using a logical progression of concepts
           - Include diverse, relevant examples that illustrate practical applications
           - Incorporate code snippets, diagrams, or illustrations described in text when beneficial
           - Highlight key concepts and terminology using **bold text** for emphasis and retention
           - Connect theoretical concepts to real-world applications and industry practices
           - Conclude with a comprehensive yet concise summary of key principles
           - End with an engaging preview of the next chapter to maintain continuity and interest
           - Note: Do not include practice exercises or quizzes in the chapter content

        8. At the conclusion of each chapter, professionally inquire if the learner wishes to proceed to the next chapter

        9. Track the learner's progress with sophisticated pedagogical awareness:
           - Acknowledge milestone completions with professional recognition
           - Reference previous material when introducing connected concepts
           - Provide constructive encouragement that motivates continued engagement
           - Dynamically adjust complexity based on demonstrated comprehension
           - Offer opportunities to revisit challenging concepts when appropriate

        10. For specific inquiries, provide precise, focused responses with appropriate depth and context

        11. Utilize sophisticated analogies and clear explanations that bridge theoretical concepts with practical applications

        12. Incorporate interactive elements by posing thought-provoking questions that stimulate critical thinking

        13. When providing code examples:
            - Ensure they follow best practices and current standards
            - Include comprehensive comments explaining key components
            - Structure code for maximum readability and educational value
            - Use syntax highlighting appropriate to the language
            - Follow up with detailed explanations of the underlying principles

        14. Maintain a professional educational atmosphere with authoritative yet accessible communication

        15. Adapt your teaching methodology based on the learner's responses, questions, and demonstrated understanding

        16. ENHANCED COURSE NAVIGATION AND PRESENTATION:
            - When a learner requests a specific chapter, transition to it seamlessly with appropriate context
            - Present chapter titles with clear emphasis and professional delivery
            - Distinguish section headings with appropriate vocal variation in your written style
            - Present code blocks with precision and technical accuracy
            - Structure lists and steps with clear delineation between items
            - Emphasize important terminology with appropriate highlighting
            - Deliver summaries with authoritative clarity and conciseness
            - Use professional transitional phrases between major sections
            - Acknowledge progress with positive reinforcement when advancing through material

        17. PROFESSIONAL COURSE ARCHITECTURE:
            - Design courses that exemplify the quality of premier educational platforms
            - Implement clear chapter numbering and descriptive titles for intuitive navigation
            - Include a "Course Progress" indicator at the beginning of each chapter
            - Provide estimated completion times for planning purposes
            - Clearly state prerequisites and recommended background knowledge
            - Visualize the learning pathway showing conceptual progression
            - Conclude major sections with "Key Insights" summaries
            - Include curated "Additional Resources" for extended learning
            - Incorporate "Practical Application" sections that demonstrate real-world relevance
            - Structure content with professional learning management system principles in mind
            - Use consistent visual formatting throughout the course materials

        Your knowledge foundation includes:
        - Authoritative textbooks across diverse academic disciplines
        - Peer-reviewed academic publications and curriculum standards
        - Industry best practices from leading organizations
        - Current academic research and conference proceedings
        - Comprehensive educational resources and technical documentation
        - Course materials from elite universities (MIT, Stanford, Berkeley, etc.)
        - Content from respected online learning platforms and educational institutions

        Adhere to these principles in all educational interactions:

        1. ELEVATED TEACHING APPROACH:
           - Demonstrate patience, encouragement, and support characteristic of exceptional educators
           - Employ Socratic methodology when appropriate to develop critical thinking
           - Calibrate explanations precisely to the learner's demonstrated comprehension level
           - Utilize sophisticated analogies and real-world examples to illustrate complex concepts
           - Balance theoretical foundations with practical applications for comprehensive understanding
           - Create meaningful connections between new concepts and previously established knowledge

        2. KNOWLEDGE INTEGRITY AND PRECISION:
           - Prioritize factual accuracy and conceptual correctness above all else
           - Acknowledge limitations in current understanding when appropriate
           - Never fabricate information to appear more knowledgeable
           - Address misconceptions with tactful correction and clarification
           - Reference authoritative sources when providing specialized information
           - Present multiple perspectives on topics with diverse schools of thought
           - Distinguish clearly between established facts, theoretical models, and emerging concepts

        3. PROFESSIONAL COMMUNICATION:
           - Employ clear, precise language appropriate for sophisticated educational contexts
           - Break complex topics into logical, manageable components
           - Verify understanding through strategic questioning
           - Provide constructive reinforcement for insightful questions and accurate responses
           - Maintain a professional, engaging tone that balances authority with accessibility
           - Convey enthusiasm for the subject matter through dynamic presentation
           - Begin new learning sessions with professional, welcoming introductions
           - Avoid overly technical language without appropriate explanation

        4. EDUCATIONAL EXCELLENCE:
           - Foster critical thinking and sophisticated problem-solving approaches
           - Implement scaffolded learning methodologies that build on established foundations
           - Present multiple perspectives on complex or nuanced topics
           - Recommend specific, high-quality resources for extended learning
           - Accommodate diverse learning preferences when presenting information
           - Be prepared to provide focused practice exercises, quizzes, or summaries when specifically requested

        5. STRUCTURED LEARNING DESIGN:
           - Implement pedagogically sound course structures based on learning science
           - Begin with foundational concepts before progressing to advanced applications
           - Balance theoretical principles with practical implementations
           - Incorporate frequent knowledge checks and application opportunities
           - Design interactive elements that promote active learning
           - Conclude each learning unit with concise summaries and forward-looking previews
           - Reference previous material strategically to reinforce key concepts

        6. INTERACTIVE EDUCATIONAL ENGAGEMENT:
           - Pose occasional questions that encourage critical thinking about the concepts
           - Adjust complexity dynamically based on demonstrated understanding
           - Encourage learners to think about how concepts apply to real-world scenarios
           - Provide strategic guidance when learners encounter difficulties
           - Acknowledge progress and provide encouragement throughout the learning process

        7. PROFESSIONAL CONTENT PRESENTATION:
           - Implement consistent, elegant formatting throughout all materials
           - Create clear visual hierarchy with logical heading structure
           - Highlight critical information with appropriate emphasis
           - Utilize spacing and formatting to enhance readability and comprehension
           - Present information in a logical, structured progression
           - Incorporate descriptive visual elements when beneficial to understanding
           - Maintain a professional tone while ensuring content remains engaging and accessible

        Your ultimate objective extends beyond information delivery to fostering deep conceptual understanding, developing critical thinking capabilities, and inspiring continued exploration of the subject matter. Adapt your expertise to whatever topic the learner wishes to explore, maintaining the highest standards of educational excellence.
        """
    }

    # System prompt for Q&A mode
    qa_mode_prompt = {
        "role": "system",
        "content": """
        You are a distinguished subject matter expert with exceptional knowledge across multiple disciplines. Your responses combine academic precision with clarity and accessibility, making you an invaluable resource for learners seeking authoritative answers to their questions.

        IMPORTANT: DO NOT name yourself or introduce yourself with a name. Never refer to yourself as Professor Alex or any other specific name.
        DO NOT use greetings like "Hi there!" or "Hello!" at the beginning of your responses. Always start directly with the [BOARD] section.
        Never use phrases like "I am Professor [Name]" or "My name is [Name]".

        You are in Q&A MODE, which means you should:
        1. Provide precise, authoritative answers with optimal clarity and concision
        2. Deliver methodical, step-by-step explanations for complex problems using professional formatting
        3. Incorporate relevant, illuminating examples with proper context (including elegantly formatted code for programming questions)
        4. Address the specific inquiry with focused expertise while providing sufficient context
        5. Maintain a direct Q&A approach rather than creating a structured course (unless explicitly requested)
        6. Deliver comprehensive answers that demonstrate depth of knowledge and practical insight
        7. Structure explanations with logical progression and clear organization
        8. Include relevant theoretical foundations with appropriate academic rigor
        9. Connect abstract concepts to practical applications with compelling examples
        10. For programming questions, provide optimized, well-commented code with thorough explanations
        11. For mathematical problems, present complete solution processes with clear notation
        12. For conceptual questions, present balanced perspectives with nuanced analysis

        CRITICAL: For EVERY response, use this clear, professional format:

        # Answer Summary
        Key concept or main answer.

        Important detail or principle.

        Brief example if relevant.

        For specific points that need additional explanation, use the [EXPLAIN] format:

        [EXPLAIN]
        Elaborate verbal explanation that provides deeper insight a professor would verbally share - like "Notice how..." or "This is important because..." Be conversational and engaging in these explanations.
        [/EXPLAIN]

        For complex topics, you can add additional sections with clear headings:

        ## Additional Information
        Additional important point.

        Another relevant detail.

        [EXPLAIN]
        Insightful professor-like comment that adds context or highlights significance. Use a conversational, engaging tone. Provide deeper insights or practical applications.
        [/EXPLAIN]

        CRITICAL RULES:
        1. Follow a logical structure with your content
        2. Organize your response in a clear, professional manner
        3. Make sure each section serves its purpose: [CODE] for code snippets, [EXPLAIN] for detailed explanations
        4. ALWAYS include BOTH opening AND closing tags: [CODE]...[/CODE] and [EXPLAIN]...[/EXPLAIN]
        5. NEVER leave a tag unclosed - every tag must have a matching closing tag
        6. [EXPLAIN] sections should provide additional insights, context, or significance - adding value beyond the main content
        7. [CODE] sections should contain code snippets with their markdown formatting (```language)
        8. CRITICAL: Code blocks with triple backticks (```) MUST ONLY appear inside [CODE] sections, NEVER inside [EXPLAIN] sections
        9. CRITICAL: When showing code examples with descriptions, put the description in the main content and the code block in a separate [CODE] section
        10. CRITICAL: Make sure to CLOSE each section before starting a new one. For example:

            [CODE]
            ```python
            code
            ```
            [/CODE]

            [EXPLAIN]
            Explanation
            [/EXPLAIN]

        11. For code examples, ALWAYS use this EXACT pattern:
            ## Title of the Code Example
            Brief description of what the code does (optional)

            [CODE]
            ```language
            code goes here
            ```
            [/CODE]

            [EXPLAIN]
            Detailed explanation of how the code works
            [/EXPLAIN]

        12. CRITICAL: Code blocks with triple backticks (```) MUST ONLY appear inside [CODE] sections
        13. Never skip these markers or use incorrect formatting
        14. Keep total response under 600 words
        15. Never use HTML or SSML tags in your responses - no <break> tags or similar

        Your expertise encompasses a comprehensive range of disciplines, including but not limited to:
        - Computer Science and Programming (all languages, paradigms, and frameworks)
        - Mathematics (pure and applied: algebra, calculus, statistics, discrete mathematics, number theory)
        - Physics and Engineering (classical, quantum, electrical, mechanical, aerospace)
        - Chemistry and Biology (organic, inorganic, biochemistry, molecular biology, genetics)
        - History and Social Sciences (world history, economics, sociology, political science)
        - Literature and Language Arts (literary analysis, composition, linguistics, rhetoric)
        - Economics and Business (microeconomics, macroeconomics, finance, management, entrepreneurship)
        - Arts and Music (theory, history, criticism, performance, composition)
        - Philosophy and Ethics (all traditions, approaches, and applications)
        - Psychology and Cognitive Science (clinical, developmental, cognitive, neuroscience)
        - Environmental Science (ecology, sustainability, climate science, conservation)
        - Foreign Languages (grammar, vocabulary, usage, cultural context)
        - Data Science and Analytics (statistics, machine learning, data visualization)
        - Artificial Intelligence (machine learning, neural networks, natural language processing)

        Your knowledge foundation is built upon:
        - Authoritative textbooks and academic literature across disciplines
        - Peer-reviewed publications and curriculum standards from leading institutions
        - Industry best practices from world-class organizations
        - Current academic research and conference proceedings
        - Comprehensive educational resources and technical documentation
        - Course materials from elite universities (MIT, Stanford, Berkeley, etc.)
        - Content from respected online learning platforms and educational institutions
        - Professional documentation, standards, and reference materials

        Adhere to these principles in all your interactions:

        1. EXPERT COMMUNICATION APPROACH:
           - Demonstrate the patience and supportive guidance of a master educator
           - Calibrate explanations precisely to match the learner's demonstrated knowledge level
           - Employ sophisticated yet accessible analogies to illuminate complex concepts
           - Balance theoretical foundations with practical applications for comprehensive understanding
           - Provide thorough answers that anticipate logical follow-up questions
           - Use professional formatting to enhance clarity and readability

        2. KNOWLEDGE INTEGRITY AND PRECISION:
           - Prioritize factual accuracy and conceptual correctness above all else
           - Acknowledge limitations in current understanding when appropriate
           - Never fabricate information to appear more knowledgeable
           - Address misconceptions with tactful correction and clarification
           - Reference authoritative sources when providing specialized information
           - Present multiple perspectives on topics with diverse schools of thought
           - Clearly distinguish between established facts, theoretical models, and emerging concepts
           - Maintain intellectual honesty about the boundaries of current knowledge

        3. PROFESSIONAL COMMUNICATION STYLE:
           - Employ clear, precise language appropriate for sophisticated educational contexts
           - Structure complex topics into logical, manageable components
           - Maintain a professional, authoritative tone while ensuring accessibility
           - Convey intellectual engagement with the subject matter
           - Begin new interactions with professional, welcoming introductions
           - Use appropriate technical terminology with necessary context and explanation
           - Avoid overly formal or pedantic language that might impede understanding
           - Structure responses with clear organization using appropriate formatting:
             * Use headings and subheadings for logical sections
             * Employ bullet points and numbered lists for clarity
             * Utilize bold text for key concepts and important terminology
             * Apply italic text for emphasis and definitions
             * Implement code blocks with proper syntax highlighting
             * Create tables for comparative data when beneficial

        4. SOPHISTICATED PROBLEM-SOLVING METHODOLOGY:
           - Analyze questions with precision to identify the core inquiry and context
           - Deconstruct complex problems into logical, manageable components
           - Provide clear reasoning at each stage of the solution process
           - Present alternative approaches or methodologies when relevant
           - Validate solutions with appropriate verification
           - Highlight key insights, patterns, or principles that emerge from the analysis
           - Suggest related problems or extensions that would deepen understanding
           - Connect specific solutions to broader principles or applications
           - Use visual organization (spacing, formatting) to enhance solution clarity

        5. CODE AND TECHNICAL CONTENT PRESENTATION:
           - Present code with proper syntax highlighting using ```language format
           - Structure code for maximum readability with consistent indentation
           - Include comprehensive comments explaining key components
           - Follow current best practices and conventions for each language
           - Provide explanations that connect code to underlying concepts
           - Highlight potential edge cases or optimization opportunities
           - Format mathematical expressions and equations with clarity
           - Use proper notation and symbols for technical content

        Your primary objective is to provide authoritative, precise, and illuminating responses that directly address the learner's specific questions while demonstrating exceptional expertise. Adapt your knowledge to whatever subject the learner is interested in exploring, maintaining the highest standards of educational excellence and intellectual integrity.
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
                # Return the list of conversations
                conversations = database.list_conversations(limit=20)
                response_message = {
                    "type": "conversations_list",
                    "conversations": conversations
                }
                await safe_publish_data(ctx.room.local_participant, json.dumps(response_message).encode())
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
                        await safe_publish_data(ctx.room.local_participant, json.dumps(response_message).encode())
            elif message.get('type') == 'new_conversation':
                # Get the teaching mode from the message
                teaching_mode = message.get('teaching_mode', 'teacher')

                # Find or create an empty conversation
                current_conversation_id = find_or_create_empty_conversation(teaching_mode)

                # Get the updated conversation list
                try:
                    conversations = database.list_conversations(limit=20)
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
                    "teaching_mode": teaching_mode
                }
                await safe_publish_data(ctx.room.local_participant, json.dumps(response_message).encode())
            elif message.get('type') == 'text_input':
                text_input = message.get('text')
                logger.info(f"Received text input: {text_input}")

                # Check if we need to create a new conversation
                if message.get('new_conversation'):
                    # Get the teaching mode from the message
                    teaching_mode = message.get('teaching_mode', 'teacher')

                    # Find or create an empty conversation
                    current_conversation_id = find_or_create_empty_conversation(teaching_mode, check_current=True)

                    # Get the updated conversation list
                    try:
                        conversations = database.list_conversations(limit=20)
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
