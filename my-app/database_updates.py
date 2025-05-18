"""
Database updates for mode-specific conversation management.
This file contains functions to clear conversations by teaching mode.
"""

import logging
import uuid
from typing import Dict, Any, List
from datetime import datetime
from db_utils import (
    execute_query,
    execute_transaction
)

logger = logging.getLogger(__name__)

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

            # Create a new conversation with the specified teaching mode using UUID
            new_conversation_id = str(uuid.uuid4())
            now = datetime.now().isoformat()

            execute_query(
                "INSERT INTO conversations (id, title, teaching_mode, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
                (new_conversation_id, "New Conversation", teaching_mode, now, now),
                commit=True
            )

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
            return {
                "deleted_count": 0,
                "new_conversation_id": new_conversation_id
            }
    except Exception as e:
        logger.error(f"Error clearing conversations by mode: {e}")
        raise
