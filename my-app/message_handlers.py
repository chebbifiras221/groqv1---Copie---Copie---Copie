"""
Message handlers for processing different types of client messages.
"""

import json
import logging
import config
import database
import auth_api

logger = logging.getLogger("message-handlers")

async def handle_clear_conversations(message, ctx, current_conversation_id, safe_publish_data):
    """
    Handle clearing all conversations for a specific teaching mode and user.
    Args:
        message (dict): Client message containing 'teaching_mode' and 'user_id' fields
        ctx (JobContext): LiveKit job context for room communication
        current_conversation_id (str): The currently active conversation ID (may be deleted)
        safe_publish_data (callable): Function for reliable data transmission to client
    """
    # Extract teaching mode from message, defaulting to configured default
    teaching_mode = message.get('teaching_mode', config.DEFAULT_TEACHING_MODE)
    # Extract user ID for data isolation and access control
    user_id = message.get('user_id')

    # Clear conversations for the specified teaching mode with user_id
    # This database operation deletes matching conversations and creates a new one
    result = database.clear_conversations_by_mode(teaching_mode, user_id)
    # Extract the number of conversations that were deleted
    deleted_count = result["deleted_count"]
    # Extract the ID of the newly created conversation
    new_conversation_id = result["new_conversation_id"]

    # Log the clearing operation for monitoring and debugging
    logger.info(f"Cleared {deleted_count} conversations with teaching mode: {teaching_mode} for user: {user_id}")

    # Send the response with the new conversation information to the client
    # Create structured response message for client consumption
    response_message = {
        "type": "all_conversations_cleared",    # Message type for client routing
        "new_conversation_id": new_conversation_id,  # ID of the replacement conversation
        "teaching_mode": teaching_mode,         # The teaching mode that was cleared
        "deleted_count": deleted_count          # Number of conversations that were deleted
    }
    # Send the response message to the client using safe transmission
    await safe_publish_data(ctx.room.local_participant, json.dumps(response_message).encode())

    # Also send updated conversation list to refresh the client UI
    try:
        # Retrieve the updated list of conversations for this user
        conversations = database.list_conversations(limit=config.CONVERSATION_LIST_LIMIT, user_id=user_id)
        # Create response message with the updated conversation list
        list_response = {
            "type": "conversations_list",  # Message type for client list handling
            "conversations": conversations  # Updated list of conversations
        }
        # Send the updated conversation list to the client
        await safe_publish_data(ctx.room.local_participant, json.dumps(list_response).encode())
    except Exception as e:
        # Log any errors during conversation list retrieval
        logger.error(f"Error getting conversation list after clearing: {e}")

    # Return the new conversation ID for the caller to update their state
    return new_conversation_id

async def handle_rename_conversation(message, ctx, safe_publish_data):
    """
    Handle renaming a conversation with a new user-provided title.
    """
    # Extract the conversation ID to be renamed
    conversation_id = message.get('conversation_id')
    # Extract the new title for the conversation
    new_title = message.get('title')
    # Extract user ID for conversation list filtering
    user_id = message.get('user_id')

    # Validate that we have both required fields before proceeding
    if conversation_id and new_title:
        # Attempt to update the conversation title in the database
        success = database.update_conversation_title(conversation_id, new_title)

        # Check if the database update was successful
        if success:
            # Create response message to confirm the rename operation
            response_message = {
                "type": "conversation_renamed",  # Message type for client rename handling
                "conversation_id": conversation_id,  # ID of the conversation that was renamed
                "title": new_title               # The new title that was applied
            }
            # Send the rename confirmation to the client
            await safe_publish_data(ctx.room.local_participant, json.dumps(response_message).encode())

            # Send updated conversation list immediately after rename
            try:
                # Retrieve the updated conversation list for this user
                conversations = database.list_conversations(limit=config.CONVERSATION_LIST_LIMIT, user_id=user_id)
                # Create response message with the updated conversation list
                list_response = {
                    "type": "conversations_list",  # Message type for client list handling
                    "conversations": conversations  # Updated list with new title
                }
                # Send the updated conversation list to the client
                await safe_publish_data(ctx.room.local_participant, json.dumps(list_response).encode())
            except Exception as e:
                # Log any errors during conversation list retrieval
                logger.error(f"Error getting conversation list after rename: {e}")

async def handle_delete_conversation(message, ctx, current_conversation_id, safe_publish_data):
    """
    Handle deleting a specific conversation and managing the current conversation state.
    """
    # Extract the conversation ID to be deleted
    conversation_id = message.get('conversation_id')
    # Extract user ID for access control and data isolation
    user_id = message.get('user_id')
    # Initialize variable to track if a new conversation was created
    new_conversation_id = None

    # Validate that we have a conversation ID to delete
    if conversation_id:
        # Pass user_id for data isolation - users can only delete their own conversations
        success = database.delete_conversation(conversation_id, user_id)

        # Check if the deletion was successful
        if success:
            # If we deleted the current conversation, create a new one
            if current_conversation_id == conversation_id:
                # Create a new conversation with default settings to replace the deleted one
                new_conversation_id = database.create_conversation(
                    title=config.DEFAULT_CONVERSATION_TITLE,  # Default title for new conversation
                    teaching_mode=config.DEFAULT_TEACHING_MODE,  # Default teaching mode
                    user_id=user_id                          # Associate with the same user
                )
                # Log the creation of the replacement conversation
                logger.info(f"Created new conversation with ID: {new_conversation_id}")

            # Create response message to confirm the deletion operation
            response_message = {
                "type": "conversation_deleted",      # Message type for client deletion handling
                "conversation_id": conversation_id,  # ID of the conversation that was deleted
                "new_conversation_id": new_conversation_id  # ID of replacement conversation (if any)
            }
            # Send the deletion confirmation to the client
            await safe_publish_data(ctx.room.local_participant, json.dumps(response_message).encode())

            # Send updated conversation list immediately after deletion
            try:
                # Retrieve the updated conversation list for this user
                conversations = database.list_conversations(limit=config.CONVERSATION_LIST_LIMIT, user_id=user_id)
                # Create response message with the updated conversation list
                list_response = {
                    "type": "conversations_list",  # Message type for client list handling
                    "conversations": conversations  # Updated list without the deleted conversation
                }
                # Send the updated conversation list to the client
                await safe_publish_data(ctx.room.local_participant, json.dumps(list_response).encode())
            except Exception as e:
                # Log any errors during conversation list retrieval
                logger.error(f"Error getting conversation list after deletion: {e}")

    # Return the new conversation ID (if created) for the caller to update their state
    return new_conversation_id

async def handle_list_conversations(message, ctx, safe_publish_data):
    """
    Handle listing conversations for a specific user with proper data isolation.
    """
    # Extract user ID for conversation filtering and data isolation
    user_id = message.get('user_id')

    # Log warning if no user ID provided (legacy mode or missing authentication)
    if not user_id:
        logger.warning("List conversations request without user_id - using legacy mode")

    # Retrieve conversations from database with user filtering
    # If user_id is None, this will return conversations without user association 
    conversations = database.list_conversations(limit=config.CONVERSATION_LIST_LIMIT, user_id=user_id)

    # Create response message with the conversation list
    response_message = {
        "type": "conversations_list",  # Message type for client list handling
        "conversations": conversations  # List of conversation objects for this user
    }
    # Send the conversation list to the client
    await safe_publish_data(ctx.room.local_participant, json.dumps(response_message).encode())

async def handle_auth_request(message, ctx, safe_publish_data):
    """
    Handle authentication requests including register, login, verify, and logout operations.
    """
    # Extract authentication data from the message
    auth_data = message.get('data', {})

    # Process the authentication request using the new auth_api module
    # Convert auth_data to JSON bytes as expected by the auth_api
    response_data, status_code = auth_api.handle_auth_request(json.dumps(auth_data).encode())

    # Create a response message with the authentication result
    response_message = {
        "type": "auth_response",  # Message type for client authentication handling
        "data": response_data,    # Authentication result data (success, user info, errors)
        "status": status_code     # HTTP status code indicating success or failure type
    }

    # Send the response back to the client
    await safe_publish_data(ctx.room.local_participant, json.dumps(response_message).encode())

    # If this was a successful login, send the conversation list to initialize the session
    if (auth_data.get('type') == 'login' and response_data.get('success') and
        response_data.get('user', {}).get('id')):
        # Extract the user ID from the successful login response
        user_id = response_data['user']['id']
        try:
            # Retrieve the conversation list for the newly logged-in user
            conversations = database.list_conversations(limit=config.CONVERSATION_LIST_LIMIT, user_id=user_id)
            # Create response message with the user's conversation list
            list_response = {
                "type": "conversations_list",  # Message type for client list handling
                "conversations": conversations  # User's conversations for session initialization
            }
            # Send the conversation list to initialize the user's session
            await safe_publish_data(ctx.room.local_participant, json.dumps(list_response).encode())
        except Exception as e:
            # Log any errors during conversation list retrieval after login
            logger.error(f"Error getting conversation list after login: {e}")

    # Return the authentication response data for use by calling functions
    return response_data

async def handle_get_conversation(message, ctx, safe_publish_data):
    """
    Handle retrieving and sending a specific conversation to the client.
    """
    # Extract the conversation ID to retrieve
    conversation_id = message.get('conversation_id')
    # Extract user ID for access control and data isolation
    user_id = message.get('user_id')

    # Validate that we have a conversation ID to look up
    if conversation_id:
        # Get the conversation with user_id check for data isolation. can only access conversations they own
        conversation = database.get_conversation(conversation_id, user_id)

        # Check if the conversation was found and is accessible
        if conversation:
            # Create response message with the conversation data
            response_message = {
                "type": "conversation_data",  # Message type for client conversation handling
                "conversation": conversation  # Complete conversation object with messages
            }
            # Send the conversation data to the client
            await safe_publish_data(ctx.room.local_participant, json.dumps(response_message).encode())
            # Return the conversation ID to indicate successful retrieval
            return conversation_id
        else:
            # Send error response if conversation not found or not accessible
            error_message = {
                "type": "error",                           # Message type for client error handling
                "error": "conversation_not_found",        # Error code for client logic
                "message": "Conversation not found or you don't have access to it"  # User-friendly message
            }
            # Send the error message to the client
            await safe_publish_data(ctx.room.local_participant, json.dumps(error_message).encode())

    # Return None to indicate no conversation was retrieved
    return None

async def handle_new_conversation(message, ctx, safe_publish_data, find_or_create_empty_conversation):
    """
    Handle creating a new conversation with specified teaching mode and user association.
    """
    # Extract teaching mode from message, defaulting to configured default
    teaching_mode = message.get('teaching_mode', config.DEFAULT_TEACHING_MODE)
    # Extract user ID for conversation ownership and access control
    user_id = message.get('user_id')

    # Find or create an empty conversation using the conversation management function
    conversation_id = find_or_create_empty_conversation(teaching_mode, user_id=user_id)

    # Send the new conversation created response first
    response_message = {
        "type": "new_conversation_created",  # Message type for client new conversation handling
        "conversation_id": conversation_id,  # ID of the conversation that was created/found
        "teaching_mode": teaching_mode,      # The teaching mode for this conversation
        "user_id": user_id                   # The user who owns this conversation
    }
    # Send the new conversation confirmation to the client
    await safe_publish_data(ctx.room.local_participant, json.dumps(response_message).encode())

    #  send the updated conversation list to refresh the client UI
    try:
        # Retrieve the updated conversation list for this user
        conversations = database.list_conversations(limit=config.CONVERSATION_LIST_LIMIT, user_id=user_id)
        # Create response message with the updated conversation list
        list_response = {
            "type": "conversations_list",  # Message type for client list handling
            "conversations": conversations  # Updated list including the new conversation
        }
        # Send the updated conversation list to the client
        await safe_publish_data(ctx.room.local_participant, json.dumps(list_response).encode())
    except Exception as e:
        # Log any errors during conversation list retrieval
        logger.error(f"Error getting conversation list: {e}")

    # Return the conversation ID for the caller to update their state
    return conversation_id
