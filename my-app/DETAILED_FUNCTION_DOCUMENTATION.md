# Detailed Function Documentation

This document provides comprehensive line-by-line explanations of the key functions in the AI Teaching Assistant application. Each function has been thoroughly documented with detailed docstrings and inline comments.

## Table of Contents

1. [Main Application Functions (main.py)](#main-application-functions)
2. [AI Utilities (ai_utils.py)](#ai-utilities)
3. [Text Processing (text_processor.py)](#text-processing)
4. [Topic Validation (topic_validator.py)](#topic-validation)
5. [Message Handlers (message_handlers.py)](#message-handlers)
6. [Database Operations (database.py)](#database-operations)

## Main Application Functions

### `find_or_create_empty_conversation()`

**Purpose**: Manages conversation lifecycle by finding existing empty conversations or creating new ones.

**Key Logic Flow**:
1. **Global Variable Access**: Accesses `current_conversation_id` to track the active conversation
2. **Current Conversation Validation**: Checks if the current conversation still exists and is accessible
3. **Empty Conversation Search**: Iterates through recent conversations to find empty ones with matching teaching mode
4. **Conversation Reuse**: Updates timestamp and teaching mode of found empty conversations
5. **New Conversation Creation**: Creates a new conversation if no suitable empty one exists
6. **Teaching Mode Validation**: Ensures only valid teaching modes ('teacher' or 'qa') are used

**Critical Variables**:
- `current_conversation_id`: Global tracker for the active conversation
- `empty_conversation_id`: Stores ID of found reusable conversation
- `teaching_mode`: Determines AI behavior and response style
- `user_id`: Enables data isolation and access control

### `send_conversation_data()`

**Purpose**: Synchronizes conversation state between server and client.

**Key Logic Flow**:
1. **Input Validation**: Checks for valid conversation ID before proceeding
2. **Database Retrieval**: Fetches complete conversation data including messages
3. **Message Formatting**: Creates structured JSON message for client consumption
4. **Safe Transmission**: Uses retry logic to handle network issues during data transmission

**Critical Variables**:
- `conversation_data`: Structured message containing conversation and metadata
- `participant`: LiveKit participant object for data transmission

### `initialize_tts()`

**Purpose**: Sets up and validates the Text-to-Speech engine.

**Key Logic Flow**:
1. **Engine Initialization**: Creates WebTTS instance for speech synthesis
2. **Functionality Testing**: Performs test synthesis to verify engine works
3. **Fallback Detection**: Checks if engine is using fallback mechanisms
4. **Error Handling**: Gracefully handles initialization failures

**Critical Variables**:
- `tts_engine`: Global TTS engine instance used throughout application
- `test_audio`: Result of test synthesis to verify functionality

### `synthesize_speech()`

**Purpose**: Converts text to speech and transmits audio to clients.

**Key Logic Flow**:
1. **Engine Validation**: Ensures TTS engine is initialized and functional
2. **Status Notifications**: Sends start/complete messages to update client UI
3. **Audio Generation**: Converts text to audio using configured voice
4. **Format Detection**: Handles both JSON messages and binary audio data
5. **Safe Transmission**: Uses retry logic for reliable audio delivery
6. **Error Recovery**: Provides fallback messages when synthesis fails

**Critical Variables**:
- `provider`: Identifies which TTS provider is being used (web/fallback)
- `voice`: The specific voice name used for synthesis
- `audio_data`: Generated audio content (JSON or binary format)

## AI Utilities

### `validate_teaching_mode()`

**Purpose**: Ensures only valid teaching modes are used throughout the application.

**Key Logic Flow**:
1. **Mode Validation**: Checks input against configured valid modes
2. **Fallback Provision**: Returns default mode for invalid inputs
3. **Safety Guarantee**: Ensures returned value is always valid

**Critical Variables**:
- `teaching_mode`: Input mode to validate
- `config.TEACHING_MODES`: List of valid teaching modes
- `config.DEFAULT_TEACHING_MODE`: Fallback for invalid inputs

### `extract_conversation_context()`

**Purpose**: Parses conversation context from flexible input formats.

**Key Logic Flow**:
1. **Type Detection**: Determines if input is string ID or context dictionary
2. **Context Extraction**: Pulls teaching mode, conversation ID, and hidden flag
3. **Default Assignment**: Provides safe defaults for missing values
4. **Mode Validation**: Ensures teaching mode is valid before returning

**Critical Variables**:
- `actual_conversation_id`: The extracted conversation UUID
- `teaching_mode`: Validated teaching mode for AI behavior
- `is_hidden`: Flag for hidden instructions that don't appear in history

### `prepare_conversation_history()`

**Purpose**: Formats conversation data for AI model consumption.

**Key Logic Flow**:
1. **System Prompt Addition**: Adds appropriate system prompt based on teaching mode
2. **Message Transformation**: Converts database format to API format
3. **Role Mapping**: Maps 'user'/'ai' types to 'user'/'assistant' roles
4. **Length Management**: Truncates history to stay within token limits
5. **Context Preservation**: Keeps most recent messages while maintaining system prompt

**Critical Variables**:
- `system_prompt`: Teaching mode-specific instructions for AI behavior
- `conversation_history`: Final formatted message list for API
- `max_messages`: Token limit configuration including system prompt

## Text Processing

### `generate_fallback_message()`

**Purpose**: Provides consistent error messaging when AI response generation fails.

**Key Logic Flow**:
1. **Message Generation**: Returns standardized, user-friendly error message
2. **User Experience**: Maintains positive tone even during technical failures

### `handle_text_input()`

**Purpose**: Orchestrates the complete text processing pipeline from input to response.

**Key Logic Flow**:
1. **Input Processing**: Extracts user text and metadata from client message
2. **Conversation Management**: Creates new conversations when requested
3. **Message Echo**: Provides immediate feedback for non-hidden messages
4. **Context Retrieval**: Gathers recent conversation history for topic validation
5. **Topic Validation**: Checks if question is CS/programming related
6. **Rejection Handling**: Sends polite rejection for off-topic questions
7. **AI Response Generation**: Creates AI response using configured models
8. **Response Transmission**: Sends response to client with proper formatting
9. **UI Synchronization**: Updates conversation lists and data for client UI
10. **Audio Synthesis**: Converts response to speech for audio feedback

**Critical Variables**:
- `text_input`: The user's question or instruction
- `current_conversation_id`: Active conversation for message storage
- `conversation_history`: Recent messages for topic validation context
- `is_topic_valid`: Result of topic validation check
- `ai_response`: Generated response from AI models

## Topic Validation

### `api_based_validation()`

**Purpose**: Uses AI API to classify questions as CS/programming related or not.

**Key Logic Flow**:
1. **API Key Validation**: Checks if API key is available for requests
2. **Prompt Construction**: Creates binary classification prompt with clear instructions
3. **API Request**: Sends classification request with optimized parameters
4. **Response Processing**: Parses YES/NO response from AI model
5. **Error Handling**: Defaults to allowing questions when API fails

**Critical Variables**:
- `validation_prompt`: Structured prompt for binary classification
- `ai_response`: Raw response from classification model
- `headers`: Authentication headers for API request
- `data`: Request payload with model and parameters

### `validate_question_topic()`

**Purpose**: Main entry point for topic validation with context awareness.

**Key Logic Flow**:
1. **Input Validation**: Checks for minimum question length
2. **Context Detection**: Determines if conversation history is available
3. **Context Validation**: Uses conversation context for follow-up questions
4. **Fallback Validation**: Uses single-question validation for standalone questions
5. **Result Processing**: Returns validation decision with detailed reasoning

**Critical Variables**:
- `conversation_history`: Recent messages for context-aware validation
- `context_result`: Result of context-aware validation
- `api_result`: Result of single-question validation

## Function Interaction Patterns

### Conversation Lifecycle
1. `find_or_create_empty_conversation()` → `database.create_conversation()`
2. `handle_text_input()` → `generate_ai_response()` → `database.add_message()`
3. `send_conversation_data()` → `database.get_conversation()`

### Validation Pipeline
1. `handle_text_input()` → `validate_question_topic()`
2. `validate_question_topic()` → `api_based_validation()` or `api_context_validation()`
3. Topic rejection → immediate response without AI processing

### Response Generation
1. `generate_ai_response()` → `extract_conversation_context()`
2. `prepare_conversation_history()` → `get_system_prompt()`
3. `generate_ai_response_with_models()` → multiple AI model attempts

### Audio Processing
1. `synthesize_speech()` → `initialize_tts()` (if needed)
2. `tts_engine.synthesize()` → audio data generation
3. `safe_publish_data()` → client transmission with retry logic

## Detailed Variable Explanations

### Global Variables and Their Roles

#### `current_conversation_id` (main.py)
- **Type**: String (UUID) or None
- **Purpose**: Tracks the currently active conversation across the application
- **Lifecycle**: Set when conversations are created or switched, reset when invalid
- **Usage**: Referenced by multiple functions to maintain conversation context
- **Thread Safety**: Accessed within async context, requires careful handling

#### `tts_engine` (main.py)
- **Type**: WebTTS instance or None
- **Purpose**: Global Text-to-Speech engine for audio generation
- **Initialization**: Lazy initialization when first needed
- **Fallback Handling**: May use fallback mechanisms when primary TTS fails
- **Testing**: Validated with test synthesis during initialization

### Function-Specific Variable Analysis

#### `find_or_create_empty_conversation()` Variables

**`conversation_mode`**:
- **Source**: `conv.get("teaching_mode") or "teacher"`
- **Purpose**: Extracted teaching mode from database conversation record
- **Default Handling**: Falls back to "teacher" for backward compatibility
- **Validation**: Used in comparison with requested teaching mode

**`has_no_messages`**:
- **Source**: `not conv.get("message_count") or conv.get("message_count") == 0`
- **Purpose**: Boolean indicating if conversation is empty and reusable
- **Logic**: Handles both missing message_count and zero message_count
- **Importance**: Critical for conversation reuse logic

**`result`**:
- **Source**: `database.reuse_empty_conversation()`
- **Purpose**: Contains result of conversation reuse operation
- **Structure**: Dictionary with conversation_id and status information
- **Error Handling**: Checked for validity before using conversation_id

#### `synthesize_speech()` Variables

**`provider`**:
- **Source**: `get_provider_name()` helper function
- **Purpose**: Identifies TTS provider for status messages
- **Values**: "web" for primary TTS, "fallback" for degraded mode
- **Usage**: Included in client notifications for UI display

**`voice`**:
- **Source**: `voice_name or (tts_engine.default_voice_name if hasattr(tts_engine, 'default_voice_name') else config.TTS_DEFAULT_VOICE)`
- **Purpose**: Determines which voice to use for synthesis
- **Fallback Chain**: Parameter → engine default → config default
- **Validation**: Depends on TTS engine capabilities

**`audio_data`**:
- **Source**: `tts_engine.synthesize(text, voice_name=voice_name)`
- **Purpose**: Contains generated audio content
- **Format**: May be JSON message or binary audio data
- **Processing**: Requires format detection before transmission

#### `handle_text_input()` Variables

**`echo_message`**:
- **Structure**: `{"type": "user_message_echo", "text": text_input, "conversation_id": current_conversation_id}`
- **Purpose**: Provides immediate feedback to user that message was received
- **Conditional**: Only sent for non-hidden instructions
- **Client Handling**: Used by frontend to display user message immediately

**`conversation_history`**:
- **Source**: Recent messages from database conversation
- **Format**: List of dictionaries with 'type' and 'content' fields
- **Limit**: Last 6 messages for context validation
- **Purpose**: Provides context for topic validation decisions

**`context`**:
- **Structure**: `{"conversation_id": ..., "teaching_mode": ..., "is_hidden": ...}`
- **Purpose**: Packages all necessary information for AI response generation
- **Usage**: Passed to `generate_ai_response()` for proper context handling

#### `validate_question_topic()` Variables

**`context_result` and `api_result`**:
- **Type**: Boolean indicating validation success
- **Source**: Different validation methods (context-aware vs single-question)
- **Decision Logic**: Context validation takes precedence when available
- **Fallback**: Single-question validation used when no context available

**`context_reason` and `api_reason`**:
- **Type**: String explaining validation decision
- **Purpose**: Provides detailed logging and debugging information
- **Content**: Includes validation method and specific result details
- **Usage**: Combined with result boolean for comprehensive validation response

## Error Handling Patterns

### Database Error Handling
- **Pattern**: Try-catch blocks with logging and graceful degradation
- **Fallbacks**: Default values when database operations fail
- **User Impact**: Minimal - operations continue with safe defaults
- **Example**: Conversation creation falls back to new conversation when reuse fails

### API Error Handling
- **Pattern**: Multiple retry attempts with exponential backoff
- **Fallbacks**: Default to allowing questions when validation API fails
- **Timeout Handling**: Short timeouts for validation, longer for AI generation
- **User Experience**: Prioritizes availability over strict validation

### TTS Error Handling
- **Pattern**: Graceful degradation with user notification
- **Fallbacks**: Fallback TTS mechanisms when primary fails
- **Client Notification**: Error messages sent to client for UI handling
- **Recovery**: Automatic retry and re-initialization attempts

## Performance Considerations

### Async Operations
- **Database Queries**: Run in thread executor to avoid blocking event loop
- **API Requests**: Use appropriate timeouts to prevent hanging
- **Client Communication**: Retry logic for reliable message delivery

### Memory Management
- **Conversation History**: Limited to prevent excessive memory usage
- **Audio Data**: Processed and transmitted immediately, not stored
- **Connection Pooling**: Database connections managed efficiently

### Caching Strategies
- **TTS Engine**: Global instance reused across requests
- **System Prompts**: Cached based on teaching mode
- **Conversation Context**: Retrieved fresh for each request to ensure accuracy

This documentation provides the foundation for understanding how each function contributes to the overall application functionality and how they interact to create a seamless user experience.
