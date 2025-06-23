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

def generate_fallback_message():
    """
    Generate a standardized fallback message when AI response generation fails or returns empty content.

    This function provides a consistent, user-friendly error message that can be displayed
    when the AI system encounters issues generating a proper response. It's designed to
    be helpful and encouraging rather than technical or alarming.

    Returns:
        str: A polite, user-friendly message explaining that the AI couldn't generate a response
             and suggesting the user try again. The message is designed to maintain a positive
             user experience even when technical issues occur.

    Example:
        >>> fallback = generate_fallback_message()
        >>> print(fallback)
        I apologize, but I couldn't generate a proper response. Please try again with a different question or instruction.
    """
    # Return a standardized, user-friendly fallback message
    # This message is designed to be polite and encouraging rather than technical
    return "I apologize, but I couldn't generate a proper response. Please try again with a different question or instruction."

async def handle_text_input(message, ctx, current_conversation_id, safe_publish_data,
                           find_or_create_empty_conversation, generate_ai_response,
                           synthesize_speech, send_conversation_data):
    """
    Handle text input messages from clients and orchestrate the complete AI response pipeline.

    This function processes user text input, manages conversation creation, validates topics,
    generates AI responses, and coordinates speech synthesis. It serves as the main entry
    point for text-based interactions in the application.

    Args:
        message (dict): The message dictionary from the client containing:
                       - 'text': The user's input text
                       - 'new_conversation': Boolean indicating if a new conversation should be created
                       - 'teaching_mode': The teaching mode for new conversations
                       - 'user_id': The ID of the user sending the message
                       - 'hidden': Boolean indicating if this is a hidden instruction
        ctx (JobContext): The LiveKit job context containing room and participant information
        current_conversation_id (str): The ID of the currently active conversation
        safe_publish_data (callable): Async function for safely publishing data to participants
        find_or_create_empty_conversation (callable): Function to find or create conversations
        generate_ai_response (callable): Function to generate AI responses
        synthesize_speech (callable): Async function for text-to-speech synthesis
        send_conversation_data (callable): Async function to send conversation data to clients

    Returns:
        str: The conversation ID that was used for this interaction. May be the same as
             the input current_conversation_id or a new one if a conversation was created.

    Raises:
        Exception: Database and network errors are caught and logged but may be re-raised
                  depending on the specific operation that failed.

    Example:
        >>> message = {"text": "What is Python?", "user_id": "user123"}
        >>> conversation_id = await handle_text_input(message, ctx, None, safe_publish_data, ...)
    """
    # Extract the user's text input from the message
    text_input = message.get('text')
    logger.info(f"Received text input: {text_input}")

    # Check if we need to create a new conversation
    # This happens when the client explicitly requests a new conversation
    if message.get('new_conversation'):
        # Get the teaching mode for the new conversation, defaulting to configured default
        teaching_mode = message.get('teaching_mode', config.DEFAULT_TEACHING_MODE)
        # Get the user ID for conversation ownership and access control
        user_id = message.get('user_id')

        # Find an existing empty conversation or create a new one
        # This implements conversation reuse logic to avoid UI clutter
        current_conversation_id = find_or_create_empty_conversation(teaching_mode, check_current=True, user_id=user_id)

        # Get the updated conversation list asynchronously to send to client
        # This ensures the UI shows the most current conversation list
        try:
            # Run the database query in a thread executor to avoid blocking the event loop
            conversations = await asyncio.get_event_loop().run_in_executor(
                None, lambda: database.list_conversations(limit=config.CONVERSATION_LIST_LIMIT, user_id=user_id)
            )
            # Create a response message with the updated conversation list
            list_response = {
                "type": "conversations_list",  # Message type for client routing
                "conversations": conversations  # List of conversation objects
            }
            # Send the conversation list to the client
            await safe_publish_data(ctx.room.local_participant, json.dumps(list_response).encode())
        except Exception as e:
            # Log any errors during conversation list retrieval
            logger.error(f"Error getting conversation list: {e}")

    # Check if this is a hidden instruction that shouldn't appear in conversation history
    # Hidden instructions are used for system commands and testing
    is_hidden = message.get('hidden', False)

    # Only echo back the user's message if it's not a hidden instruction
    # This provides immediate feedback to the user that their message was received
    if not is_hidden:
        # Create an echo message to confirm receipt of user input
        echo_message = {
            "type": "user_message_echo",  # Message type for client handling
            "text": text_input,           # The original user text
            "conversation_id": current_conversation_id  # Associated conversation
        }
        # Send the echo message to the client
        await safe_publish_data(ctx.room.local_participant, json.dumps(echo_message).encode())

    # Get conversation history for topic validation
    # This provides context to help determine if follow-up questions are related to CS topics
    conversation_history = []  # Initialize empty list for conversation context
    if current_conversation_id:
        try:
            # Retrieve conversation data asynchronously to avoid blocking the event loop
            conversation = await asyncio.get_event_loop().run_in_executor(
                None, lambda: database.get_conversation(current_conversation_id)
            )
            # Check if conversation exists and contains messages
            if conversation and 'messages' in conversation:
                # Get the last 6 messages for context (enough for meaningful validation)
                recent_messages = conversation['messages'][-6:]
                # Transform database message format to validation format
                conversation_history = [
                    {
                        'type': msg.get('type', 'user'),    # Message type (user/ai)
                        'content': msg.get('content', '')   # Message content
                    }
                    for msg in recent_messages  # Process each recent message
                ]
        except Exception as e:
            # Log warning if conversation history retrieval fails
            # Continue with empty history rather than failing the entire request
            logger.warning(f"Could not get conversation history for validation: {e}")
            conversation_history = []  # Use empty history as fallback

    # Validate topic using the topic validator with conversation context
    # This determines if the user's question is related to computer science/programming
    is_topic_valid, _ = topic_validator.validate_question_topic(text_input, conversation_history)

    # Handle topic rejection if the question is not CS/programming related
    if not is_topic_valid:
        # Create a polite but clear rejection message
        rejection_response = "I'm sorry, but I can only help with computer science, programming, and software development related questions. Please ask me about coding, algorithms, programming languages, software engineering, or other technical topics."

        # Create a structured rejection message for the client
        rejection_message = {
            "type": "ai_response",              # Message type for client routing
            "text": rejection_response,         # The rejection text to display
            "conversation_id": current_conversation_id,  # Associated conversation
            "topic_rejected": True              # Flag indicating this was a topic rejection
        }
        # Send the rejection message to the client
        await safe_publish_data(ctx.room.local_participant, json.dumps(rejection_message).encode())
        # Synthesize speech for the rejection message to provide audio feedback
        await synthesize_speech(rejection_response, ctx.room)
        # Send updated conversation data to keep UI synchronized
        await send_conversation_data(current_conversation_id, ctx.room.local_participant)
        return current_conversation_id  # Return early since topic was rejected

    # Generate AI response using the configured AI models
    # Get the teaching mode from the message, defaulting to configured default
    teaching_mode = message.get('teaching_mode', config.DEFAULT_TEACHING_MODE)
    # Create context object with all necessary information for AI response generation
    context = {
        "conversation_id": current_conversation_id,  # The conversation to add the response to
        "teaching_mode": teaching_mode,              # The teaching mode to use for response style
        "is_hidden": is_hidden                       # Whether this should be hidden from history
    }

    # Generate the AI response using the text input and context
    ai_response = generate_ai_response(text_input, context)
    # Check if the AI response is empty or just whitespace
    if not ai_response or not ai_response.strip():
        # Use fallback message if AI response generation failed
        ai_response = generate_fallback_message()

    # Send AI response to the client
    if current_conversation_id:
        # Create a structured response message for the client
        response_message = {
            "type": "ai_response",                      # Message type for client routing
            "text": ai_response,                        # The generated AI response text
            "conversation_id": current_conversation_id  # Associated conversation ID
        }
        # Send the AI response to the client
        await safe_publish_data(ctx.room.local_participant, json.dumps(response_message).encode())

        # Send updated conversation list after AI response to ensure immediate history update
        # This keeps the UI synchronized with the latest conversation state
        try:
            # Get the user ID from the original message for proper conversation filtering
            user_id = message.get('user_id')
            # Retrieve updated conversation list asynchronously
            conversations = await asyncio.get_event_loop().run_in_executor(
                None, lambda: database.list_conversations(limit=config.CONVERSATION_LIST_LIMIT, user_id=user_id)
            )
            # Create response message with updated conversation list
            list_response = {
                "type": "conversations_list",  # Message type for client routing
                "conversations": conversations  # Updated list of conversations
            }
            # Send the updated conversation list to the client
            await safe_publish_data(ctx.room.local_participant, json.dumps(list_response).encode())
        except Exception as e:
            # Log any errors during conversation list update
            logger.error(f"Error getting conversation list after AI response: {e}")
    else:
        # Log error if no valid conversation ID is available
        logger.error(config.ERROR_MESSAGES["no_conversation_id"])

    # Synthesize speech for the AI response to provide audio feedback
    await synthesize_speech(ai_response, ctx.room)
    # Send updated conversation data to ensure UI is fully synchronized
    await send_conversation_data(current_conversation_id, ctx.room.local_participant)
    return current_conversation_id  # Return the conversation ID that was used
