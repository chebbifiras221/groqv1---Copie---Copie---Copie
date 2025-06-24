"""
Configuration module for the AI Teaching Assistant application.
This module centralizes all configuration constants and settings to provide
a single source of truth for application behavior and external service integration.
"""

import os
from typing import Dict, Any, List

# API Configuration for external service integration
GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"  # Groq API endpoint for chat completions
GROQ_API_KEY = os.getenv("GROQ_API_KEY")  # API key loaded from environment variable for security

# Database Configuration for local data storage
DB_FILE_NAME = "conversations.db"  # SQLite database filename for conversation persistence

# Message Processing Configuration for content management
MAX_MESSAGE_LENGTH = 50000   # Maximum character length for individual messages to prevent UI/TTS issues
MAX_CONVERSATION_HISTORY = 15  # Keep last 15 messages + system prompt to stay within API token limits
CONVERSATION_LIST_LIMIT = 20   # Maximum number of conversations to return in list operations

# AI Model Configuration with fallback chain for reliability
# Simplified 3-model fallback chain for reliability and speed
# Models are ordered by preference: highest quality first, fastest fallback last
AI_MODELS = [
    # Primary model (70B parameters - highest quality responses)
    # Best for complex explanations and detailed teaching content
    {"name": "llama-3.3-70b-versatile", "temperature": 0.6, "description": "Llama 3.3 70B Versatile"},

    # Secondary model (8B parameters - good balance of speed and quality)
    # Faster responses while maintaining good educational content quality
    {"name": "llama-3.1-8b-instant", "temperature": 0.6, "description": "Llama 3.1 8B Instant"},

    # Fallback model (3B parameters - fast and reliable)
    # Fastest responses for when primary models are unavailable
    {"name": "llama-3.2-3b-preview", "temperature": 0.7, "description": "Llama 3.2 3B Preview"}
]

# AI Request Parameters for controlling response generation behavior
AI_REQUEST_PARAMS = {
    "max_tokens": 2048,          # Increased to allow longer responses when needed for detailed explanations
    "top_p": 0.9,               # More focused on likely responses (good for factual teaching content)
    "frequency_penalty": 0.2,    # Slightly reduce repetition to improve response quality
    "presence_penalty": 0.1      # Slightly encourage topic diversity within responses
}

# TTS Configuration
TTS_DEFAULT_VOICE = "Web Voice"

# Retry Configuration
DEFAULT_MAX_RETRIES = 3
DEFAULT_RETRY_DELAY = 0.5

# AI Request Configuration
AI_REQUEST_TIMEOUT = (10, 30)  # (connection timeout, read timeout) in seconds
AI_MODEL_RETRY_COUNT = 2  # Number of retries per model
AI_MODEL_SWITCH_DELAY = 1.0  # Delay between trying different models

# Temperature Strategy Explanation:
# - 70B models: 0.6 (balanced, high quality responses)
# - 8B models: 0.6 (maintain consistency with primary models)
# - 3B models: 0.7 (slightly higher to compensate for smaller model limitations)

# Speech-to-Text Configuration for voice input processing
STT_CONFIG = {
    "min_silence_duration": 1.0,    # Increased from 0.2 to allow for natural pauses in speech without cutting off
    "min_speech_duration": 0.1,     # Minimum duration in seconds to consider audio as valid speech input
    "prefix_padding_duration": 0.5  # Add padding in seconds to the beginning of speech segments for better recognition
}

# Teaching Modes configuration for AI behavior and response style
TEACHING_MODES = ["teacher", "qa"]  # Supported modes: "teacher" for structured teaching, "qa" for direct Q&A
DEFAULT_TEACHING_MODE = "teacher"   # Default mode for new conversations and fallback scenarios

# Logging Configuration for application monitoring and debugging
LOGGING_CONFIG = {
    "level": "INFO",                                                    # Log level: INFO, DEBUG, WARNING, ERROR
    "format": "%(asctime)s [%(levelname)s] %(name)s: %(message)s",     # Log message format with timestamp and level
    "datefmt": "%Y-%m-%d %H:%M:%S"                                     # Date format for log timestamps
}

# Error Messages for consistent user-facing and system error handling
ERROR_MESSAGES = {
    "api_key_missing": "Error: API key not configured. Please set GROQ_API_KEY in .env.local file.",  # Missing API key error
    "conversation_not_found": "Conversation {conversation_id} does not exist",                         # Invalid conversation ID error
    "no_conversation_id": "Cannot send AI response: No valid conversation ID",                        # Missing conversation context error
    "all_models_failed": "Error generating response: All models failed. Last error: {error}",        # All AI models failed error
    "tts_init_failed": "TTS engine initialization failed, speech synthesis will not be available",   # TTS initialization failure
    "tts_synthesis_failed": "Failed to generate audio data",                                         # TTS synthesis failure
    "database_init_error": "Error during database initialization: {error}"                          # Database setup failure
}

def get_ai_request_data(model_name: str, conversation_history: List[Dict[str, Any]], temperature: float = None) -> Dict[str, Any]:
    """
    Build AI request data with consistent parameters for API calls.

    This function creates the request payload for AI API calls by combining the model name,
    conversation history, and temperature with the standard request parameters. It handles
    temperature fallback logic to ensure each model uses its configured temperature.

    Args:
        model_name (str): The specific AI model to use for the request (e.g., "llama-3.3-70b-versatile")
        conversation_history (List[Dict[str, Any]]): Formatted conversation messages for the API
        temperature (float, optional): Override temperature for this request. If None, uses model's configured temperature

    Returns:
        Dict[str, Any]: Complete request payload ready for API submission including model, messages, and parameters
    """
    # Start with the provided temperature or None
    model_temp = temperature

    # If no temperature provided, find it from model configuration
    if model_temp is None:
        # Find temperature from model config by searching the AI_MODELS list
        for model in AI_MODELS:
            if model["name"] == model_name:  # Match the model name
                model_temp = model["temperature"]  # Use the configured temperature for this model
                break  # Exit loop once found
        # If model not found in config, use default fallback temperature
        if model_temp is None:
            model_temp = 0.6  # Default fallback temperature for unknown models

    # Build and return the complete request data dictionary
    return {
        "model": model_name,                # The specific AI model to use
        "messages": conversation_history,   # The conversation context for the AI
        "temperature": model_temp,          # The creativity/randomness setting
        **AI_REQUEST_PARAMS                # Spread the additional request parameters (max_tokens, top_p, etc.)
    }
