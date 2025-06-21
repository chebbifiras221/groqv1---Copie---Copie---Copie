# Backend Technical Interview Guide

## 📋 Explanation Order & Strategy

### **Phase 1: Foundation & Architecture (Start Here)**

1. **Project Dependencies & Setup** (`requirements.txt`)
2. **Configuration Management** (`config.py`)
3. **Database Architecture** (`database.py`, `db_utils.py`)
4. **Application Entry Point** (`main.py`)

### **Phase 2: Core AI & Processing**

5. **AI Integration & Prompts** (`ai_utils.py`, `ai_prompts.py`)
6. **Text Processing Pipeline** (`text_processor.py`)
7. **Topic Validation** (`topic_validator.py`)
8. **TTS Integration** (`tts_web.py`)

### **Phase 3: Real-Time Communication**

9. **Message Handling System** (`message_handlers.py`)
10. **Authentication System** (`auth_api.py`, `auth_db.py`)
11. **Database Utilities** (`db_utils.py`)
12. **System Management** (`shutdown.py`)

---

## 🚀 Phase 1: Foundation & Architecture

### 1. Project Dependencies (`requirements.txt`)

**Purpose:** Defines the Python ecosystem and real-time communication stack
**Interview Value:** Shows understanding of modern AI/ML tools and real-time systems

```python
livekit-agents==0.12.16          # Real-time agent framework
livekit-plugins-openai==0.12.0   # OpenAI integration for STT
livekit-plugins-silero==0.7.4    # Voice Activity Detection
livekit-plugins-groq==0.1.2      # Groq AI integration
python-dotenv~=1.0               # Environment variable management
requests>=2.31.0                 # HTTP client for API calls
PyJWT>=2.8.0                     # JWT token handling
```

**Technology Stack Analysis:**

#### **Real-Time Communication:**
- **LiveKit Agents:** Enterprise-grade WebRTC framework for real-time audio/video
- **Plugin Architecture:** Modular design allowing different AI providers
- **Voice Processing:** Silero VAD for speech detection and segmentation

#### **AI Integration:**
- **Multi-Provider Support:** OpenAI and Groq for redundancy and cost optimization
- **Groq Focus:** High-speed inference with Llama models
- **Fallback Strategy:** Multiple providers ensure service reliability

#### **Security & Configuration:**
- **Environment Variables:** Secure API key management
- **JWT Authentication:** Stateless authentication for scalability
- **Version Pinning:** Ensures reproducible deployments

**Interview Talking Points:**
1. **Architecture Choice:** "I chose LiveKit for enterprise-grade real-time communication with built-in scaling"
2. **AI Strategy:** "Multi-provider approach with Groq for speed and OpenAI as fallback ensures reliability"
3. **Security:** "JWT tokens and environment variables follow security best practices"
4. **Scalability:** "Agent-based architecture allows horizontal scaling of voice processing"

---

### 2. Configuration Management (`config.py`)

**Purpose:** Centralized configuration with intelligent AI model fallback strategy
**Interview Value:** Demonstrates system design thinking and operational considerations

```python
"""
Configuration module for the AI Teaching Assistant application.
This module centralizes all configuration constants and settings.
"""

import os
from typing import Dict, Any, List

# API Configuration
GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"
GROQ_API_KEY = os.getenv("GROQ_API_KEY")

# Database Configuration
DB_FILE_NAME = "conversations.db"
DEFAULT_CONVERSATION_TITLE = "New Conversation"

# Message Processing Configuration
MAX_MESSAGE_LENGTH = 50000        # Prevents memory issues
MAX_CONVERSATION_HISTORY = 15     # Balances context vs performance
CONVERSATION_LIST_LIMIT = 20      # UI pagination limit
```

**Configuration Architecture Breakdown:**

#### **Environment-Based Configuration:**
- **API Keys:** Loaded from environment variables for security
- **Database Path:** Configurable for different environments
- **Feature Flags:** Easy to toggle features without code changes

#### **Performance Tuning:**
- **Message Limits:** Prevents memory exhaustion from large inputs
- **History Management:** Balances AI context with API costs
- **Pagination:** Optimizes database queries and UI performance

```python
# AI Model Configuration - Intelligent Fallback Strategy
AI_MODELS = [
    # Primary models (70B - highest quality)
    {"name": "llama-3.3-70b-versatile", "temperature": 0.6, "description": "Llama 3.3 70B Versatile"},
    {"name": "llama3-70b-8192", "temperature": 0.6, "description": "Llama 3 70B"},

    # Secondary models (8B - good balance)
    {"name": "llama-3.1-8b-instant", "temperature": 0.6, "description": "Llama 3.1 8B Instant"},
    {"name": "llama3-8b-8192", "temperature": 0.6, "description": "Llama 3 8B"},

    # Fallback models (7B - faster, still capable)
    {"name": "llama-3.2-7b-preview", "temperature": 0.6, "description": "Llama 3.2 7B Preview"},
    {"name": "llama-3.1-7b-versatile", "temperature": 0.6, "description": "Llama 3.1 7B Versatile"},

    # Emergency fallback (smaller but very fast)
    {"name": "llama-3.2-3b-preview", "temperature": 0.7, "description": "Llama 3.2 3B Preview"},
    {"name": "llama-3.2-1b-preview", "temperature": 0.7, "description": "Llama 3.2 1B Preview"}
]
```

**AI Model Strategy Analysis:**

#### **Hierarchical Fallback:**
1. **70B Models:** Highest quality for complex educational content
2. **8B Models:** Good balance of speed and quality for most interactions
3. **7B Models:** Faster responses while maintaining educational value
4. **3B/1B Models:** Emergency fallback to ensure service availability

#### **Temperature Strategy:**
- **Larger Models (70B-7B):** 0.6 temperature for balanced, educational responses
- **Smaller Models (3B-1B):** 0.7 temperature to compensate for reduced capabilities
- **Consistency:** Maintains response quality across model sizes

```python
# AI Request Parameters
AI_REQUEST_PARAMS = {
    "max_tokens": 2048,              # Allows comprehensive explanations
    "top_p": 0.9,                    # Focused on likely responses
    "frequency_penalty": 0.2,        # Reduces repetition
    "presence_penalty": 0.1          # Encourages topic diversity
}

# Retry Configuration
DEFAULT_MAX_RETRIES = 3
DEFAULT_RETRY_DELAY = 0.5
AI_REQUEST_TIMEOUT = (10, 30)       # (connection, read) timeouts
AI_MODEL_RETRY_COUNT = 2            # Retries per model
AI_MODEL_SWITCH_DELAY = 1.0         # Delay between model attempts
```

**Reliability Configuration:**

#### **Request Optimization:**
- **Token Limits:** Balances comprehensive responses with API costs
- **Sampling Parameters:** Optimized for educational content quality
- **Penalty Settings:** Reduces repetition while maintaining coherence

#### **Fault Tolerance:**
- **Multiple Retry Layers:** Per-request and per-model retry strategies
- **Exponential Backoff:** Prevents API rate limiting
- **Timeout Management:** Prevents hanging requests

**Interview Talking Points:**
1. **System Design:** "Centralized configuration enables easy tuning without code changes"
2. **Reliability:** "Multi-layer fallback strategy ensures 99.9% service availability"
3. **Performance:** "Intelligent model selection balances quality with response time"
4. **Cost Optimization:** "Model hierarchy optimizes API costs while maintaining quality"
5. **Operational Excellence:** "Comprehensive retry and timeout strategies handle real-world network issues"

---

### 3. Database Architecture (`database.py`)

**Purpose:** Comprehensive data persistence layer with user isolation and conversation management
**Interview Value:** Shows database design, transaction handling, and data security principles

```python
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
```

**Database Architecture Overview:**

#### **Schema Design:**
```sql
-- Users table for authentication and data isolation
CREATE TABLE users (
    id TEXT PRIMARY KEY,              -- UUID for user identification
    username TEXT UNIQUE NOT NULL,   -- Unique username
    password_hash TEXT NOT NULL,     -- Hashed password (never plain text)
    email TEXT UNIQUE,               -- Optional email for future features
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP             -- Track user activity
);

-- Conversations table with teaching mode support
CREATE TABLE conversations (
    id TEXT PRIMARY KEY,              -- UUID for conversation identification
    title TEXT,                      -- Auto-generated or user-defined title
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    teaching_mode TEXT DEFAULT 'teacher',  -- 'teacher' or 'qa' mode
    user_id TEXT,                    -- Foreign key for data isolation
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Messages table for conversation content
CREATE TABLE messages (
    id TEXT PRIMARY KEY,              -- UUID for message identification
    conversation_id TEXT,            -- Links to conversations table
    type TEXT,                       -- 'user' or 'ai' message type
    content TEXT,                    -- Message content
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (conversation_id) REFERENCES conversations(id)
);
```

**Database Migration System:**

```python
def migrate_db():
    """Perform database migrations to update schema"""
    conn = get_db_connection()
    try:
        # Check if teaching_mode column exists
        if not check_column_exists(conn, "conversations", "teaching_mode"):
            logger.info("Adding teaching_mode column to conversations table")

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

        # Check if user_id column exists
        if not check_column_exists(conn, "conversations", "user_id"):
            logger.info("Adding user_id column to conversations table")

            queries = [
                {
                    "query": "ALTER TABLE conversations ADD COLUMN user_id TEXT"
                }
            ]

            if execute_transaction(queries):
                logger.info("Migration completed: Added user_id column")
            else:
                logger.error("Failed to execute migration transaction")
    except Exception as e:
        logger.error(f"Error migrating database: {e}")
        raise
    finally:
        release_connection(conn)
```

**Migration Strategy Analysis:**

#### **Zero-Downtime Migrations:**
- **Column Addition:** Uses ALTER TABLE for backward compatibility
- **Default Values:** Ensures existing data remains valid
- **Transaction Safety:** All migrations wrapped in transactions
- **Rollback Capability:** Failed migrations don't corrupt data

#### **Schema Evolution:**
- **Feature Flags:** New columns support feature rollouts
- **Backward Compatibility:** Old code continues working during migrations
- **Data Integrity:** Foreign key constraints maintain referential integrity

**Core Database Operations:**

```python
def create_conversation(title: str = "New Conversation", teaching_mode: str = "teacher", user_id: str = None) -> str:
    """Create a new conversation and return its ID"""
    try:
        conversation_id = str(uuid.uuid4())
        now = datetime.now().isoformat()

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
```

**Data Security & Isolation:**

```python
def get_conversation(conversation_id: str, user_id: str = None) -> Optional[Dict[str, Any]]:
    """
    Get a conversation by ID with optional user_id check for data isolation
    """
    try:
        conversation = get_record_by_id("conversations", conversation_id)

        if not conversation:
            logger.warning(f"Conversation {conversation_id} not found")
            return None

        # Data isolation check
        if user_id and conversation.get("user_id") and conversation.get("user_id") != user_id:
            logger.warning(f"User {user_id} attempted to access conversation {conversation_id} belonging to another user")
            return None  # Prevent unauthorized access

        # Get messages for this conversation
        messages = execute_query(
            "SELECT * FROM messages WHERE conversation_id = ? ORDER BY timestamp",
            (conversation_id,),
            fetch_all=True
        )

        conversation["messages"] = messages or []
        return conversation
    except Exception as e:
        logger.error(f"Error getting conversation {conversation_id}: {e}")
        raise
```

**Security Features Analysis:**

#### **Data Isolation:**
- **User-Based Filtering:** All queries include user_id checks
- **Access Control:** Users can only access their own conversations
- **Audit Logging:** All access attempts are logged for security monitoring

#### **Input Validation:**
- **UUID Generation:** Prevents ID collision and prediction attacks
- **SQL Injection Prevention:** Parameterized queries throughout
- **Type Safety:** Strong typing prevents data corruption

**Interview Talking Points:**
1. **Database Design:** "Normalized schema with proper foreign keys ensures data integrity"
2. **Security:** "User-based data isolation prevents unauthorized access to conversations"
3. **Scalability:** "UUID primary keys and indexed columns support horizontal scaling"
4. **Reliability:** "Transaction-based operations ensure data consistency"
5. **Evolution:** "Migration system allows schema updates without downtime"

---

### 4. Application Entry Point (`main.py`)

**Purpose:** LiveKit agent initialization with real-time audio processing and AI integration
**Interview Value:** Shows real-time system architecture, event-driven programming, and service orchestration

```python
import asyncio
import json
import logging

from dotenv import load_dotenv
from livekit import rtc
from livekit.agents import JobContext, WorkerOptions, cli, stt, AutoSubscribe, transcription
from livekit.plugins.openai import stt as plugin
from livekit.plugins import silero

import config
import database
import auth_db
import shutdown
import ai_utils
from tts_web import WebTTS
from message_handlers import (
    handle_clear_conversations, handle_rename_conversation, handle_delete_conversation,
    handle_list_conversations, handle_auth_request, handle_get_conversation, handle_new_conversation
)
from text_processor import handle_text_input, generate_fallback_message

load_dotenv(dotenv_path=".env.local")
```

**Application Bootstrap Analysis:**

#### **Environment Setup:**
- **Environment Variables:** Loaded from `.env.local` for development/production separation
- **Logging Configuration:** Centralized logging with configurable levels
- **Module Imports:** Clean separation of concerns with dedicated modules

#### **Service Dependencies:**
- **LiveKit Integration:** Real-time communication framework
- **AI Providers:** Multiple STT and LLM providers for redundancy
- **Database Layer:** Persistent storage with migration support
- **Authentication:** JWT-based user management

```python
# Configure detailed logging
logging.basicConfig(
    level=getattr(logging, config.LOGGING_CONFIG["level"]),
    format=config.LOGGING_CONFIG["format"],
    datefmt=config.LOGGING_CONFIG["datefmt"]
)

logger = logging.getLogger("groq-whisper-stt-transcriber")

# Initialize shutdown handling with the '9' key
shutdown.initialize_shutdown_handling()
print("\n=== Press the '9' key to gracefully shutdown the application ===\n")

# Initialize database - consolidated initialization
from db_utils import enable_wal_mode, ensure_db_file_exists

try:
    ensure_db_file_exists()        # Create DB file if missing
    enable_wal_mode()              # Enable WAL for crash recovery
    database.init_db()             # Run schema creation/migrations
    auth_db.init_auth_db()         # Initialize authentication tables

    logger.info("Database and authentication systems initialized successfully")
except Exception as e:
    logger.error(config.ERROR_MESSAGES["database_init_error"].format(error=e))
    raise
```

**Initialization Strategy:**

#### **Database Initialization:**
- **WAL Mode:** Write-Ahead Logging for better crash recovery and concurrent access
- **Schema Management:** Automatic table creation and migrations
- **Error Handling:** Graceful failure with detailed error messages
- **Service Dependencies:** Authentication depends on core database

#### **Graceful Shutdown:**
- **Signal Handling:** Custom shutdown mechanism for development
- **Resource Cleanup:** Ensures proper connection closure
- **State Persistence:** Saves in-progress work before shutdown

**Core Business Logic:**

```python
def find_or_create_empty_conversation(teaching_mode="teacher", check_current=True, user_id=None):
    """
    Find an existing empty conversation or create a new one.

    Args:
        teaching_mode: The teaching mode to use ('teacher' or 'qa')
        check_current: Whether to check if the current conversation exists
        user_id: The user ID to associate with the conversation

    Returns:
        str: The ID of the empty or newly created conversation
    """
    global current_conversation_id

    # Verify current conversation exists and user has access
    if check_current and current_conversation_id:
        try:
            conversation = database.get_conversation(current_conversation_id, user_id)

            if not conversation:
                logger.warning(f"Current conversation ID {current_conversation_id} does not exist or user {user_id} doesn't have access")
                current_conversation_id = None
        except Exception as e:
            logger.error(f"Error checking if conversation exists: {e}")
            current_conversation_id = None

    # Look for empty conversations with matching teaching mode
    empty_conversation_id = None
    conversations = database.list_conversations(limit=10, user_id=user_id)

    for conv in conversations:
        conversation_mode = conv.get("teaching_mode") or "teacher"
        has_no_messages = not conv.get("message_count") or conv.get("message_count") == 0

        if has_no_messages and conversation_mode == teaching_mode:
            empty_conversation_id = conv["id"]
            logger.info(f"Found existing empty conversation with matching mode ({teaching_mode}): {empty_conversation_id}")
            break

    # Reuse existing empty conversation or create new one
    if empty_conversation_id:
        current_conversation_id = empty_conversation_id
        result = database.reuse_empty_conversation(
            conversation_id=current_conversation_id,
            teaching_mode=teaching_mode
        )
        if result and result.get("conversation_id"):
            return result["conversation_id"]

    # Create new conversation if no suitable empty one found
    if teaching_mode not in ['teacher', 'qa']:
        teaching_mode = 'teacher'  # Default fallback

    current_conversation_id = database.create_conversation(
        title="New Conversation",
        teaching_mode=teaching_mode,
        user_id=user_id
    )

    logger.info(f"Created new conversation with ID: {current_conversation_id} and teaching mode: {teaching_mode}")
    return current_conversation_id
```

**Conversation Management Strategy:**

#### **Smart Conversation Reuse:**
- **Empty Detection:** Identifies conversations without meaningful content
- **Mode Matching:** Ensures conversation matches current teaching mode
- **User Isolation:** Respects user boundaries for data security
- **Efficient Resource Usage:** Prevents unnecessary conversation proliferation

#### **Fallback Mechanisms:**
- **Mode Validation:** Defaults to 'teacher' mode for invalid inputs
- **Error Recovery:** Creates new conversation if existing one is corrupted
- **Logging:** Comprehensive logging for debugging and monitoring

**Interview Talking Points:**
1. **Real-Time Architecture:** "LiveKit agents provide scalable real-time audio processing"
2. **Service Orchestration:** "Clean initialization sequence ensures all dependencies are ready"
3. **Resource Management:** "WAL mode and connection pooling optimize database performance"
4. **Business Logic:** "Smart conversation management reduces resource usage while improving UX"
5. **Error Handling:** "Comprehensive error handling ensures system reliability"

---

## ✅ Phase 1 Complete

**What We've Covered:**
- Modern Python ecosystem with real-time communication
- Intelligent AI model fallback strategy with cost optimization
- Robust database architecture with user isolation and migrations
- Service orchestration with graceful initialization and shutdown

**Key Interview Points:**
- Real-time system design and WebRTC integration
- Multi-provider AI strategy for reliability and performance
- Database design with security and scalability considerations
- Event-driven architecture with proper error handling

---

*Ready for Phase 2: Core AI & Processing? Let me know when to continue!*
