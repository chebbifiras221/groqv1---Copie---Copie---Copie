"""
Database updates for mode-specific conversation management.
This module provides functions for managing conversations by teaching mode.
"""

import logging
import uuid
from typing import Dict, Any, List, Optional
from datetime import datetime
from db_utils import (
    execute_query,
    execute_transaction,
    count_records,
    batch_update
)

logger = logging.getLogger(__name__)

def get_conversation_counts_by_mode() -> Dict[str, int]:
    """
    Get the count of conversations for each teaching mode.

    Returns:
        Dictionary with teaching mode as key and count as value
    """
    try:
        # Get count of teacher mode conversations
        teacher_count = count_records(
            "conversations",
            "teaching_mode = 'teacher' OR teaching_mode IS NULL"
        )

        # Get count of qa mode conversations
        qa_count = count_records(
            "conversations",
            "teaching_mode = 'qa'"
        )

        return {
            "teacher": teacher_count,
            "qa": qa_count,
            "total": teacher_count + qa_count
        }
    except Exception as e:
        logger.error(f"Error getting conversation counts by mode: {e}")
        return {"teacher": 0, "qa": 0, "total": 0}

def create_empty_conversation(teaching_mode: str) -> Optional[str]:
    """
    Create a new empty conversation with the specified teaching mode.

    Args:
        teaching_mode: The teaching mode to use ('teacher' or 'qa')

    Returns:
        The ID of the new conversation, or None if creation failed
    """
    try:
        # Create a new conversation with the specified teaching mode
        new_conversation_id = str(uuid.uuid4())
        now = datetime.now().isoformat()

        success = execute_query(
            "INSERT INTO conversations (id, title, teaching_mode, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
            (new_conversation_id, "New Conversation", teaching_mode, now, now),
            commit=True
        ) is not None

        if success:
            logger.info(f"Created new conversation with ID: {new_conversation_id} and teaching mode: {teaching_mode}")
            return new_conversation_id
        else:
            logger.error(f"Failed to create new conversation with teaching mode: {teaching_mode}")
            return None
    except Exception as e:
        logger.error(f"Error creating empty conversation: {e}")
        return None

def clear_conversations_by_mode(teaching_mode: str) -> Dict[str, Any]:
    """
    Delete all conversations and their messages for a specific teaching mode.

    Args:
        teaching_mode: The teaching mode to filter by ('teacher' or 'qa')

    Returns:
        Dict with deleted_count and new_conversation_id
    """
    try:
        # First, get the IDs of conversations with the specified teaching mode
        conversation_ids_result = execute_query(
            "SELECT id FROM conversations WHERE teaching_mode = ? OR (teaching_mode IS NULL AND ? = 'teacher')",
            (teaching_mode, teaching_mode),
            fetch_all=True
        )

        conversation_ids = [row['id'] for row in conversation_ids_result] if conversation_ids_result else []

        if not conversation_ids:
            # No conversations to delete
            logger.info(f"No conversations found with teaching mode: {teaching_mode}")

            # Create a new conversation
            new_conversation_id = create_empty_conversation(teaching_mode)

            return {
                "deleted_count": 0,
                "new_conversation_id": new_conversation_id
            }

        # Prepare transaction queries
        queries: List[Dict[str, Any]] = []

        # Delete messages for these conversations
        placeholders = ','.join(['?'] * len(conversation_ids))
        queries.append({
            "query": f"DELETE FROM messages WHERE conversation_id IN ({placeholders})",
            "params": conversation_ids
        })

        # Delete the conversations
        queries.append({
            "query": f"DELETE FROM conversations WHERE id IN ({placeholders})",
            "params": conversation_ids
        })

        # Create a new conversation with the specified teaching mode
        new_conversation_id = str(uuid.uuid4())
        now = datetime.now().isoformat()

        queries.append({
            "query": "INSERT INTO conversations (id, title, teaching_mode, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
            "params": (new_conversation_id, "New Conversation", teaching_mode, now, now)
        })

        # Execute all queries in a transaction
        if execute_transaction(queries):
            deleted_count = len(conversation_ids)
            logger.info(f"Cleared {deleted_count} conversations with teaching mode: {teaching_mode}")
            logger.info(f"Created new conversation with ID: {new_conversation_id} and teaching mode: {teaching_mode}")

            return {
                "deleted_count": deleted_count,
                "new_conversation_id": new_conversation_id
            }
        else:
            logger.error("Failed to execute transaction for clearing conversations")
            # Try to create a new conversation separately if the transaction failed
            new_conversation_id = create_empty_conversation(teaching_mode)

            return {
                "deleted_count": 0,
                "new_conversation_id": new_conversation_id
            }
    except Exception as e:
        logger.error(f"Error clearing conversations by mode: {e}")
        raise
