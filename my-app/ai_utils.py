
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

    """
    # Check if the provided teaching mode is in the list of valid modes
    if teaching_mode in config.TEACHING_MODES:
        return teaching_mode  # Return the valid teaching mode as-is
    # Return the default teaching mode for any invalid input
    return config.DEFAULT_TEACHING_MODE


def extract_conversation_context(conversation_id) -> Tuple[str, str, bool]:
    """
    Extract and validate conversation context from a conversation_id parameter.
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
        # Extract hidden boolean from dictionary, using default if not present
        is_hidden = conversation_id.get("is_hidden", is_hidden)

    # Validate teaching mode to ensure it's a supported value
    teaching_mode = validate_teaching_mode(teaching_mode)

    return actual_conversation_id, teaching_mode, is_hidden


def prepare_conversation_history(messages: List[Dict[str, Any]], teaching_mode: str) -> List[Dict[str, Any]]:
    """
    Prepare and format conversation history for AI model.

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
    """
    # Initialize list to collect error messages from failed model attempts
    model_errors = []

    # Try each model in sequence until one works
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
    """
    # Compare response length against configured maximum message length
    return len(response) > config.MAX_MESSAGE_LENGTH


def get_teaching_mode_from_db(conversation_id: str) -> str:
    """
    Retrieve the teaching mode for a specific conversation from the database .
    """
    # Validate that we have a conversation ID to look up
    if not conversation_id:
        # Return default mode immediately if no conversation ID provided
        return config.DEFAULT_TEACHING_MODE

    try:
        # Get the conversation from the database using the provided ID
        conversation = database.get_conversation(conversation_id)

        # If the conversation exists and has a teaching_mode, use it
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
