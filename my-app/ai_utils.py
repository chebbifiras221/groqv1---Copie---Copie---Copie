"""
AI utility functions for response processing and conversation management.
This module contains utilities for AI response generation and processing.
"""

import logging
import time
import requests
from typing import Dict, Any, List, Tuple

import config
import database
from ai_prompts import get_system_prompt

logger = logging.getLogger("ai-utils")


def validate_teaching_mode(teaching_mode: str) -> str:
    """
    Validate and normalize a teaching mode string to ensure it's a supported value.

    This function acts as a safety mechanism to prevent invalid teaching modes from
    being used throughout the application. It checks against the configured list
    of valid teaching modes and provides a safe fallback for invalid inputs.

    Args:
        teaching_mode (str): The teaching mode string to validate. Expected values are
                           'teacher' for structured teaching mode or 'qa' for question-answer
                           mode. Case-sensitive validation is performed. None, empty strings,
                           or any other values are considered invalid.

    Returns:
        str: A valid teaching mode string. Returns the input teaching_mode if it's valid,
             otherwise returns the default teaching mode from configuration (typically 'teacher').
             The returned value is guaranteed to be in config.TEACHING_MODES.

    """
    # Check if the provided teaching mode is in the list of valid modes
    if teaching_mode in config.TEACHING_MODES:
        return teaching_mode  # Return the valid teaching mode as-is
    # Return the default teaching mode for any invalid input
    return config.DEFAULT_TEACHING_MODE


def extract_conversation_context(conversation_id) -> Tuple[str, str, bool]:
    """
    Extract and validate conversation context from a flexible conversation_id parameter.

    This function handles both simple string conversation IDs and complex context dictionaries
    that contain additional metadata. It provides a unified interface for conversation context
    extraction throughout the application while ensuring all values are properly validated.

    Args:
        conversation_id (str or dict): Either a simple conversation ID string or a dictionary
                                     containing conversation context. If a dictionary, it may contain:
                                     - 'conversation_id': The actual conversation UUID string
                                     - 'teaching_mode': The teaching mode ('teacher' or 'qa')
                                     - 'is_hidden': Boolean indicating if this is a hidden instruction
                                     If a string, it's treated as the conversation ID with default context.

    Returns:
        Tuple[str, str, bool]: A tuple containing:
            - actual_conversation_id (str): The extracted conversation ID, or the original value
                                           if it was already a string
            - teaching_mode (str): The validated teaching mode ('teacher' or 'qa'), defaults
                                 to config.DEFAULT_TEACHING_MODE if not specified or invalid
            - is_hidden (bool): Whether this is a hidden instruction that shouldn't appear
                              in conversation history, defaults to False

    Example:
        >>> extract_conversation_context("conv-123")
        ('conv-123', 'teacher', False)
        >>> extract_conversation_context({"conversation_id": "conv-123", "teaching_mode": "qa", "is_hidden": True})
        ('conv-123', 'qa', True)
    """
    # Default values for all context parameters
    actual_conversation_id = conversation_id  # Use the input as-is initially
    teaching_mode = config.DEFAULT_TEACHING_MODE  # Default to configured teaching mode
    is_hidden = False  # Default to visible (not hidden) instructions

    # Check if conversation_id is a dictionary with additional context
    if isinstance(conversation_id, dict):
        # Extract teaching mode from dictionary, using default if not present
        teaching_mode = conversation_id.get("teaching_mode", teaching_mode)
        # Extract actual conversation ID from dictionary, using original if not present
        actual_conversation_id = conversation_id.get("conversation_id", actual_conversation_id)
        # Extract hidden flag from dictionary, using default if not present
        is_hidden = conversation_id.get("is_hidden", is_hidden)

    # Validate teaching mode to ensure it's a supported value
    teaching_mode = validate_teaching_mode(teaching_mode)

    return actual_conversation_id, teaching_mode, is_hidden


def prepare_conversation_history(messages: List[Dict[str, Any]], teaching_mode: str) -> List[Dict[str, Any]]:
    """
    Prepare and format conversation history for AI model consumption with proper system prompts.

    This function transforms database message objects into the format expected by the Groq API,
    adds the appropriate system prompt based on teaching mode, and manages conversation length
    to stay within token limits while preserving the most recent and relevant context.

    Args:
        messages (List[Dict[str, Any]]): List of message dictionaries from the database. Each
                                       message should contain 'type' ('user' or 'ai') and 'content'
                                       fields. Messages are expected to be in chronological order.
                                       Empty list is acceptable and will result in system prompt only.
        teaching_mode (str): The teaching mode that determines which system prompt to use.
                           Must be 'teacher' for structured teaching or 'qa' for question-answer
                           mode. Invalid modes will be handled by the get_system_prompt function.

    Returns:
        List[Dict[str, Any]]: A list of message dictionaries formatted for the Groq API with:
                             - First message: System prompt with role 'system'
                             - Subsequent messages: User/assistant messages with role 'user' or 'assistant'
                             - Limited to MAX_CONVERSATION_HISTORY + 1 messages total (including system prompt)
                             - Most recent messages are preserved when truncation is needed

    Example:
        >>> messages = [{"type": "user", "content": "Hello"}, {"type": "ai", "content": "Hi there!"}]
        >>> history = prepare_conversation_history(messages, "teacher")
        >>> len(history)  # System prompt + 2 messages
        3
    """
    # Get the appropriate system prompt based on the teaching mode
    # This determines the AI's behavior and response style
    system_prompt = get_system_prompt(teaching_mode)

    # Start with the system message as the first element
    # The system prompt must always be the first message in the conversation
    conversation_history = [system_prompt]

    # Add the conversation history by transforming database format to API format
    # Convert message type ('user'/'ai') to API role ('user'/'assistant')
    conversation_history.extend([
        {
            "role": "user" if msg["type"] == "user" else "assistant",  # Map message type to API role
            "content": msg["content"]  # Use message content as-is
        }
        for msg in messages  # Process all messages from the database
    ])

    # Keep only the last N messages to avoid token limits, but always keep the system prompt
    # This ensures we stay within API token limits while preserving recent context
    max_messages = config.MAX_CONVERSATION_HISTORY + 1  # +1 for system prompt
    if len(conversation_history) > max_messages:
        # Keep system prompt (first message) and the most recent conversation messages
        conversation_history = [conversation_history[0]] + conversation_history[-config.MAX_CONVERSATION_HISTORY:]

    return conversation_history

def make_ai_request(model_name: str, conversation_history: List[Dict[str, Any]], temperature: float = None, max_retries: int = None) -> Tuple[bool, str]:
    """
    Make a request to the AI API with retry logic and better error handling.

    Args:
        model_name: Name of the model to use
        conversation_history: Prepared conversation history
        temperature: Optional temperature override
        max_retries: Maximum number of retries for this specific model

    Returns:
        Tuple of (success, response_or_error)
    """
    if not config.GROQ_API_KEY:
        return False, config.ERROR_MESSAGES["api_key_missing"]

    max_retries = max_retries or config.AI_MODEL_RETRY_COUNT

    headers = {
        "Authorization": f"Bearer {config.GROQ_API_KEY}",
        "Content-Type": "application/json"
    }

    data = config.get_ai_request_data(model_name, conversation_history, temperature)

    for attempt in range(max_retries + 1):
        try:
            logger.info(f"Making AI request with model: {model_name} (attempt {attempt + 1}/{max_retries + 1})")

            # Add timeout to prevent hanging requests
            response = requests.post(
                config.GROQ_API_URL,
                headers=headers,
                json=data,
                timeout=config.AI_REQUEST_TIMEOUT
            )
            response.raise_for_status()
            result = response.json()

            # Validate response structure
            if not result.get("choices"):
                raise ValueError("Invalid API response: missing choices")

            message = result["choices"][0].get("message", {})
            ai_response = message.get("content", "").strip()
            if not ai_response:
                raise ValueError("Empty response from API")

            logger.info(f"Successfully generated response with model: {model_name}")
            return True, ai_response

        except requests.exceptions.Timeout as e:
            error_msg = f"Request timeout for model {model_name}: {e}"
            if attempt < max_retries:
                wait_time = 2 ** attempt  # Exponential backoff: 1s, 2s, 4s
                logger.warning(f"{error_msg}. Retrying in {wait_time} seconds...")
                time.sleep(wait_time)
                continue
            logger.warning(error_msg)
            return False, error_msg

        except requests.exceptions.HTTPError as e:
            # Check for specific HTTP status codes
            if e.response.status_code == 429:  # Rate limit
                error_msg = f"Rate limit exceeded for model {model_name}"
                if attempt < max_retries:
                    wait_time = 5 * (2 ** attempt)  # Longer wait for rate limits: 5s, 10s, 20s
                    logger.warning(f"{error_msg}. Retrying in {wait_time} seconds...")
                    time.sleep(wait_time)
                    continue
                logger.warning(error_msg)
                return False, error_msg
            elif e.response.status_code == 503:  # Service unavailable
                error_msg = f"Service unavailable for model {model_name}"
                if attempt < max_retries:
                    wait_time = 3 * (2 ** attempt)  # Wait for service: 3s, 6s, 12s
                    logger.warning(f"{error_msg}. Retrying in {wait_time} seconds...")
                    time.sleep(wait_time)
                    continue
                logger.warning(error_msg)
                return False, error_msg
            else:
                error_msg = f"HTTP error {e.response.status_code} for model {model_name}: {e}"
                logger.warning(error_msg)
                return False, error_msg

        except requests.exceptions.ConnectionError as e:
            error_msg = f"Connection error for model {model_name}: {e}"
            if attempt < max_retries:
                wait_time = 2 ** attempt
                logger.warning(f"{error_msg}. Retrying in {wait_time} seconds...")
                time.sleep(wait_time)
                continue
            logger.warning(error_msg)
            return False, error_msg

        except ValueError as e:
            # Don't retry for invalid responses
            error_msg = f"Invalid response from model {model_name}: {e}"
            logger.warning(error_msg)
            return False, error_msg

        except Exception as e:
            error_msg = f"Unexpected error with model {model_name}: {e}"
            if attempt < max_retries:
                wait_time = 2 ** attempt
                logger.warning(f"{error_msg}. Retrying in {wait_time} seconds...")
                time.sleep(wait_time)
                continue
            logger.warning(error_msg)
            return False, error_msg

    return False, f"All retry attempts failed for model {model_name}"


def generate_ai_response_with_models(conversation_history: List[Dict[str, Any]]) -> str:
    """
    Try multiple AI models to generate a response with improved fallback logic.

    Args:
        conversation_history: Prepared conversation history

    Returns:
        AI response or error message
    """
    model_errors = []

    # Try each model in sequence until one works
    for i, model_info in enumerate(config.AI_MODELS):
        model_name = model_info["name"]
        temperature = model_info["temperature"]

        logger.info(f"Attempting model {i + 1}/{len(config.AI_MODELS)}: {model_name}")

        success, response = make_ai_request(model_name, conversation_history, temperature)
        if success:
            logger.info(f"Successfully generated response with model: {model_name}")
            return response
        else:
            model_errors.append(f"{model_name}: {response}")
            logger.warning(f"Model {model_name} failed: {response}")

            # Add a small delay before trying the next model (except for the last one)
            if i < len(config.AI_MODELS) - 1:
                delay = config.AI_MODEL_SWITCH_DELAY
                logger.info(f"Waiting {delay} seconds before trying next model...")
                time.sleep(delay)

    # If we get here, all models failed
    error_details = "; ".join(model_errors)
    error_msg = config.ERROR_MESSAGES["all_models_failed"].format(error=error_details)
    logger.error(f"All models failed. Details: {error_details}")
    return error_msg

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
        if conversation and conversation.get("teaching_mode"):
            teaching_mode = conversation["teaching_mode"]
            logger.info(f"Retrieved teaching mode from database: {teaching_mode}")
            return validate_teaching_mode(teaching_mode)
        else:
            logger.warning(f"No teaching mode found for conversation {conversation_id}, using default mode")
    except Exception as e:
        logger.error(f"Error getting teaching mode from database: {e}")

    return config.DEFAULT_TEACHING_MODE
