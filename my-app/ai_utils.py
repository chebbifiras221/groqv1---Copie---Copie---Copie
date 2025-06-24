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

    """
    # Get the appropriate system prompt based on the teaching mode
    system_prompt = get_system_prompt(teaching_mode)

    # The system prompt must always be the first message in the conversation
    conversation_history = [system_prompt]

    # Add the conversation history by transforming database format to API format
    conversation_history.extend([
        {
            "role": "user" if msg["type"] == "user" else "assistant",  # Map message type to API role
            "content": msg["content"]  # Use message content as-is
        }
        for msg in messages  # Process all messages from the database
    ])

    # Keep only the last N messages to avoid token limits, but always keep the system prompt
    max_messages = config.MAX_CONVERSATION_HISTORY + 1  # +1 for system prompt
    if len(conversation_history) > max_messages:
        # Keep system prompt (first message) and the most recent conversation messages
        conversation_history = [conversation_history[0]] + conversation_history[-config.MAX_CONVERSATION_HISTORY:]

    return conversation_history

def make_ai_request(model_name: str, conversation_history: List[Dict[str, Any]], temperature: float = None, max_retries: int = None) -> Tuple[bool, str]:
    """
    Make a request to the AI API .
    Args:
        model_name (str): The specific AI model to use for the request (e.g., "llama-3.3-70b-versatile").
                         Must be a valid model name supported by the Groq API. Different models
                         have different capabilities, speeds, and quality characteristics.
        conversation_history (List[Dict[str, Any]]): Formatted conversation messages for the API.
                                                   Each dict contains 'role' and 'content' fields.
                                                   First message should be system prompt, followed by
                                                   alternating user/assistant messages.
        temperature (float, optional): Controls randomness in AI responses (0.0-2.0). Lower values
                                     produce more deterministic responses, higher values more creative.
                                     If None, uses the model's configured default temperature.
        max_retries (int, optional): Maximum retry attempts for this specific model. If None,
                                   uses config.AI_MODEL_RETRY_COUNT. Higher values increase
                                   reliability but may delay fallback to other models.

    Returns:
        Tuple[bool, str]: A tuple containing:
            - success (bool): True if the API request succeeded and returned valid content,
                            False if all retry attempts failed or response was invalid
            - response_or_error (str): On success, contains the AI-generated response text.
                                     On failure, contains a descriptive error message explaining
                                     what went wrong (timeout, rate limit, invalid response, etc.)

    Example:
        >>> success, response = make_ai_request("llama-3.1-8b-instant", history, 0.7, 3)
        >>> if success:
        ...     print(f"AI Response: {response}")
        ... else:
        ...     print(f"Request failed: {response}")
    """
    # Validate that the Groq API key is configured before making any requests
    if not config.GROQ_API_KEY:
        # Return immediately with error if no API key is available
        return False, config.ERROR_MESSAGES["api_key_missing"]

    # Use provided max_retries or fall back to configured default
    max_retries = max_retries or config.AI_MODEL_RETRY_COUNT

    # Prepare HTTP headers for the API request
    headers = {
        "Authorization": f"Bearer {config.GROQ_API_KEY}",  # API authentication token
        "Content-Type": "application/json"                 # Request content type
    }

    # Build the request data using the configuration helper function
    # This includes model name, messages, temperature, and other parameters
    data = config.get_ai_request_data(model_name, conversation_history, temperature)

    # Retry loop with exponential backoff for different error types
    for attempt in range(max_retries + 1):  # +1 because range is exclusive
        try:
            # Log the attempt for debugging and monitoring
            logger.info(f"Making AI request with model: {model_name} (attempt {attempt + 1}/{max_retries + 1})")

            # Add timeout to prevent hanging requests that could block the application
            response = requests.post(
                config.GROQ_API_URL,           # Groq API endpoint URL
                headers=headers,               # Authentication and content type headers
                json=data,                     # Request payload with model and conversation data
                timeout=config.AI_REQUEST_TIMEOUT  # Timeout tuple: (connect_timeout, read_timeout)
            )
            # Raise an exception for HTTP error status codes (4xx, 5xx)
            response.raise_for_status()

            # Parse the JSON response from the API
            result = response.json()

            # Validate response structure to ensure it contains expected fields
            if not result.get("choices"):
                # API returned success but with invalid structure
                raise ValueError("Invalid API response: missing choices")

            # Extract the AI message from the first choice
            message = result["choices"][0].get("message", {})  # Get message object or empty dict
            ai_response = message.get("content", "").strip()   # Extract content and remove whitespace
            # Validate that we received actual content
            if not ai_response:
                # API returned success but with empty content
                raise ValueError("Empty response from API")

            # Log successful response generation
            logger.info(f"Successfully generated response with model: {model_name}")
            return True, ai_response  # Return success with the AI response text

        # Handle timeout errors with exponential backoff
        except requests.exceptions.Timeout as e:
            # Create descriptive error message for timeout
            error_msg = f"Request timeout for model {model_name}: {e}"
            # Check if we have more retry attempts available
            if attempt < max_retries:
                wait_time = 2 ** attempt  # Exponential backoff: 1s, 2s, 4s, 8s...
                logger.warning(f"{error_msg}. Retrying in {wait_time} seconds...")
                time.sleep(wait_time)  # Wait before retrying
                continue  # Try again with next attempt
            # No more retries available, log final error and return
            logger.warning(error_msg)
            return False, error_msg

        # Handle HTTP errors with specific handling for different status codes
        except requests.exceptions.HTTPError as e:
            # Check for specific HTTP status codes that require different handling
            if e.response.status_code == 429:  # Rate limit exceeded
                error_msg = f"Rate limit exceeded for model {model_name}"
                # Check if we have more retry attempts available
                if attempt < max_retries:
                    wait_time = 5 * (2 ** attempt)  # Longer wait for rate limits: 5s, 10s, 20s, 40s...
                    logger.warning(f"{error_msg}. Retrying in {wait_time} seconds...")
                    time.sleep(wait_time)  # Wait longer for rate limit recovery
                    continue  # Try again with next attempt
                # No more retries available for rate limit
                logger.warning(error_msg)
                return False, error_msg
            elif e.response.status_code == 503:  # Service unavailable
                error_msg = f"Service unavailable for model {model_name}"
                # Check if we have more retry attempts available
                if attempt < max_retries:
                    wait_time = 3 * (2 ** attempt)  # Wait for service recovery: 3s, 6s, 12s, 24s...
                    logger.warning(f"{error_msg}. Retrying in {wait_time} seconds...")
                    time.sleep(wait_time)  # Wait for service to recover
                    continue  # Try again with next attempt
                # No more retries available for service unavailable
                logger.warning(error_msg)
                return False, error_msg
            else:
                # Other HTTP errors (4xx, 5xx) that shouldn't be retried
                error_msg = f"HTTP error {e.response.status_code} for model {model_name}: {e}"
                logger.warning(error_msg)
                return False, error_msg  # Don't retry for other HTTP errors

        # Handle connection errors with exponential backoff
        except requests.exceptions.ConnectionError as e:
            # Create descriptive error message for connection issues
            error_msg = f"Connection error for model {model_name}: {e}"
            # Check if we have more retry attempts available
            if attempt < max_retries:
                wait_time = 2 ** attempt  # Exponential backoff for connection issues
                logger.warning(f"{error_msg}. Retrying in {wait_time} seconds...")
                time.sleep(wait_time)  # Wait before retrying connection
                continue  # Try again with next attempt
            # No more retries available for connection error
            logger.warning(error_msg)
            return False, error_msg

        # Handle invalid response errors (don't retry these)
        except ValueError as e:
            # Don't retry for invalid responses as they indicate API format issues
            error_msg = f"Invalid response from model {model_name}: {e}"
            logger.warning(error_msg)
            return False, error_msg  # Return immediately without retrying

        # Handle any other unexpected errors with exponential backoff
        except Exception as e:
            # Create descriptive error message for unexpected errors
            error_msg = f"Unexpected error with model {model_name}: {e}"
            # Check if we have more retry attempts available
            if attempt < max_retries:
                wait_time = 2 ** attempt  # Exponential backoff for unexpected errors
                logger.warning(f"{error_msg}. Retrying in {wait_time} seconds...")
                time.sleep(wait_time)  # Wait before retrying
                continue  # Try again with next attempt
            # No more retries available for unexpected error
            logger.warning(error_msg)
            return False, error_msg

    # This line is reached if all retry attempts were exhausted
    return False, f"All retry attempts failed for model {model_name}"


def generate_ai_response_with_models(conversation_history: List[Dict[str, Any]]) -> str:
    """
    Try multiple AI models in sequence to generate a response with comprehensive fallback logic.

    This function implements a robust multi-model approach where if one AI model fails,
    the system automatically tries the next model in the configured list. This ensures
    high availability and reliability even when individual models are experiencing issues.

    Args:
        conversation_history (List[Dict[str, Any]]): Formatted conversation messages ready for API consumption.
                                                   Should include system prompt as first message followed by
                                                   alternating user/assistant messages. Each dict contains
                                                   'role' and 'content' fields as expected by the Groq API.

    Returns:
        str: Either a successful AI-generated response from one of the models, or a comprehensive
             error message if all models failed. The error message includes details about what
             went wrong with each model attempt for debugging purposes.

    Example:
        >>> history = [{"role": "system", "content": "You are a teacher"}, {"role": "user", "content": "Hello"}]
        >>> response = generate_ai_response_with_models(history)
        >>> print(response)  # Either AI response or detailed error message
    """
    # Initialize list to collect error messages from failed model attempts
    model_errors = []

    # Try each model in sequence until one works
    # Models are ordered by preference: best quality first, fastest fallback last
    for i, model_info in enumerate(config.AI_MODELS):
        # Extract model configuration from the model info dictionary
        model_name = model_info["name"]          # The specific model identifier (e.g., "llama-3.3-70b-versatile")
        temperature = model_info["temperature"]  # The creativity/randomness setting for this model

        # Log the current attempt for monitoring and debugging
        logger.info(f"Attempting model {i + 1}/{len(config.AI_MODELS)}: {model_name}")

        # Make the API request to the current model
        success, response = make_ai_request(model_name, conversation_history, temperature)

        # Check if the model request was successful
        if success:
            # Model succeeded - log success and return the response immediately
            logger.info(f"Successfully generated response with model: {model_name}")
            return response  # Return the successful AI response
        else:
            # Model failed - collect error information and try next model
            model_errors.append(f"{model_name}: {response}")  # Store error details for final error message
            logger.warning(f"Model {model_name} failed: {response}")

            # Add a small delay before trying the next model (except for the last one)
            # This prevents overwhelming the API with rapid successive requests
            if i < len(config.AI_MODELS) - 1:  # Check if this is not the last model
                delay = config.AI_MODEL_SWITCH_DELAY  # Get configured delay between model attempts
                logger.info(f"Waiting {delay} seconds before trying next model...")
                time.sleep(delay)  # Wait before trying the next model

    # If we get here, all models failed to generate a response
    # Combine all error messages into a comprehensive error report
    error_details = "; ".join(model_errors)  # Join all model errors with semicolons
    # Format the final error message using the configured template
    error_msg = config.ERROR_MESSAGES["all_models_failed"].format(error=error_details)
    # Log the complete failure for monitoring and debugging
    logger.error(f"All models failed. Details: {error_details}")
    return error_msg  # Return the comprehensive error message

def should_split_response(response: str) -> bool:
    """
    Check if an AI response should be split based on its length to prevent UI and TTS issues.

    This function determines whether a response is too long for optimal user experience.
    Very long responses can cause problems with text-to-speech synthesis, UI rendering,
    and user attention span. Currently used for monitoring and logging purposes.

    Args:
        response (str): The AI-generated response text to evaluate. Can be any length string
                       including empty strings. The function checks the character count
                       against the configured maximum message length.

    Returns:
        bool: True if the response exceeds the maximum configured message length and should
              potentially be split into smaller parts. False if the response is within
              acceptable length limits for optimal user experience.

    Example:
        >>> long_response = "A" * 60000  # Very long response
        >>> should_split_response(long_response)
        True
        >>> short_response = "Hello, how can I help?"
        >>> should_split_response(short_response)
        False
    """
    # Compare response length against configured maximum message length
    # Returns True if response exceeds the limit, False otherwise
    return len(response) > config.MAX_MESSAGE_LENGTH


def get_teaching_mode_from_db(conversation_id: str) -> str:
    """
    Retrieve the teaching mode for a specific conversation from the database with fallback handling.

    This function looks up the teaching mode associated with a conversation to ensure
    the AI responds in the appropriate style (teacher vs qa mode). It includes comprehensive
    error handling and fallback logic to ensure the system always has a valid teaching mode.

    Args:
        conversation_id (str): The unique identifier (UUID) of the conversation to look up.
                              Should be a valid conversation ID that exists in the database.
                              If None, empty, or invalid, the function returns the default mode.

    Returns:
        str: The teaching mode for the conversation ('teacher' or 'qa'). Always returns a valid
             teaching mode even if the conversation doesn't exist or has no mode set.
             Defaults to config.DEFAULT_TEACHING_MODE if any issues occur during lookup.

    Example:
        >>> mode = get_teaching_mode_from_db("550e8400-e29b-41d4-a716-446655440000")
        >>> print(f"Teaching mode: {mode}")
        Teaching mode: teacher
    """
    # Validate that we have a conversation ID to look up
    if not conversation_id:
        # Return default mode immediately if no conversation ID provided
        return config.DEFAULT_TEACHING_MODE

    try:
        # Get the conversation from the database using the provided ID
        # This retrieves the complete conversation record including metadata
        conversation = database.get_conversation(conversation_id)

        # If the conversation exists and has a teaching_mode, use it
        # Check both that conversation exists and has the teaching_mode field
        if conversation and conversation.get("teaching_mode"):
            # Extract the teaching mode from the conversation record
            teaching_mode = conversation["teaching_mode"]
            # Log successful retrieval for debugging and monitoring
            logger.info(f"Retrieved teaching mode from database: {teaching_mode}")
            # Validate the teaching mode to ensure it's a supported value
            return validate_teaching_mode(teaching_mode)
        else:
            # Conversation exists but has no teaching mode, or conversation doesn't exist
            logger.warning(f"No teaching mode found for conversation {conversation_id}, using default mode")
    except Exception as e:
        # Handle any database errors during conversation retrieval
        logger.error(f"Error getting teaching mode from database: {e}")

    # Return default teaching mode for any error condition or missing data
    return config.DEFAULT_TEACHING_MODE

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
