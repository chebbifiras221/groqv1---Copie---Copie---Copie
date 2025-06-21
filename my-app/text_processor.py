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
    """Generate a simple fallback message when the AI response is empty."""
    return "I apologize, but I couldn't generate a proper response. Please try again with a different question or instruction."

async def handle_text_input(message, ctx, current_conversation_id, safe_publish_data,
                           find_or_create_empty_conversation, generate_ai_response,
                           synthesize_speech, send_conversation_data):
    """Handle text input messages and generate AI responses."""
    text_input = message.get('text')
    logger.info(f"Received text input: {text_input}")

    # Check if we need to create a new conversation
    if message.get('new_conversation'):
        teaching_mode = message.get('teaching_mode', config.DEFAULT_TEACHING_MODE)
        user_id = message.get('user_id')

        current_conversation_id = find_or_create_empty_conversation(teaching_mode, check_current=True, user_id=user_id)

        # Get the updated conversation list asynchronously
        try:
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

    # Get conversation history for topic validation
    conversation_history = []
    if current_conversation_id:
        try:
            conversation = await asyncio.get_event_loop().run_in_executor(
                None, lambda: database.get_conversation(current_conversation_id)
            )
            if conversation and 'messages' in conversation:
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

    # Validate topic
    is_topic_valid, _ = topic_validator.validate_question_topic(text_input, conversation_history)

    if not is_topic_valid:
        rejection_response = "I'm sorry, but I can only help with computer science, programming, and software development related questions. Please ask me about coding, algorithms, programming languages, software engineering, or other technical topics."

        rejection_message = {
            "type": "ai_response",
            "text": rejection_response,
            "conversation_id": current_conversation_id,
            "topic_rejected": True
        }
        await safe_publish_data(ctx.room.local_participant, json.dumps(rejection_message).encode())
        await synthesize_speech(rejection_response, ctx.room)
        await send_conversation_data(current_conversation_id, ctx.room.local_participant)
        return current_conversation_id

    # Generate AI response
    teaching_mode = message.get('teaching_mode', config.DEFAULT_TEACHING_MODE)
    context = {
        "conversation_id": current_conversation_id,
        "teaching_mode": teaching_mode,
        "is_hidden": is_hidden
    }

    ai_response = generate_ai_response(text_input, context)
    if not ai_response or not ai_response.strip():
        ai_response = generate_fallback_message(text_input)

    # Send AI response
    if current_conversation_id:
        response_message = {
            "type": "ai_response",
            "text": ai_response,
            "conversation_id": current_conversation_id
        }
        await safe_publish_data(ctx.room.local_participant, json.dumps(response_message).encode())
    else:
        logger.error(config.ERROR_MESSAGES["no_conversation_id"])

    await synthesize_speech(ai_response, ctx.room)
    await send_conversation_data(current_conversation_id, ctx.room.local_participant)
    return current_conversation_id
