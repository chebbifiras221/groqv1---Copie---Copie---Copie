"""
Message handlers for processing different types of client messages.
This module contains handlers for various message types to improve code organization.
"""

import json
import logging
import config
import database
import database_updates
import auth_api

logger = logging.getLogger("message-handlers")

async def handle_clear_conversations(message, ctx, current_conversation_id, safe_publish_data):
    """Handle clearing all conversations for a specific teaching mode."""
    teaching_mode = message.get('teaching_mode', config.DEFAULT_TEACHING_MODE)
    user_id = message.get('user_id')
    # Note: current_conversation_id parameter is kept for API consistency but not used in this function

    # Clear conversations for the specified teaching mode with user_id
    result = database_updates.clear_conversations_by_mode(teaching_mode, user_id)
    deleted_count = result["deleted_count"]
    new_conversation_id = result["new_conversation_id"]

    logger.info(f"Cleared {deleted_count} conversations with teaching mode: {teaching_mode} for user: {user_id}")
    logger.info(f"Created new conversation with ID: {new_conversation_id} and teaching mode: {teaching_mode}")

    # Send the response with the new conversation
    response_message = {
        "type": "all_conversations_cleared",
        "new_conversation_id": new_conversation_id,
        "teaching_mode": teaching_mode,
        "deleted_count": deleted_count
    }
    await safe_publish_data(ctx.room.local_participant, json.dumps(response_message).encode())

    # Also send updated conversation list
    try:
        conversations = database.list_conversations(limit=config.CONVERSATION_LIST_LIMIT, user_id=user_id)
        list_response = {
            "type": "conversations_list",
            "conversations": conversations
        }
        await safe_publish_data(ctx.room.local_participant, json.dumps(list_response).encode())
    except Exception as e:
        logger.error(f"Error getting conversation list after clearing: {e}")

    return new_conversation_id

async def handle_rename_conversation(message, ctx, safe_publish_data):
    """Handle renaming a conversation."""
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

async def handle_delete_conversation(message, ctx, current_conversation_id, safe_publish_data):
    """Handle deleting a conversation."""
    conversation_id = message.get('conversation_id')
    user_id = message.get('user_id')
    new_conversation_id = None

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
                    new_conversation_id = remaining_conversations[0]["id"]
                    logger.info(f"Switched to existing conversation with ID: {new_conversation_id}")
                else:
                    # Create a new conversation if none exist
                    new_conversation_id = database.create_conversation(config.DEFAULT_CONVERSATION_TITLE)
                    logger.info(f"Created new conversation with ID: {new_conversation_id}")

            # If we deleted the current conversation, create a new one
            if current_conversation_id == conversation_id:
                # Create a new conversation with default teaching mode
                new_conversation_id = database.create_conversation(
                    title=config.DEFAULT_CONVERSATION_TITLE,
                    teaching_mode=config.DEFAULT_TEACHING_MODE,
                    user_id=user_id
                )
                logger.info(f"Created new conversation with ID: {new_conversation_id}")

            response_message = {
                "type": "conversation_deleted",
                "conversation_id": conversation_id,
                "new_conversation_id": new_conversation_id
            }
            await safe_publish_data(ctx.room.local_participant, json.dumps(response_message).encode())

    return new_conversation_id

async def handle_list_conversations(message, ctx, safe_publish_data):
    """Handle listing conversations for a specific user."""
    user_id = message.get('user_id')

    # Always require user_id for data isolation
    if not user_id:
        logger.warning("List conversations request without user_id - using legacy mode")

    conversations = database.list_conversations(limit=config.CONVERSATION_LIST_LIMIT, user_id=user_id)
    response_message = {
        "type": "conversations_list",
        "conversations": conversations
    }
    await safe_publish_data(ctx.room.local_participant, json.dumps(response_message).encode())

async def handle_auth_request(message, ctx, safe_publish_data):
    """Handle authentication requests (register, login, verify, logout)."""
    auth_data = message.get('data', {})

    # Process the authentication request using the new auth_api module
    response_data, status_code = auth_api.handle_auth_request(json.dumps(auth_data).encode())

    # Create a response message with the authentication result
    response_message = {
        "type": "auth_response",
        "data": response_data,
        "status": status_code
    }

    # Send the response back to the client
    await safe_publish_data(ctx.room.local_participant, json.dumps(response_message).encode())

    # Log the authentication request (without sensitive data)
    auth_type = auth_data.get('type', 'unknown')
    username = auth_data.get('username', 'unknown')
    logger.info(f"Processed {auth_type} request for user: {username}, status: {status_code}")

    # If this was a successful login, update the current user context
    if auth_type == 'login' and response_data.get('success'):
        user_id = response_data.get('user', {}).get('id')
        if user_id:
            logger.info(f"User {username} (ID: {user_id}) logged in successfully")

            # Send the conversation list for this user
            try:
                conversations = database.list_conversations(limit=config.CONVERSATION_LIST_LIMIT, user_id=user_id)
                list_response = {
                    "type": "conversations_list",
                    "conversations": conversations
                }
                await safe_publish_data(ctx.room.local_participant, json.dumps(list_response).encode())
            except Exception as e:
                logger.error(f"Error getting conversation list after login: {e}")

    return response_data

async def handle_get_conversation(message, ctx, safe_publish_data):
    """Handle getting a specific conversation."""
    conversation_id = message.get('conversation_id')
    user_id = message.get('user_id')

    if conversation_id:
        # Get the conversation with user_id check for data isolation
        conversation = database.get_conversation(conversation_id, user_id)

        if conversation:
            response_message = {
                "type": "conversation_data",
                "conversation": conversation
            }
            await safe_publish_data(ctx.room.local_participant, json.dumps(response_message).encode())
            return conversation_id
        else:
            # Send error response if conversation not found or not accessible
            error_message = {
                "type": "error",
                "error": "conversation_not_found",
                "message": "Conversation not found or you don't have access to it"
            }
            await safe_publish_data(ctx.room.local_participant, json.dumps(error_message).encode())

    return None

async def handle_new_conversation(message, ctx, safe_publish_data, find_or_create_empty_conversation):
    """Handle creating a new conversation."""
    teaching_mode = message.get('teaching_mode', config.DEFAULT_TEACHING_MODE)
    user_id = message.get('user_id')

    # Find or create an empty conversation
    conversation_id = find_or_create_empty_conversation(teaching_mode, user_id=user_id)

    # Get the updated conversation list
    try:
        conversations = database.list_conversations(limit=config.CONVERSATION_LIST_LIMIT, user_id=user_id)
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
        "conversation_id": conversation_id,
        "teaching_mode": teaching_mode,
        "user_id": user_id
    }
    await safe_publish_data(ctx.room.local_participant, json.dumps(response_message).encode())
    return conversation_id
