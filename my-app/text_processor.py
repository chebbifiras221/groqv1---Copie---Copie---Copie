"""
Text input processing module.
This module handles text input processing and AI response generation.
"""

import json
import logging
import asyncio
import config
import database

logger = logging.getLogger("text-processor")

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

async def handle_text_input(message, ctx, current_conversation_id, safe_publish_data,
                           find_or_create_empty_conversation, generate_ai_response,
                           synthesize_speech, send_conversation_data):
    """Handle text input messages and generate AI responses."""
    text_input = message.get('text')
    logger.info(f"Received text input: {text_input}")

    # Check if we need to create a new conversation
    if message.get('new_conversation'):
        # Get the teaching mode from the message
        teaching_mode = message.get('teaching_mode', config.DEFAULT_TEACHING_MODE)
        user_id = message.get('user_id')

        # Log the user ID for debugging
        logger.info(f"Creating new conversation for user: {user_id}")

        # Find or create an empty conversation
        current_conversation_id = find_or_create_empty_conversation(teaching_mode, check_current=True, user_id=user_id)

        # Get the updated conversation list asynchronously
        try:
            # Run database operation in thread pool to avoid blocking
            conversations = await asyncio.get_event_loop().run_in_executor(
                None, lambda: database.list_conversations(limit=config.CONVERSATION_LIST_LIMIT, user_id=user_id)
            )
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
    teaching_mode = message.get('teaching_mode', config.DEFAULT_TEACHING_MODE)
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

    # Send the response as a single message (multi-part processing disabled)
    if current_conversation_id:
        # Send AI response as a single message
        response_message = {
            "type": "ai_response",
            "text": ai_response,
            "conversation_id": current_conversation_id
        }
        await safe_publish_data(ctx.room.local_participant, json.dumps(response_message).encode())
    elif not current_conversation_id:
        # Log an error if we don't have a valid conversation ID
        logger.error(config.ERROR_MESSAGES["no_conversation_id"])

    # Synthesize speech from the AI response
    await synthesize_speech(ai_response, ctx.room)

    # Send updated conversation data to ensure UI is in sync
    await send_conversation_data(current_conversation_id, ctx.room.local_participant)

    return current_conversation_id
