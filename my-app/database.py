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
    execute_transaction,
    get_record_by_id
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

        # Check if user_id column exists in conversations table
        if not check_column_exists(conn, "conversations", "user_id"):
            logger.info("Adding user_id column to conversations table")

            # Execute migration queries in a transaction
            queries = [
                {
                    "query": "ALTER TABLE conversations ADD COLUMN user_id TEXT"
                }
            ]

            if execute_transaction(queries):
                logger.info("Migration completed: Added user_id column")
            else:
                logger.error("Failed to execute migration transaction")
        else:
            logger.info("user_id column already exists, no migration needed")
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

        # Create users table
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        ''')

        # Create conversations table
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS conversations (
            id TEXT PRIMARY KEY,
            title TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            teaching_mode TEXT DEFAULT 'teacher',
            user_id TEXT,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
        ''')

        # Create index on updated_at for faster sorting
        cursor.execute('''
        CREATE INDEX IF NOT EXISTS idx_conversations_updated_at
        ON conversations(updated_at DESC)
        ''')

        # Create index on user_id for faster user-specific queries
        cursor.execute('''
        CREATE INDEX IF NOT EXISTS idx_conversations_user_id
        ON conversations(user_id)
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

def create_conversation(title: str = "New Conversation", teaching_mode: str = "teacher", user_id: str = None) -> str:
    """Create a new conversation and return its ID"""
    try:
        conversation_id = str(uuid.uuid4())
        now = datetime.now().isoformat()

        # Create conversation with all modern columns (migrations should have run during startup)
        execute_query(
            "INSERT INTO conversations (id, title, created_at, updated_at, teaching_mode, user_id) VALUES (?, ?, ?, ?, ?, ?)",
            (conversation_id, title, now, now, teaching_mode, user_id),
            commit=True
        )

        logger.info(f"Created new conversation: {conversation_id} with teaching mode: {teaching_mode} for user: {user_id}")
        return conversation_id
    except Exception as e:
        logger.error(f"Error creating conversation: {e}")
        raise

def get_conversation(conversation_id: str, user_id: str = None) -> Optional[Dict[str, Any]]:
    """
    Get a conversation by ID with optional user_id check for data isolation

    Args:
        conversation_id: The ID of the conversation to retrieve
        user_id: Optional user ID to verify ownership (for data isolation)

    Returns:
        The conversation data if found and accessible, None otherwise
    """
    try:
        # Get the conversation using the utility function
        conversation = get_record_by_id("conversations", conversation_id)

        if not conversation:
            logger.warning(f"Conversation {conversation_id} not found")
            return None

        # Check user_id for data isolation if provided
        if user_id and conversation.get("user_id") and conversation.get("user_id") != user_id:
            logger.warning(f"User {user_id} attempted to access conversation {conversation_id} belonging to another user")
            return None  # Don't allow access to another user's conversation

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

def list_conversations(limit: int = 10, offset: int = 0, include_messages: bool = True, user_id: str = None) -> List[Dict[str, Any]]:
    """List conversations with pagination and optional user filtering"""
    try:
        # Always filter by user_id if provided for data isolation
        if user_id:
            query = "SELECT * FROM conversations WHERE user_id = ? ORDER BY updated_at DESC LIMIT ? OFFSET ?"
            params = (user_id, limit, offset)
            logger.info(f"Listing conversations for user: {user_id}")
        else:
            # Only return conversations without a user_id if no user_id is provided
            # This maintains backward compatibility with existing data
            query = "SELECT * FROM conversations WHERE user_id IS NULL ORDER BY updated_at DESC LIMIT ? OFFSET ?"
            params = (limit, offset)
            logger.info("Listing conversations with no user_id")

        # Get conversations with pagination
        conversations = execute_query(query, params, fetch_all=True) or []
        logger.info(f"Found {len(conversations)} conversations")

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

def delete_conversation(conversation_id: str, user_id: str = None) -> bool:
    """
    Delete a conversation and all its messages with optional user_id check

    Args:
        conversation_id: The ID of the conversation to delete
        user_id: Optional user ID to verify ownership (for data isolation)

    Returns:
        True if the conversation was deleted, False otherwise
    """
    try:
        # Check if the conversation exists and belongs to the user (if user_id provided)
        if user_id:
            conversation = execute_query(
                "SELECT id, user_id FROM conversations WHERE id = ?",
                (conversation_id,),
                fetch_one=True
            )

            # If conversation doesn't exist or belongs to another user, don't delete it
            if not conversation:
                logger.warning(f"Conversation {conversation_id} not found")
                return False

            if conversation.get("user_id") and conversation.get("user_id") != user_id:
                logger.warning(f"User {user_id} attempted to delete conversation {conversation_id} belonging to another user")
                return False

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

        # Update the title and timestamp
        execute_query(
            "UPDATE conversations SET title = ?, updated_at = ? WHERE id = ?",
            (title, now, conversation_id),
            commit=True
        )

        logger.info(f"Updated title for conversation {conversation_id}")
        return True
    except Exception as e:
        logger.error(f"Error updating conversation title for {conversation_id}: {e}")
        raise

def generate_conversation_title(conversation_id: str) -> str:
    """Generate a title for a conversation based on its content"""
    try:
        # First check if conversation exists
        conversation = execute_query(
            "SELECT id FROM conversations WHERE id = ?",
            (conversation_id,),
            fetch_one=True
        )

        if not conversation:
            logger.warning(f"Cannot generate title: conversation {conversation_id} does not exist")
            return f"New Conversation {conversation_id[:8]}"

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

        # Update the conversation title only if conversation still exists
        if update_conversation_title(conversation_id, title):
            logger.info(f"Generated title for conversation {conversation_id}: {title}")
        else:
            logger.warning(f"Failed to update title for conversation {conversation_id}")

        return title
    except Exception as e:
        logger.error(f"Error generating title for conversation {conversation_id}: {e}")
        return f"New Conversation {conversation_id[:8]}"

def reuse_empty_conversation(conversation_id: str, teaching_mode: str = None, limit: int = 20) -> Dict[str, Any]:
    """
    Reuse an empty conversation by updating its timestamp and teaching mode.

    Args:
        conversation_id: The ID of the empty conversation to reuse
        teaching_mode: The teaching mode to set for this conversation (if None, keeps existing mode)
        limit: Maximum number of conversations to return in the list

    Returns:
        A dictionary with the updated conversation list and the reused conversation ID
    """
    try:
        # Check if conversation exists
        conversation = get_record_by_id("conversations", conversation_id)
        if not conversation:
            logger.warning(f"Conversation {conversation_id} not found")
            return {
                "conversation_id": None,
                "conversations": list_conversations(limit=limit, include_messages=False)
            }

        # Update the conversation timestamp and teaching mode
        now = datetime.now().isoformat()
        if teaching_mode:
            execute_query(
                "UPDATE conversations SET updated_at = ?, teaching_mode = ? WHERE id = ?",
                (now, teaching_mode, conversation_id),
                commit=True
            )
            logger.info(f"Updated conversation {conversation_id} with teaching mode: {teaching_mode}")
        else:
            execute_query(
                "UPDATE conversations SET updated_at = ? WHERE id = ?",
                (now, conversation_id),
                commit=True
            )

        # Get the updated conversation list
        conversations = list_conversations(limit=limit, include_messages=False)

        return {
            "conversation_id": conversation_id,
            "conversations": conversations
        }
    except Exception as e:
        logger.error(f"Error reusing empty conversation {conversation_id}: {e}")
        raise

def clear_conversations_by_mode(teaching_mode: str, user_id: str = None) -> Dict[str, Any]:
    """
    Delete all conversations and their messages for a specific teaching mode.

    Args:
        teaching_mode: The teaching mode to filter by ('teacher' or 'qa')
        user_id: The user ID to filter by (for data isolation)

    Returns:
        Dict with deleted_count and new_conversation_id
    """
    try:
        # First, get the IDs of conversations with the specified teaching mode and user
        if user_id:
            conversation_ids_result = execute_query(
                "SELECT id FROM conversations WHERE (teaching_mode = ? OR (teaching_mode IS NULL AND ? = 'teacher')) AND user_id = ?",
                (teaching_mode, teaching_mode, user_id),
                fetch_all=True
            )
        else:
            # Legacy mode - no user filtering
            conversation_ids_result = execute_query(
                "SELECT id FROM conversations WHERE (teaching_mode = ? OR (teaching_mode IS NULL AND ? = 'teacher')) AND user_id IS NULL",
                (teaching_mode, teaching_mode),
                fetch_all=True
            )

        conversation_ids = [row['id'] for row in conversation_ids_result] if conversation_ids_result else []

        if not conversation_ids:
            # No conversations to delete
            logger.info(f"No conversations found with teaching mode: {teaching_mode} for user: {user_id}")

            # Create a new conversation with user_id
            new_conversation_id = create_conversation("New Conversation", teaching_mode, user_id)

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

        # Execute deletion queries in a transaction
        if execute_transaction(queries):
            deleted_count = len(conversation_ids)
            logger.info(f"Cleared {deleted_count} conversations with teaching mode: {teaching_mode} for user: {user_id}")

            # Create a new conversation after successful deletion
            new_conversation_id = create_conversation("New Conversation", teaching_mode, user_id)
            logger.info(f"Created new conversation with ID: {new_conversation_id} and teaching mode: {teaching_mode}")

            return {
                "deleted_count": deleted_count,
                "new_conversation_id": new_conversation_id
            }
        else:
            logger.error("Failed to execute transaction for clearing conversations")
            # Try to create a new conversation separately if the transaction failed
            new_conversation_id = create_conversation("New Conversation", teaching_mode, user_id)

            return {
                "deleted_count": 0,
                "new_conversation_id": new_conversation_id
            }
    except Exception as e:
        logger.error(f"Error clearing conversations by mode: {e}")
        raise
