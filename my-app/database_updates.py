"""
Database updates for mode-specific conversation management.
This file contains functions to clear conversations by teaching mode.
"""

import logging
import uuid
from typing import Dict, Any
from database import get_db_connection, release_connection
from datetime import datetime

logger = logging.getLogger(__name__)

def clear_conversations_by_mode(teaching_mode: str) -> Dict[str, Any]:
    """
    Delete all conversations and their messages for a specific teaching mode.

    Args:
        teaching_mode: The teaching mode to filter by ('teacher' or 'qa')

    Returns:
        Dict with deleted_count and new_conversation_id
    """
    conn = get_db_connection()
    try:
        cursor = conn.cursor()

        # First, get the IDs of conversations with the specified teaching mode
        cursor.execute(
            "SELECT id FROM conversations WHERE teaching_mode = ? OR (teaching_mode IS NULL AND ? = 'teacher')",
            (teaching_mode, teaching_mode)
        )
        conversation_ids = [row['id'] for row in cursor.fetchall()]

        if not conversation_ids:
            # No conversations to delete
            logger.info(f"No conversations found with teaching mode: {teaching_mode}")

            # Create a new conversation with the specified teaching mode using UUID
            new_conversation_id = str(uuid.uuid4())
            now = datetime.now().isoformat()

            cursor.execute(
                "INSERT INTO conversations (id, title, teaching_mode, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
                (new_conversation_id, "New Conversation", teaching_mode, now, now)
            )
            conn.commit()

            return {
                "deleted_count": 0,
                "new_conversation_id": new_conversation_id
            }

        # Delete messages for these conversations
        placeholders = ','.join(['?'] * len(conversation_ids))
        cursor.execute(
            f"DELETE FROM messages WHERE conversation_id IN ({placeholders})",
            conversation_ids
        )

        # Delete the conversations
        cursor.execute(
            f"DELETE FROM conversations WHERE id IN ({placeholders})",
            conversation_ids
        )
        deleted_count = cursor.rowcount

        # Create a new conversation with the specified teaching mode using UUID
        new_conversation_id = str(uuid.uuid4())
        now = datetime.now().isoformat()

        cursor.execute(
            "INSERT INTO conversations (id, title, teaching_mode, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
            (new_conversation_id, "New Conversation", teaching_mode, now, now)
        )

        conn.commit()

        logger.info(f"Cleared {deleted_count} conversations with teaching mode: {teaching_mode}")
        logger.info(f"Created new conversation with ID: {new_conversation_id} and teaching mode: {teaching_mode}")

        return {
            "deleted_count": deleted_count,
            "new_conversation_id": new_conversation_id
        }
    except Exception as e:
        logger.error(f"Error clearing conversations by mode: {e}")
        conn.rollback()
        raise
    finally:
        release_connection(conn)
