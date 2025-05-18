import uuid
import logging
from datetime import datetime
from typing import List, Dict, Any, Optional

# Import database utilities
from db_utils import (
    get_db_connection,
    release_connection,
    check_column_exists,
    execute_query,
    execute_transaction
)

logger = logging.getLogger("database")

def migrate_db():
    """Perform database migrations to update schema"""
    conn = get_db_connection()
    try:
        # Check if teaching_mode column exists in conversations table
        if not check_column_exists(conn, "conversations", "teaching_mode"):
            logger.info("Adding teaching_mode column to conversations table")

            # Execute migration queries in a transaction
            queries = [
                {
                    "query": "ALTER TABLE conversations ADD COLUMN teaching_mode TEXT DEFAULT 'teacher'"
                },
                {
                    "query": "UPDATE conversations SET teaching_mode = 'teacher' WHERE teaching_mode IS NULL"
                }
            ]

            if execute_transaction(queries):
                logger.info("Migration completed: Added teaching_mode column")
            else:
                logger.error("Failed to execute migration transaction")
        else:
            logger.info("teaching_mode column already exists, no migration needed")
    except Exception as e:
        logger.error(f"Error migrating database: {e}")
        raise
    finally:
        release_connection(conn)

def init_db():
    """Initialize the database with required tables"""
    conn = get_db_connection()
    try:
        cursor = conn.cursor()

        # Create conversations table
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS conversations (
            id TEXT PRIMARY KEY,
            title TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            teaching_mode TEXT DEFAULT 'teacher'
        )
        ''')

        # Create index on updated_at for faster sorting
        cursor.execute('''
        CREATE INDEX IF NOT EXISTS idx_conversations_updated_at
        ON conversations(updated_at DESC)
        ''')

        # Create messages table
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS messages (
            id TEXT PRIMARY KEY,
            conversation_id TEXT,
            type TEXT,
            content TEXT,
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (conversation_id) REFERENCES conversations(id)
        )
        ''')

        conn.commit()
        logger.info("Database initialized")

        # Run migrations to ensure schema is up to date
        migrate_db()
    except Exception as e:
        logger.error(f"Error initializing database: {e}")
        conn.rollback()
        raise
    finally:
        release_connection(conn)

def create_conversation(title: str = "New Conversation", teaching_mode: str = "teacher") -> str:
    """Create a new conversation and return its ID"""
    conn = get_db_connection()
    try:
        conversation_id = str(uuid.uuid4())
        now = datetime.now().isoformat()

        # Check if teaching_mode column exists
        has_teaching_mode = check_column_exists(conn, "conversations", "teaching_mode")

        if has_teaching_mode:
            # If the column exists, include it in the INSERT
            query = "INSERT INTO conversations (id, title, created_at, updated_at, teaching_mode) VALUES (?, ?, ?, ?, ?)"
            params = (conversation_id, title, now, now, teaching_mode)
        else:
            # If the column doesn't exist yet, use the old schema
            query = "INSERT INTO conversations (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)"
            params = (conversation_id, title, now, now)
            logger.warning(f"teaching_mode column doesn't exist yet, created conversation without it")

        # Execute the query
        execute_query(query, params, commit=True)

        # If teaching_mode column doesn't exist, try to run the migration
        if not has_teaching_mode:
            try:
                migrate_db()
                logger.info("Ran migration after creating conversation")
            except Exception as e:
                logger.error(f"Failed to run migration after creating conversation: {e}")

        logger.info(f"Created new conversation: {conversation_id} with teaching mode: {teaching_mode}")
        return conversation_id
    except Exception as e:
        logger.error(f"Error creating conversation: {e}")
        raise
    finally:
        release_connection(conn)

def get_conversation(conversation_id: str) -> Optional[Dict[str, Any]]:
    """Get a conversation by ID"""
    try:
        # Get the conversation
        conversation = execute_query(
            "SELECT * FROM conversations WHERE id = ?",
            (conversation_id,),
            fetch_one=True
        )

        if not conversation:
            return None

        # Get messages for this conversation
        messages = execute_query(
            "SELECT * FROM messages WHERE conversation_id = ? ORDER BY timestamp",
            (conversation_id,),
            fetch_all=True
        )

        # Add messages to the result
        conversation["messages"] = messages or []

        return conversation
    except Exception as e:
        logger.error(f"Error getting conversation {conversation_id}: {e}")
        raise

def list_conversations(limit: int = 10, offset: int = 0, include_messages: bool = True) -> List[Dict[str, Any]]:
    """List conversations with pagination"""
    conn = get_db_connection()
    try:
        # Get conversations with pagination
        conversations = execute_query(
            "SELECT * FROM conversations ORDER BY updated_at DESC LIMIT ? OFFSET ?",
            (limit, offset),
            fetch_all=True
        ) or []

        # Get message counts and last message for each conversation
        for conv in conversations:
            # Get message count
            count_result = execute_query(
                "SELECT COUNT(*) as count FROM messages WHERE conversation_id = ?",
                (conv["id"],),
                fetch_one=True
            )
            conv["message_count"] = count_result["count"] if count_result else 0

            # Get last message
            last_message = execute_query(
                "SELECT type, content FROM messages WHERE conversation_id = ? ORDER BY timestamp DESC LIMIT 1",
                (conv["id"],),
                fetch_one=True
            )
            if last_message:
                conv["last_message"] = {
                    "type": last_message["type"],
                    "content": last_message["content"]
                }

            # Include all messages if requested
            if include_messages:
                messages = execute_query(
                    "SELECT id, type, content, timestamp FROM messages WHERE conversation_id = ? ORDER BY timestamp",
                    (conv["id"],),
                    fetch_all=True
                )
                conv["messages"] = messages or []

        return conversations
    except Exception as e:
        logger.error(f"Error listing conversations: {e}")
        raise
    finally:
        release_connection(conn)

def add_message(conversation_id: str, message_type: str, content: str) -> str:
    """Add a message to a conversation"""
    try:
        # Check if conversation exists
        conversation = execute_query(
            "SELECT id FROM conversations WHERE id = ?",
            (conversation_id,),
            fetch_one=True
        )

        if not conversation:
            raise ValueError(f"Conversation {conversation_id} does not exist")

        message_id = str(uuid.uuid4())
        now = datetime.now().isoformat()

        # Execute both operations in a transaction
        queries = [
            {
                "query": "INSERT INTO messages (id, conversation_id, type, content, timestamp) VALUES (?, ?, ?, ?, ?)",
                "params": (message_id, conversation_id, message_type, content, now)
            },
            {
                "query": "UPDATE conversations SET updated_at = ? WHERE id = ?",
                "params": (now, conversation_id)
            }
        ]

        if not execute_transaction(queries):
            raise RuntimeError(f"Failed to add message to conversation {conversation_id}")

        return message_id
    except Exception as e:
        logger.error(f"Error adding message to conversation {conversation_id}: {e}")
        raise

def get_messages(conversation_id: str) -> List[Dict[str, Any]]:
    """Get all messages for a conversation"""
    try:
        messages = execute_query(
            "SELECT * FROM messages WHERE conversation_id = ? ORDER BY timestamp",
            (conversation_id,),
            fetch_all=True
        )
        return messages or []
    except Exception as e:
        logger.error(f"Error getting messages for conversation {conversation_id}: {e}")
        raise

def delete_conversation(conversation_id: str) -> bool:
    """Delete a conversation and all its messages"""
    try:
        # Execute both operations in a transaction
        queries = [
            {
                "query": "DELETE FROM messages WHERE conversation_id = ?",
                "params": (conversation_id,)
            },
            {
                "query": "DELETE FROM conversations WHERE id = ?",
                "params": (conversation_id,)
            }
        ]

        success = execute_transaction(queries)

        if success:
            logger.info(f"Deleted conversation {conversation_id} and its messages")
            return True
        else:
            logger.warning(f"No conversation found with ID {conversation_id}")
            return False
    except Exception as e:
        logger.error(f"Error deleting conversation {conversation_id}: {e}")
        raise

def update_conversation_title(conversation_id: str, title: str) -> bool:
    """Update a conversation's title"""
    try:
        now = datetime.now().isoformat()

        # Execute the update query
        result = execute_query(
            "UPDATE conversations SET title = ?, updated_at = ? WHERE id = ?",
            (title, now, conversation_id),
            commit=True
        )

        # Check if the conversation was found and updated
        if result is not None:
            logger.info(f"Updated title for conversation {conversation_id}")
            return True
        else:
            logger.warning(f"No conversation found with ID {conversation_id}")
            return False
    except Exception as e:
        logger.error(f"Error updating conversation title for {conversation_id}: {e}")
        raise

def clear_all_conversations() -> int:
    """Delete all conversations and their messages"""
    try:
        # Execute both operations in a transaction
        queries = [
            {"query": "DELETE FROM messages"},
            {"query": "DELETE FROM conversations"}
        ]

        success = execute_transaction(queries)

        if success:
            # Get the count of deleted conversations (approximate since we already deleted them)
            logger.info("Cleared all conversations and messages")
            return 1  # We can't know the exact count after deletion
        else:
            logger.warning("Failed to clear conversations")
            return 0
    except Exception as e:
        logger.error(f"Error clearing all conversations: {e}")
        raise

def generate_conversation_title(conversation_id: str) -> str:
    """Generate a title for a conversation based on its content"""
    try:
        # Get the first user message
        first_message = execute_query(
            "SELECT content FROM messages WHERE conversation_id = ? AND type = 'user' ORDER BY timestamp LIMIT 1",
            (conversation_id,),
            fetch_one=True
        )

        if not first_message:
            default_title = f"New Conversation {conversation_id[:8]}"
            logger.info(f"No messages found for conversation {conversation_id}, using default title")
            return default_title

        # Use the first 30 characters of the first message as the title
        content = first_message['content']
        if len(content) > 30:
            title = content[:30] + "..."
        else:
            title = content

        # Update the conversation title
        update_conversation_title(conversation_id, title)
        logger.info(f"Generated title for conversation {conversation_id}: {title}")

        return title
    except Exception as e:
        logger.error(f"Error generating title for conversation {conversation_id}: {e}")
        return f"New Conversation {conversation_id[:8]}"

def reuse_empty_conversation(conversation_id: str, teaching_mode: str = None, limit: int = 20) -> Dict[str, Any]:
    """
    Reuse an empty conversation by updating its timestamp and teaching mode, and returning the updated conversation list.
    This combines multiple database operations into a single transaction for better performance.

    Args:
        conversation_id: The ID of the empty conversation to reuse
        teaching_mode: The teaching mode to set for this conversation (if None, keeps existing mode)
        limit: Maximum number of conversations to return in the list

    Returns:
        A dictionary with the updated conversation list and the reused conversation ID
    """
    conn = get_db_connection()
    try:
        now = datetime.now().isoformat()

        # Check if teaching_mode column exists
        has_teaching_mode = check_column_exists(conn, "conversations", "teaching_mode")

        # Prepare the update query based on whether teaching_mode is provided and column exists
        if has_teaching_mode and teaching_mode:
            # If the column exists and teaching_mode is provided, update both
            update_query = {
                "query": "UPDATE conversations SET updated_at = ?, teaching_mode = ? WHERE id = ?",
                "params": (now, teaching_mode, conversation_id)
            }
            logger.info(f"Updating conversation {conversation_id} with teaching mode: {teaching_mode}")
        else:
            # Otherwise just update the timestamp
            update_query = {
                "query": "UPDATE conversations SET updated_at = ? WHERE id = ?",
                "params": (now, conversation_id)
            }

            # If teaching_mode was provided but column doesn't exist, try to run migration
            if teaching_mode and not has_teaching_mode:
                logger.warning(f"teaching_mode column doesn't exist yet, couldn't update teaching mode")
                try:
                    migrate_db()
                    logger.info("Ran migration after updating conversation")

                    # Check again if the column exists after migration
                    has_teaching_mode = check_column_exists(conn, "conversations", "teaching_mode")
                    if has_teaching_mode:
                        # If the column now exists, update with teaching_mode
                        update_query = {
                            "query": "UPDATE conversations SET updated_at = ?, teaching_mode = ? WHERE id = ?",
                            "params": (now, teaching_mode, conversation_id)
                        }
                except Exception as e:
                    logger.error(f"Failed to run migration after updating conversation: {e}")

        # Execute the update query
        execute_query(update_query["query"], update_query["params"], commit=True)

        # Get the updated conversation list
        conversations = list_conversations(limit=limit, include_messages=False)

        return {
            "conversation_id": conversation_id,
            "conversations": conversations
        }
    except Exception as e:
        logger.error(f"Error reusing empty conversation {conversation_id}: {e}")
        raise
    finally:
        release_connection(conn)
