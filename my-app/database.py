import sqlite3
import uuid
import json
import logging
import threading
from datetime import datetime
from typing import List, Dict, Any, Optional

logger = logging.getLogger("database")

# Database file path
DB_FILE = "conversations.db"

# Simple connection pool for SQLite
class ConnectionPool:
    _instance = None
    _lock = threading.Lock()

    def __new__(cls):
        with cls._lock:
            if cls._instance is None:
                cls._instance = super(ConnectionPool, cls).__new__(cls)
                cls._instance.pool = []
                cls._instance.max_connections = 5
                cls._instance.in_use = set()
            return cls._instance

    def get_connection(self):
        """Get a connection from the pool or create a new one"""
        with self._lock:
            # Try to reuse an existing connection
            while self.pool:
                conn = self.pool.pop()
                if conn not in self.in_use:
                    try:
                        # Test if connection is still valid
                        conn.execute("SELECT 1")
                        self.in_use.add(conn)
                        return conn
                    except sqlite3.Error:
                        # Connection is no longer valid, discard it
                        continue

            # Create a new connection
            conn = sqlite3.connect(DB_FILE, check_same_thread=False)
            conn.row_factory = sqlite3.Row  # Return rows as dictionaries
            self.in_use.add(conn)
            return conn

    def release_connection(self, conn):
        """Return a connection to the pool"""
        with self._lock:
            if conn in self.in_use:
                self.in_use.remove(conn)
                if len(self.pool) < self.max_connections:
                    self.pool.append(conn)
                else:
                    conn.close()

# Initialize the connection pool
_pool = ConnectionPool()

def get_db_connection():
    """Get a connection from the pool"""
    return _pool.get_connection()

def release_connection(conn):
    """Release a connection back to the pool"""
    _pool.release_connection(conn)

def check_column_exists(conn, table, column):
    """Check if a column exists in a table"""
    cursor = conn.cursor()
    cursor.execute(f"PRAGMA table_info({table})")
    columns = cursor.fetchall()
    return any(col["name"] == column for col in columns)

def migrate_db():
    """Perform database migrations to update schema"""
    conn = get_db_connection()
    try:
        cursor = conn.cursor()

        # Check if teaching_mode column exists in conversations table
        if not check_column_exists(conn, "conversations", "teaching_mode"):
            logger.info("Adding teaching_mode column to conversations table")
            cursor.execute("ALTER TABLE conversations ADD COLUMN teaching_mode TEXT DEFAULT 'teacher'")

            # Set default value for existing rows
            cursor.execute("UPDATE conversations SET teaching_mode = 'teacher' WHERE teaching_mode IS NULL")

            conn.commit()
            logger.info("Migration completed: Added teaching_mode column")
        else:
            logger.info("teaching_mode column already exists, no migration needed")

        conn.commit()
    except Exception as e:
        logger.error(f"Error migrating database: {e}")
        conn.rollback()
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
        cursor = conn.cursor()

        conversation_id = str(uuid.uuid4())
        now = datetime.now().isoformat()

        # Check if teaching_mode column exists
        has_teaching_mode = check_column_exists(conn, "conversations", "teaching_mode")

        if has_teaching_mode:
            # If the column exists, include it in the INSERT
            cursor.execute(
                "INSERT INTO conversations (id, title, created_at, updated_at, teaching_mode) VALUES (?, ?, ?, ?, ?)",
                (conversation_id, title, now, now, teaching_mode)
            )
        else:
            # If the column doesn't exist yet, use the old schema
            cursor.execute(
                "INSERT INTO conversations (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)",
                (conversation_id, title, now, now)
            )
            logger.warning(f"teaching_mode column doesn't exist yet, created conversation without it")

            # Try to run the migration to add the column
            try:
                migrate_db()
                logger.info("Ran migration after creating conversation")
            except Exception as e:
                logger.error(f"Failed to run migration after creating conversation: {e}")

        conn.commit()
        logger.info(f"Created new conversation: {conversation_id} with teaching mode: {teaching_mode}")
        return conversation_id
    except Exception as e:
        logger.error(f"Error creating conversation: {e}")
        conn.rollback()
        raise
    finally:
        release_connection(conn)

def get_conversation(conversation_id: str) -> Optional[Dict[str, Any]]:
    """Get a conversation by ID"""
    conn = get_db_connection()
    try:
        cursor = conn.cursor()

        cursor.execute("SELECT * FROM conversations WHERE id = ?", (conversation_id,))
        conversation = cursor.fetchone()

        if not conversation:
            return None

        # Convert to dict
        result = dict(conversation)

        # Get messages for this conversation
        cursor.execute(
            "SELECT * FROM messages WHERE conversation_id = ? ORDER BY timestamp",
            (conversation_id,)
        )
        messages = [dict(row) for row in cursor.fetchall()]
        result["messages"] = messages

        return result
    except Exception as e:
        logger.error(f"Error getting conversation {conversation_id}: {e}")
        raise
    finally:
        release_connection(conn)

def list_conversations(limit: int = 10, offset: int = 0, include_messages: bool = True) -> List[Dict[str, Any]]:
    """List conversations with pagination"""
    conn = get_db_connection()
    try:
        cursor = conn.cursor()

        cursor.execute(
            "SELECT * FROM conversations ORDER BY updated_at DESC LIMIT ? OFFSET ?",
            (limit, offset)
        )

        conversations = [dict(row) for row in cursor.fetchall()]

        # Get message counts and last message for each conversation
        for conv in conversations:
            # Get message count
            cursor.execute(
                "SELECT COUNT(*) as count FROM messages WHERE conversation_id = ?",
                (conv["id"],)
            )
            count = cursor.fetchone()["count"]
            conv["message_count"] = count

            # Get last message
            cursor.execute(
                "SELECT type, content FROM messages WHERE conversation_id = ? ORDER BY timestamp DESC LIMIT 1",
                (conv["id"],)
            )
            last_message = cursor.fetchone()
            if last_message:
                conv["last_message"] = {
                    "type": last_message["type"],
                    "content": last_message["content"]
                }

            # Include all messages if requested
            if include_messages:
                cursor.execute(
                    "SELECT id, type, content, timestamp FROM messages WHERE conversation_id = ? ORDER BY timestamp",
                    (conv["id"],)
                )
                messages = [dict(row) for row in cursor.fetchall()]
                conv["messages"] = messages

        return conversations
    except Exception as e:
        logger.error(f"Error listing conversations: {e}")
        raise
    finally:
        release_connection(conn)

def add_message(conversation_id: str, message_type: str, content: str) -> str:
    """Add a message to a conversation"""
    conn = get_db_connection()
    try:
        cursor = conn.cursor()

        # Check if conversation exists
        cursor.execute("SELECT id FROM conversations WHERE id = ?", (conversation_id,))
        if not cursor.fetchone():
            raise ValueError(f"Conversation {conversation_id} does not exist")

        message_id = str(uuid.uuid4())
        now = datetime.now().isoformat()

        # Insert message
        cursor.execute(
            "INSERT INTO messages (id, conversation_id, type, content, timestamp) VALUES (?, ?, ?, ?, ?)",
            (message_id, conversation_id, message_type, content, now)
        )

        # Update conversation's updated_at timestamp
        cursor.execute(
            "UPDATE conversations SET updated_at = ? WHERE id = ?",
            (now, conversation_id)
        )

        conn.commit()
        return message_id
    except Exception as e:
        logger.error(f"Error adding message to conversation {conversation_id}: {e}")
        conn.rollback()
        raise
    finally:
        release_connection(conn)

def get_messages(conversation_id: str) -> List[Dict[str, Any]]:
    """Get all messages for a conversation"""
    conn = get_db_connection()
    try:
        cursor = conn.cursor()

        cursor.execute(
            "SELECT * FROM messages WHERE conversation_id = ? ORDER BY timestamp",
            (conversation_id,)
        )

        messages = [dict(row) for row in cursor.fetchall()]
        return messages
    except Exception as e:
        logger.error(f"Error getting messages for conversation {conversation_id}: {e}")
        raise
    finally:
        release_connection(conn)

def delete_conversation(conversation_id: str) -> bool:
    """Delete a conversation and all its messages"""
    conn = get_db_connection()
    try:
        cursor = conn.cursor()

        # Delete messages first (foreign key constraint)
        cursor.execute("DELETE FROM messages WHERE conversation_id = ?", (conversation_id,))

        # Delete conversation
        cursor.execute("DELETE FROM conversations WHERE id = ?", (conversation_id,))

        deleted = cursor.rowcount > 0

        conn.commit()
        return deleted
    except Exception as e:
        logger.error(f"Error deleting conversation {conversation_id}: {e}")
        conn.rollback()
        raise
    finally:
        release_connection(conn)

def update_conversation_title(conversation_id: str, title: str) -> bool:
    """Update a conversation's title"""
    conn = get_db_connection()
    try:
        cursor = conn.cursor()

        now = datetime.now().isoformat()

        cursor.execute(
            "UPDATE conversations SET title = ?, updated_at = ? WHERE id = ?",
            (title, now, conversation_id)
        )

        updated = cursor.rowcount > 0

        conn.commit()
        return updated
    except Exception as e:
        logger.error(f"Error updating conversation title for {conversation_id}: {e}")
        conn.rollback()
        raise
    finally:
        release_connection(conn)

def clear_all_conversations() -> int:
    """Delete all conversations and their messages"""
    conn = get_db_connection()
    try:
        cursor = conn.cursor()

        # Delete all messages first (foreign key constraint)
        cursor.execute("DELETE FROM messages")

        # Delete all conversations
        cursor.execute("DELETE FROM conversations")
        deleted_count = cursor.rowcount

        conn.commit()
        return deleted_count
    except Exception as e:
        logger.error(f"Error clearing all conversations: {e}")
        conn.rollback()
        raise
    finally:
        release_connection(conn)

def generate_conversation_title(conversation_id: str) -> str:
    """Generate a title for a conversation based on its content"""
    conn = get_db_connection()
    try:
        cursor = conn.cursor()

        # Get the first user message
        cursor.execute(
            "SELECT content FROM messages WHERE conversation_id = ? AND type = 'user' ORDER BY timestamp LIMIT 1",
            (conversation_id,)
        )

        first_message = cursor.fetchone()

        if not first_message:
            return f"New Conversation {conversation_id[:8]}"

        # Use the first 30 characters of the first message as the title
        content = first_message['content']
        if len(content) > 30:
            title = content[:30] + "..."
        else:
            title = content

        # Update the conversation title
        update_conversation_title(conversation_id, title)

        return title
    except Exception as e:
        logger.error(f"Error generating title for conversation {conversation_id}: {e}")
        return f"New Conversation {conversation_id[:8]}"
    finally:
        release_connection(conn)

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
        cursor = conn.cursor()
        now = datetime.now().isoformat()

        # Begin transaction
        cursor.execute("BEGIN TRANSACTION")

        # Check if teaching_mode column exists
        has_teaching_mode = check_column_exists(conn, "conversations", "teaching_mode")

        if has_teaching_mode and teaching_mode:
            # If the column exists and teaching_mode is provided, update both
            cursor.execute(
                "UPDATE conversations SET updated_at = ?, teaching_mode = ? WHERE id = ?",
                (now, teaching_mode, conversation_id)
            )
            logger.info(f"Updated conversation {conversation_id} with teaching mode: {teaching_mode}")
        else:
            # Otherwise just update the timestamp
            cursor.execute(
                "UPDATE conversations SET updated_at = ? WHERE id = ?",
                (now, conversation_id)
            )

            # If teaching_mode was provided but column doesn't exist, try to run migration
            if teaching_mode and not has_teaching_mode:
                logger.warning(f"teaching_mode column doesn't exist yet, couldn't update teaching mode")
                try:
                    # Release the current connection and get a new one for the migration
                    conn.commit()
                    release_connection(conn)
                    migrate_db()
                    logger.info("Ran migration after updating conversation")

                    # Get a new connection and start a new transaction
                    conn = get_db_connection()
                    cursor = conn.cursor()
                    cursor.execute("BEGIN TRANSACTION")
                except Exception as e:
                    logger.error(f"Failed to run migration after updating conversation: {e}")

        # Get the updated conversation list
        cursor.execute(
            "SELECT * FROM conversations ORDER BY updated_at DESC LIMIT ?",
            (limit,)
        )
        conversations = [dict(row) for row in cursor.fetchall()]

        # Get message counts and last message for each conversation
        for conv in conversations:
            # Get message count
            cursor.execute(
                "SELECT COUNT(*) as count FROM messages WHERE conversation_id = ?",
                (conv["id"],)
            )
            count = cursor.fetchone()["count"]
            conv["message_count"] = count

            # Get last message
            cursor.execute(
                "SELECT type, content FROM messages WHERE conversation_id = ? ORDER BY timestamp DESC LIMIT 1",
                (conv["id"],)
            )
            last_message = cursor.fetchone()
            if last_message:
                conv["last_message"] = {
                    "type": last_message["type"],
                    "content": last_message["content"]
                }

        # Commit the transaction
        conn.commit()

        return {
            "conversation_id": conversation_id,
            "conversations": conversations
        }
    except Exception as e:
        conn.rollback()
        logger.error(f"Error reusing empty conversation {conversation_id}: {e}")
        raise
    finally:
        release_connection(conn)
