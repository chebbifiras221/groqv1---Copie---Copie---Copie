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
MAX_MESSAGE_LENGTH = 4000
MAX_CONVERSATION_HISTORY = 15  # Keep last 15 messages + system prompt
CONVERSATION_LIST_LIMIT = 20

# AI Model Configuration
AI_MODELS = [
    {"name": "llama-3.3-70b-versatile", "temperature": 0.6, "description": "Llama 3.3 70B Versatile"},
    {"name": "llama3-70b-8192", "temperature": 0.6, "description": "Llama 3 70B"}
]

# AI Request Parameters
AI_REQUEST_PARAMS = {
    "max_tokens": 1024,
    "top_p": 0.9,  # More focused on likely responses (good for factual teaching)
    "frequency_penalty": 0.2,  # Slightly reduce repetition
    "presence_penalty": 0.1  # Slightly encourage topic diversity
}

# TTS Configuration
TTS_DEFAULT_VOICE = "Web Voice"

# Retry Configuration
DEFAULT_MAX_RETRIES = 3
DEFAULT_RETRY_DELAY = 0.5

# Speech-to-Text Configuration
STT_CONFIG = {
    "min_silence_duration": 1.0,  # Increased from 0.2 to allow for natural pauses in speech
    "min_speech_duration": 0.1,   # Minimum duration to consider as speech
    "prefix_padding_duration": 0.5  # Add padding to the beginning of speech segments
}

# Self-introduction patterns to remove from AI responses
SELF_INTRO_PATTERNS = [
    r"^I('m| am) [^.!?]*\.",  # Matches "I'm [name]" or "I am [description]"
    r"^My name is [^.!?]*\.",
    r"^I('m| am) (a|your|an) [^.!?]*\.",  # Matches "I'm a professor" or "I'm your teacher"
    r"^I('ll| will) be [^.!?]*\.",  # Matches "I'll be your guide"
    r"^As (a|an|your) [^.!?]*\.",  # Matches "As a professor, I..."
]

# Teaching Modes
TEACHING_MODES = ["teacher", "qa"]
DEFAULT_TEACHING_MODE = "teacher"

# Logging Configuration
LOGGING_CONFIG = {
    "level": "INFO",
    "format": "%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    "datefmt": "%Y-%m-%d %H:%M:%S"
}

# Error Messages
ERROR_MESSAGES = {
    "api_key_missing": "Error: API key not configured. Please set GROQ_API_KEY in .env.local file.",
    "conversation_not_found": "Conversation {conversation_id} does not exist",
    "no_conversation_id": "Cannot send AI response: No valid conversation ID",
    "all_models_failed": "Error generating response: All models failed. Last error: {error}",
    "tts_init_failed": "TTS engine initialization failed, speech synthesis will not be available",
    "tts_synthesis_failed": "Failed to generate audio data",
    "database_init_error": "Error during database initialization: {error}"
}

def get_model_description(model_name: str) -> str:
    """Get human-readable description for a model name."""
    for model in AI_MODELS:
        if model["name"] == model_name:
            return model["description"]
    return model_name

def validate_teaching_mode(mode: str) -> str:
    """Validate and return a valid teaching mode."""
    return mode if mode in TEACHING_MODES else DEFAULT_TEACHING_MODE

def get_ai_request_data(model_name: str, conversation_history: List[Dict[str, Any]], temperature: float = None) -> Dict[str, Any]:
    """Build AI request data with consistent parameters."""
    model_temp = temperature
    if model_temp is None:
        # Find temperature from model config
        for model in AI_MODELS:
            if model["name"] == model_name:
                model_temp = model["temperature"]
                break
        if model_temp is None:
            model_temp = 0.6  # Default fallback
    
    return {
        "model": model_name,
        "messages": conversation_history,
        "temperature": model_temp,
        **AI_REQUEST_PARAMS
    }
