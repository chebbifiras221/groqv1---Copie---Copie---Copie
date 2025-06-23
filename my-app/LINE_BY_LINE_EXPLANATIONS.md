# Line-by-Line Function Explanations

This document provides detailed, line-by-line explanations of the most important functions in the AI Teaching Assistant application.

## Table of Contents

1. [find_or_create_empty_conversation() - Line by Line](#find_or_create_empty_conversation)
2. [synthesize_speech() - Line by Line](#synthesize_speech)
3. [handle_text_input() - Line by Line](#handle_text_input)
4. [validate_question_topic() - Line by Line](#validate_question_topic)

---

## find_or_create_empty_conversation()

### Function Signature
```python
def find_or_create_empty_conversation(teaching_mode="teacher", check_current=True, user_id=None):
```

### Line-by-Line Breakdown

**Line 1: Function Definition**
- `teaching_mode="teacher"`: Default parameter sets teaching mode to "teacher" if not specified
- `check_current=True`: Default parameter enables validation of current conversation
- `user_id=None`: Default parameter for user identification, None means no user association

**Line 2: Global Variable Declaration**
```python
global current_conversation_id
```
- Declares access to the global variable that tracks the active conversation across the application
- This variable persists between function calls and maintains conversation state

**Lines 3-4: Current Conversation Validation Check**
```python
if check_current and current_conversation_id:
```
- `check_current`: Boolean flag determining whether to validate existing conversation
- `current_conversation_id`: Global variable containing the UUID of the active conversation
- Combined condition: Only validate if both check is enabled AND a conversation ID exists

**Lines 5-6: Database Conversation Retrieval**
```python
try:
    conversation = database.get_conversation(current_conversation_id, user_id)
```
- `database.get_conversation()`: Function that retrieves conversation data from SQLite database
- `current_conversation_id`: The UUID string used as primary key for database lookup
- `user_id`: Used for access control to ensure users only access their own conversations
- `conversation`: Returns dictionary with conversation data or None if not found/accessible

**Lines 7-9: Conversation Existence Validation**
```python
if not conversation:
    logger.warning(f"Current conversation ID {current_conversation_id} does not exist or user {user_id} doesn't have access, will create a new one")
    current_conversation_id = None
```
- `not conversation`: Checks if conversation is None (doesn't exist or no access)
- `logger.warning()`: Logs warning message for debugging and monitoring
- `current_conversation_id = None`: Resets global variable to trigger new conversation creation

**Lines 10-12: Exception Handling for Database Errors**
```python
except Exception as e:
    logger.error(f"Error checking if conversation exists: {e}")
    current_conversation_id = None
```
- `Exception as e`: Catches any database or network errors during conversation retrieval
- `logger.error()`: Logs error with specific exception details for debugging
- `current_conversation_id = None`: Resets to None to ensure clean state after error

**Lines 13-15: Empty Conversation Search Initialization**
```python
empty_conversation_id = None
conversations = database.list_conversations(limit=10, user_id=user_id)
```
- `empty_conversation_id = None`: Initialize variable to store found empty conversation ID
- `database.list_conversations()`: Retrieves list of recent conversations from database
- `limit=10`: Limits query to 10 most recent conversations for performance
- `user_id=user_id`: Filters conversations to only those belonging to the specified user

**Lines 16-17: Conversation Iteration Loop**
```python
for conv in conversations:
```
- `conv`: Dictionary representing a single conversation record from database
- Contains fields like 'id', 'teaching_mode', 'message_count', 'title', etc.

**Lines 18-19: Teaching Mode and Message Count Extraction**
```python
conversation_mode = conv.get("teaching_mode") or "teacher"
has_no_messages = not conv.get("message_count") or conv.get("message_count") == 0
```
- `conv.get("teaching_mode")`: Safely extracts teaching mode, returns None if missing
- `or "teacher"`: Provides fallback value for backward compatibility with old conversations
- `conv.get("message_count")`: Safely extracts message count, returns None if missing
- `not conv.get("message_count")`: True if message_count is None or falsy
- `conv.get("message_count") == 0`: True if message_count is explicitly zero
- Combined logic handles both missing and zero message counts as "empty"

**Lines 20-23: Empty Conversation Matching Logic**
```python
if has_no_messages and conversation_mode == teaching_mode:
    empty_conversation_id = conv["id"]
    logger.info(f"Found existing empty conversation with matching mode ({teaching_mode}): {empty_conversation_id} for user: {user_id}")
    break
```
- `has_no_messages and conversation_mode == teaching_mode`: Both conditions must be true
- `conv["id"]`: Extracts the conversation UUID for reuse
- `logger.info()`: Logs successful discovery of reusable conversation
- `break`: Exits loop immediately since we found a suitable conversation

**Lines 24-26: Empty Conversation Reuse Logic**
```python
if empty_conversation_id:
    current_conversation_id = empty_conversation_id
    logger.info(f"Using existing empty conversation: {current_conversation_id}")
```
- `if empty_conversation_id`: Checks if we found a reusable conversation
- `current_conversation_id = empty_conversation_id`: Updates global variable to use found conversation
- `logger.info()`: Logs the decision to reuse existing conversation

**Lines 27-30: Conversation Reuse Database Update**
```python
try:
    result = database.reuse_empty_conversation(
        conversation_id=current_conversation_id,
        teaching_mode=teaching_mode
    )
```
- `database.reuse_empty_conversation()`: Updates conversation timestamp and teaching mode
- `conversation_id=current_conversation_id`: Specifies which conversation to update
- `teaching_mode=teaching_mode`: Sets the teaching mode for the reused conversation
- `result`: Dictionary containing operation result and updated conversation data

**Lines 31-35: Reuse Success Validation**
```python
if result and result.get("conversation_id"):
    logger.info(f"Updated empty conversation with teaching mode: {teaching_mode}")
    return result["conversation_id"]
else:
    logger.warning(f"Failed to reuse conversation {current_conversation_id}, will create new one")
```
- `result and result.get("conversation_id")`: Validates that reuse operation succeeded
- `return result["conversation_id"]`: Returns the successfully reused conversation ID
- `else`: Handles case where reuse operation failed
- Continues to new conversation creation as fallback

**Lines 36-38: Reuse Exception Handling**
```python
except Exception as e:
    logger.error(f"Error reusing empty conversation: {e}")
    # Continue to create a new conversation
```
- `Exception as e`: Catches any errors during conversation reuse
- `logger.error()`: Logs specific error details for debugging
- Comment indicates fallback to new conversation creation

**Lines 39-41: Teaching Mode Validation**
```python
if teaching_mode not in ['teacher', 'qa']:
    teaching_mode = 'teacher'
```
- `teaching_mode not in ['teacher', 'qa']`: Validates against allowed teaching modes
- `teaching_mode = 'teacher'`: Sets safe default for invalid teaching modes
- Ensures data integrity by preventing invalid modes in database

**Lines 42-46: New Conversation Creation**
```python
current_conversation_id = database.create_conversation(
    title="New Conversation",
    teaching_mode=teaching_mode,
    user_id=user_id
)
```
- `database.create_conversation()`: Creates new conversation record in database
- `title="New Conversation"`: Default title that will be updated when first message is added
- `teaching_mode=teaching_mode`: Uses validated teaching mode
- `user_id=user_id`: Associates conversation with specific user for access control
- Returns UUID string of newly created conversation

**Lines 47-49: Creation Success Logging and Return**
```python
logger.info(f"Created new conversation with ID: {current_conversation_id} and teaching mode: {teaching_mode} for user: {user_id}")
return current_conversation_id
```
- `logger.info()`: Logs successful creation with all relevant details
- `return current_conversation_id`: Returns the UUID of the created conversation
- This ID is used by calling functions for subsequent operations

---

## synthesize_speech()

### Function Signature
```python
async def synthesize_speech(text, room, voice_name=None):
```

### Line-by-Line Breakdown

**Line 1: Async Function Definition**
- `async def`: Declares asynchronous function that can use await and be awaited
- `text`: String containing the text to convert to speech
- `room`: LiveKit room object for sending audio data to participants
- `voice_name=None`: Optional voice identifier, uses default if not specified

**Line 2: Global Variable Access**
```python
global tts_engine
```
- Accesses the global TTS engine instance shared across the application
- This engine is initialized once and reused for all speech synthesis requests

**Lines 3-6: Provider Name Helper Function**
```python
def get_provider_name():
    return "fallback" if hasattr(tts_engine, 'use_fallback') and tts_engine.use_fallback else "web"
```
- `hasattr(tts_engine, 'use_fallback')`: Checks if engine has fallback attribute
- `tts_engine.use_fallback`: Boolean indicating if engine is using fallback mode
- Returns "fallback" for degraded mode, "web" for normal operation
- Used in status messages to inform clients about TTS provider

**Lines 7-16: Error Message Helper Function**
```python
async def send_error(message):
    try:
        error_message = {
            "type": "tts_error",
            "message": message
        }
        await room.local_participant.publish_data(json.dumps(error_message).encode())
    except Exception as publish_error:
        logger.error(f"Error sending error message: {publish_error}")
    return False
```
- `async def send_error()`: Nested async function for sending error messages to client
- `error_message`: Structured dictionary with error type and message
- `room.local_participant.publish_data()`: Sends data through LiveKit data channel
- `json.dumps().encode()`: Converts dictionary to JSON string then to bytes
- Exception handling prevents errors during error message sending
- `return False`: Always returns False to indicate synthesis failure

**Lines 17-22: TTS Engine Initialization Check**
```python
if not tts_engine:
    logger.warning("TTS engine not initialized, attempting to initialize now...")
    if initialize_tts():
        logger.info("TTS engine initialized successfully on demand")
    else:
        logger.error("TTS engine initialization failed, cannot synthesize speech")
        return await send_error("Failed to initialize TTS engine")
```
- `if not tts_engine`: Checks if global TTS engine is None or falsy
- `logger.warning()`: Logs attempt to initialize engine on demand
- `initialize_tts()`: Function that sets up and tests TTS engine
- Returns True if successful, False if initialization fails
- `return await send_error()`: Sends error to client and returns False if init fails

**Lines 23-27: Provider and Voice Configuration**
```python
try:
    provider = get_provider_name()
    voice = voice_name or (tts_engine.default_voice_name if hasattr(tts_engine, 'default_voice_name') else config.TTS_DEFAULT_VOICE)
```
- `provider = get_provider_name()`: Gets current TTS provider ("web" or "fallback")
- `voice_name or (...)`: Uses provided voice_name if available, otherwise falls back
- `hasattr(tts_engine, 'default_voice_name')`: Checks if engine has default voice
- `tts_engine.default_voice_name`: Engine-specific default voice
- `config.TTS_DEFAULT_VOICE`: Application-wide default voice fallback
- Creates fallback chain: parameter → engine default → config default

**Lines 28-34: TTS Start Notification**
```python
tts_start_message = {
    "type": "tts_starting",
    "text": text[:100] + ("..." if len(text) > 100 else ""),
    "provider": provider,
    "voice": voice
}
await safe_publish_data(room.local_participant, json.dumps(tts_start_message).encode())
```
- `tts_start_message`: Dictionary containing TTS start notification data
- `"type": "tts_starting"`: Message type for client-side routing and handling
- `text[:100]`: Truncates text to first 100 characters for preview
- `("..." if len(text) > 100 else "")`: Adds ellipsis if text was truncated
- `"provider": provider`: Tells client which TTS provider is being used
- `"voice": voice`: Tells client which voice is being used
- `safe_publish_data()`: Function with retry logic for reliable message delivery
- `json.dumps().encode()`: Converts dictionary to JSON bytes for transmission

**Lines 35-36: Synthesis Logging and Execution**
```python
logger.info(f"Synthesizing speech with {provider.capitalize()} TTS: {text[:50]}...")
audio_data = tts_engine.synthesize(text, voice_name=voice_name)
```
- `logger.info()`: Logs synthesis start with provider and truncated text
- `provider.capitalize()`: Capitalizes provider name for readable logging
- `text[:50]`: Shows first 50 characters of text being synthesized
- `tts_engine.synthesize()`: Core TTS function that converts text to audio
- `voice_name=voice_name`: Passes original voice parameter to engine
- `audio_data`: Contains generated audio (may be JSON message or binary data)

**Lines 37-40: Audio Data Validation**
```python
if not audio_data:
    logger.error("Failed to synthesize speech: No audio data generated")
    return await send_error(config.ERROR_MESSAGES["tts_synthesis_failed"])
```
- `if not audio_data`: Checks if synthesis returned None or empty data
- `logger.error()`: Logs synthesis failure for debugging
- `config.ERROR_MESSAGES["tts_synthesis_failed"]`: Gets configured error message
- `return await send_error()`: Sends error to client and exits function

**Lines 41-42: Success Logging**
```python
logger.info(f"Audio data generated, size: {len(audio_data)} bytes")
```
- `len(audio_data)`: Gets size of generated audio data in bytes
- Useful for monitoring and debugging audio generation performance

**Lines 43-49: Voice Information Message**
```python
voice_info = {
    "type": "voice_info",
    "voice": voice,
    "provider": provider
}
await safe_publish_data(room.local_participant, json.dumps(voice_info).encode())
logger.info("Published voice info message")
```
- `voice_info`: Dictionary containing voice metadata for client
- `"type": "voice_info"`: Message type for client voice information handling
- `"voice": voice`: The actual voice name used for synthesis
- `"provider": provider`: The TTS provider that generated the audio
- Helps client display voice information in UI
- `logger.info()`: Confirms successful voice info transmission

**Lines 50-52: Audio Format Detection Start**
```python
try:
    try:
        message_str = audio_data.decode('utf-8')
        message = json.loads(message_str)
```
- Nested try blocks for different types of audio data handling
- `audio_data.decode('utf-8')`: Attempts to decode bytes as UTF-8 string
- `json.loads(message_str)`: Attempts to parse string as JSON
- If successful, audio_data contains a JSON message (web TTS format)
- If either fails, audio_data is binary audio data

**Lines 53-58: Web TTS Message Handling**
```python
if message.get('type') == 'web_tts':
    logger.info(f"Publishing web TTS message for text: {message.get('text', '')[:50]}...")
    await safe_publish_data(room.local_participant, audio_data)
else:
    await safe_publish_data(room.local_participant, audio_data)
```
- `message.get('type') == 'web_tts'`: Checks if this is a web TTS message
- `message.get('text', '')[:50]`: Gets truncated text from message for logging
- `await safe_publish_data()`: Sends audio data to client with retry logic
- Both branches send audio_data, but logging differs for web TTS messages

**Lines 59-62: Binary Audio Data Handling**
```python
except (UnicodeDecodeError, json.JSONDecodeError):
    await safe_publish_data(room.local_participant, audio_data)
```
- `UnicodeDecodeError`: Caught when audio_data is not valid UTF-8
- `json.JSONDecodeError`: Caught when decoded string is not valid JSON
- Both exceptions indicate audio_data is binary audio format
- `await safe_publish_data()`: Sends binary audio data to client

**Lines 63-64: Audio Publishing Success**
```python
logger.info(f"Published audio data, size: {len(audio_data)} bytes")
```
- Logs successful audio data transmission with size information
- Useful for monitoring and performance analysis

**Lines 65-68: Audio Publishing Error Handling**
```python
except Exception as e:
    logger.error(f"Error publishing audio data: {e}")
    return await send_error(f"Error publishing audio: {str(e)}")
```
- Catches any errors during audio data publishing
- `logger.error()`: Logs specific error details for debugging
- `str(e)`: Converts exception to string for error message
- `return await send_error()`: Sends error to client and exits function

**Lines 69-75: TTS Completion Notification**
```python
tts_complete_message = {
    "type": "tts_complete",
    "provider": provider,
    "voice": voice
}
await safe_publish_data(room.local_participant, json.dumps(tts_complete_message).encode())
```
- `tts_complete_message`: Dictionary containing completion notification
- `"type": "tts_complete"`: Message type for client completion handling
- Includes provider and voice information for client reference
- Allows client to update UI state and stop loading indicators

**Lines 76-78: Function Success Return**
```python
logger.info("Speech synthesis and transmission complete")
return True
```
- `logger.info()`: Logs successful completion of entire synthesis pipeline
- `return True`: Indicates successful synthesis and transmission to caller

**Lines 79-81: Top-Level Exception Handling**
```python
except Exception as e:
    logger.error(f"Error in speech synthesis: {e}")
    return await send_error(f"Speech synthesis error: {str(e)}")
```
- Catches any unexpected errors in the synthesis pipeline
- `logger.error()`: Logs error with specific exception details
- `return await send_error()`: Sends error to client and returns False

This detailed breakdown explains every line of the synthesize_speech function, showing how it handles TTS engine initialization, audio generation, format detection, client communication, and comprehensive error handling.
