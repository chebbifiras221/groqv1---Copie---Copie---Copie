"""
Text input processing module.
This module handles text input processing and AI response generation.
"""

import json
import logging
import asyncio
import config
import database
import topic_validator

logger = logging.getLogger("text-processor")

def generate_fallback_message(_input_text):
    """
    Generate a simple fallback message when the AI response is empty.

    Args:
        _input_text: The user's input text (unused but kept for API compatibility)

    Returns:
        str: A simple fallback message
    """
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

    # TOPIC VALIDATION: Check if question is CS/programming related
    logger.info("🔍 Validating question topic...")

    # Get conversation history for context validation
    conversation_history = []
    if current_conversation_id:
        try:
            # Get recent messages from database for context
            conversation = await asyncio.get_event_loop().run_in_executor(
                None, lambda: database.get_conversation(current_conversation_id)
            )
            if conversation and 'messages' in conversation:
                # Get last 6 messages for context (3 user + 3 AI messages)
                recent_messages = conversation['messages'][-6:]
                conversation_history = [
                    {
                        'type': msg.get('type', 'user'),
                        'content': msg.get('content', '')
                    }
                    for msg in recent_messages
                ]
        except Exception as e:
            logger.warning(f"Could not get conversation history for validation: {e}")
            conversation_history = []

    # Validate with conversation context
    is_topic_valid, validation_reason = topic_validator.validate_question_topic(text_input, conversation_history)

    if not is_topic_valid:
        logger.info(f"❌ Topic validation failed: {validation_reason}")

        # Send rejection message
        rejection_response = "I'm sorry, but I can only help with computer science, programming, and software development related questions. Please ask me about coding, algorithms, programming languages, software engineering, or other technical topics."

        rejection_message = {
            "type": "ai_response",
            "text": rejection_response,
            "conversation_id": current_conversation_id,
            "topic_rejected": True
        }
        await safe_publish_data(ctx.room.local_participant, json.dumps(rejection_message).encode())

        # Synthesize speech for the rejection
        await synthesize_speech(rejection_response, ctx.room)

        # Send updated conversation data
        await send_conversation_data(current_conversation_id, ctx.room.local_participant)

        return current_conversation_id

    logger.info(f"✅ Topic validation passed: {validation_reason}")

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
