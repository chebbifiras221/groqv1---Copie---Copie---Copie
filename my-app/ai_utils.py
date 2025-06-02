"""
AI utility functions for response processing and conversation management.
This module contains utilities for AI response generation and processing.
"""

import logging
import re
import requests
from typing import Dict, Any, List, Optional, Tuple

import config
import database
from ai_prompts import get_system_prompt

logger = logging.getLogger("ai-utils")


def extract_conversation_context(conversation_id) -> Tuple[str, str, bool]:
    """
    Extract conversation context from the conversation_id parameter.

    Args:
        conversation_id: Can be a string ID or a dictionary with context

    Returns:
        Tuple of (actual_conversation_id, teaching_mode, is_hidden)
    """
    # Default values
    actual_conversation_id = conversation_id
    teaching_mode = config.DEFAULT_TEACHING_MODE
    is_hidden = False

    # Check if conversation_id is a dictionary with additional context
    if isinstance(conversation_id, dict):
        # Extract teaching mode if provided
        if "teaching_mode" in conversation_id:
            teaching_mode = conversation_id["teaching_mode"]

        # Extract actual conversation ID
        if "conversation_id" in conversation_id:
            actual_conversation_id = conversation_id["conversation_id"]

        # Check if this is a hidden instruction
        if "is_hidden" in conversation_id:
            is_hidden = conversation_id["is_hidden"]

    # Validate teaching mode
    teaching_mode = config.validate_teaching_mode(teaching_mode)

    return actual_conversation_id, teaching_mode, is_hidden


def prepare_conversation_history(messages: List[Dict[str, Any]], teaching_mode: str) -> List[Dict[str, Any]]:
    """
    Prepare conversation history for the AI model.

    Args:
        messages: List of message objects from the database
        teaching_mode: The teaching mode to use ('teacher' or 'qa')

    Returns:
        List of message objects formatted for the Groq API
    """
    # Get the appropriate system prompt based on the teaching mode
    system_prompt = get_system_prompt(teaching_mode)

    # Start with the system message
    conversation_history = [system_prompt]

    # Add the conversation history
    for msg in messages:
        role = "user" if msg["type"] == "user" else "assistant"
        conversation_history.append({"role": role, "content": msg["content"]})

    # Keep only the last N messages to avoid token limits, but always keep the system prompt
    max_messages = config.MAX_CONVERSATION_HISTORY + 1  # +1 for system prompt
    if len(conversation_history) > max_messages:
        conversation_history = [conversation_history[0]] + conversation_history[-config.MAX_CONVERSATION_HISTORY:]

    return conversation_history


def clean_ai_response(ai_response: str, is_first_message: bool) -> str:
    """
    Clean AI response by removing self-introductions and unwanted patterns.

    Args:
        ai_response: The raw AI response
        is_first_message: Whether this is the first AI message in the conversation

    Returns:
        Cleaned AI response
    """
    if not is_first_message:
        return ai_response

    # Only remove self-introductions with names, but allow friendly greetings
    cleaned_response = ai_response
    for pattern in config.SELF_INTRO_PATTERNS:
        cleaned_response = re.sub(pattern, "", cleaned_response, flags=re.IGNORECASE | re.MULTILINE)

    # Remove extra whitespace and newlines from the beginning
    cleaned_response = cleaned_response.lstrip()

    # Log if we removed something
    if cleaned_response != ai_response:
        logger.info("Removed self-introduction from first response")

    return cleaned_response


def make_ai_request(model_name: str, conversation_history: List[Dict[str, Any]], temperature: float = None) -> Tuple[bool, str]:
    """
    Make a request to the AI API.

    Args:
        model_name: Name of the model to use
        conversation_history: Prepared conversation history
        temperature: Optional temperature override

    Returns:
        Tuple of (success, response_or_error)
    """
    if not config.GROQ_API_KEY:
        return False, config.ERROR_MESSAGES["api_key_missing"]

    headers = {
        "Authorization": f"Bearer {config.GROQ_API_KEY}",
        "Content-Type": "application/json"
    }

    data = config.get_ai_request_data(model_name, conversation_history, temperature)

    try:
        logger.info(f"Making AI request with model: {model_name}")
        response = requests.post(config.GROQ_API_URL, headers=headers, json=data)
        response.raise_for_status()
        result = response.json()
        ai_response = result["choices"][0]["message"]["content"]
        return True, ai_response
    except Exception as e:
        logger.warning(f"Error using model {model_name}: {e}")
        return False, str(e)


def generate_ai_response_with_models(conversation_history: List[Dict[str, Any]]) -> str:
    """
    Try multiple AI models to generate a response.

    Args:
        conversation_history: Prepared conversation history

    Returns:
        AI response or error message
    """
    last_error = None

    # Try each model in sequence until one works
    for model_info in config.AI_MODELS:
        model_name = model_info["name"]
        temperature = model_info["temperature"]

        success, response = make_ai_request(model_name, conversation_history, temperature)
        if success:
            logger.info(f"Successfully generated response with model: {model_name}")
            return response
        else:
            last_error = response

    # If we get here, all models failed
    error_msg = config.ERROR_MESSAGES["all_models_failed"].format(error=last_error)
    logger.error(error_msg)
    return error_msg


def process_ai_response(ai_response: str, show_model_info: bool = False, model_name: str = None) -> str:
    """
    Process AI response by adding model info if requested.

    Args:
        ai_response: The AI response
        show_model_info: Whether to include model information
        model_name: Name of the model used

    Returns:
        Processed AI response
    """
    if show_model_info and model_name:
        model_description = config.get_model_description(model_name)
        return f"[Using {model_description}]\n\n{ai_response}"
    else:
        return ai_response


def should_split_response(response: str) -> bool:
    """
    Check if response should be split based on length.

    Args:
        response: The response to check

    Returns:
        True if response is too long, False otherwise
    """
    return len(response) > config.MAX_MESSAGE_LENGTH


def get_teaching_mode_from_db(conversation_id: str) -> str:
    """
    Get the teaching mode for a conversation from the database.

    Args:
        conversation_id: The ID of the conversation

    Returns:
        The teaching mode ('teacher' or 'qa'), defaults to 'teacher' if not found
    """
    if not conversation_id:
        return config.DEFAULT_TEACHING_MODE

    try:
        # Get the conversation from the database
        conversation = database.get_conversation(conversation_id)

        # If the conversation exists and has a teaching_mode, use it
        if conversation and "teaching_mode" in conversation and conversation["teaching_mode"]:
            teaching_mode = conversation["teaching_mode"]
            logger.info(f"Retrieved teaching mode from database: {teaching_mode}")
            return config.validate_teaching_mode(teaching_mode)
        else:
            logger.warning(f"No teaching mode found for conversation {conversation_id}, using default mode")
            return config.DEFAULT_TEACHING_MODE
    except Exception as e:
        logger.error(f"Error getting teaching mode from database: {e}")
        return config.DEFAULT_TEACHING_MODE
