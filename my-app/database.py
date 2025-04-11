import sqlite3
import uuid
import json
import logging
from datetime import datetime
from typing import List, Dict, Any, Optional

logger = logging.getLogger("database")

# Database file path
DB_FILE = "conversations.db"

def get_db_connection():
    """Create a connection to the SQLite database"""
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row  # Return rows as dictionaries
    return conn

def init_db():
    """Initialize the database with required tables"""
    conn = get_db_connection()
    cursor = conn.cursor()

    # Create conversations table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY,
        title TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
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
    conn.close()
    logger.info("Database initialized")

def create_conversation(title: str = "New Conversation") -> str:
    """Create a new conversation and return its ID"""
    conn = get_db_connection()
    cursor = conn.cursor()

    conversation_id = str(uuid.uuid4())
    now = datetime.now().isoformat()

    cursor.execute(
        "INSERT INTO conversations (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)",
        (conversation_id, title, now, now)
    )

    conn.commit()
    conn.close()

    logger.info(f"Created new conversation: {conversation_id}")
    return conversation_id

def get_conversation(conversation_id: str) -> Optional[Dict[str, Any]]:
    """Get a conversation by ID"""
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM conversations WHERE id = ?", (conversation_id,))
    conversation = cursor.fetchone()

    if not conversation:
        conn.close()
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

    conn.close()
    return result

def list_conversations(limit: int = 10, offset: int = 0, include_messages: bool = True) -> List[Dict[str, Any]]:
    """List conversations with pagination"""
    conn = get_db_connection()
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

    conn.close()
    return conversations

def add_message(conversation_id: str, message_type: str, content: str) -> str:
    """Add a message to a conversation"""
    conn = get_db_connection()
    cursor = conn.cursor()

    # Check if conversation exists
    cursor.execute("SELECT id FROM conversations WHERE id = ?", (conversation_id,))
    if not cursor.fetchone():
        conn.close()
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
    conn.close()

    return message_id

def get_messages(conversation_id: str) -> List[Dict[str, Any]]:
    """Get all messages for a conversation"""
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute(
        "SELECT * FROM messages WHERE conversation_id = ? ORDER BY timestamp",
        (conversation_id,)
    )

    messages = [dict(row) for row in cursor.fetchall()]
    conn.close()

    return messages

def delete_conversation(conversation_id: str) -> bool:
    """Delete a conversation and all its messages"""
    conn = get_db_connection()
    cursor = conn.cursor()

    # Delete messages first (foreign key constraint)
    cursor.execute("DELETE FROM messages WHERE conversation_id = ?", (conversation_id,))

    # Delete conversation
    cursor.execute("DELETE FROM conversations WHERE id = ?", (conversation_id,))

    deleted = cursor.rowcount > 0

    conn.commit()
    conn.close()

    return deleted

def update_conversation_title(conversation_id: str, title: str) -> bool:
    """Update a conversation's title"""
    conn = get_db_connection()
    cursor = conn.cursor()

    now = datetime.now().isoformat()

    cursor.execute(
        "UPDATE conversations SET title = ?, updated_at = ? WHERE id = ?",
        (title, now, conversation_id)
    )

    updated = cursor.rowcount > 0

    conn.commit()
    conn.close()

    return updated

def clear_all_conversations() -> int:
    """Delete all conversations and their messages"""
    conn = get_db_connection()
    cursor = conn.cursor()

    # Delete all messages first (foreign key constraint)
    cursor.execute("DELETE FROM messages")

    # Delete all conversations
    cursor.execute("DELETE FROM conversations")
    deleted_count = cursor.rowcount

    conn.commit()
    conn.close()

    return deleted_count

def generate_conversation_title(conversation_id: str) -> str:
    """Generate a title for a conversation based on its content"""
    conn = get_db_connection()
    cursor = conn.cursor()

    # Get the first user message
    cursor.execute(
        "SELECT content FROM messages WHERE conversation_id = ? AND type = 'user' ORDER BY timestamp LIMIT 1",
        (conversation_id,)
    )

    first_message = cursor.fetchone()
    conn.close()

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
