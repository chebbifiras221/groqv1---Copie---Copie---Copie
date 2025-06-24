"""
Topic Validator Module
This module validates if user questions are related to computer science, programming, or coding.
Uses API-based validation with conversation context support.
"""

import logging
import requests
from typing import Tuple, List
import config

logger = logging.getLogger("topic_validator")

def api_based_validation(text: str) -> Tuple[bool, str]:
    """
    Use AI API to validate if a question is related to computer science, programming, or technical topics.

    This function sends the user's question to the Groq API with a specialized prompt designed
    for binary classification. It uses a fast, lightweight model to quickly determine topic
    relevance without consuming significant resources.

    Args:
        text (str): The user's question text to validate. Should be a complete question or
                   statement. Empty strings or very short text may produce inconsistent results.
                   The function handles various question formats and lengths.

    Returns:
        Tuple[bool, str]: A tuple containing:
            - is_cs_related (bool): True if the question is about CS/programming topics,
                                   False if it's about unrelated subjects
            - reason (str): A descriptive string explaining the validation result,
                          useful for logging and debugging purposes

    Example:
        >>> is_valid, reason = api_based_validation("What is Python programming?")
        >>> print(f"Valid: {is_valid}, Reason: {reason}")
        Valid: True, Reason: API confirmed: CS/programming related
    """
    # Check if API key is available for making validation requests
    if not config.GROQ_API_KEY:
        logger.warning("No API key available for topic validation")
        # Default to allowing questions when API is unavailable to avoid blocking users
        return True, "API unavailable - allowing question"

    # Simple validation prompt designed for binary classification
    # Uses clear, specific instructions to get consistent YES/NO responses
    validation_prompt = [
        {
            "role": "system",
            "content": """You are a topic classifier. Respond with ONLY "YES" or "NO".

Respond "YES" if the question is about:
- Computer science, programming, coding, software development
- Programming languages, algorithms, data structures
- Web development, mobile development, databases
- Software engineering, DevOps, cybersecurity
- AI, machine learning, data science
- Technical troubleshooting or debugging

Respond "NO" if the question is about:
- Cooking, food, recipes, restaurants
- Medicine, health, biology, chemistry
- History, geography, literature, arts
- Sports, entertainment, music
- General life advice, relationships
- Non-technical subjects

Be strict: only respond "YES" for clearly technical/programming topics."""
        },
        {
            "role": "user",
            "content": f"Is this question about computer science, programming, or related technical topics?\n\nQuestion: {text}"
        }
    ]
    
    try:
        # Make API request with minimal parameters optimized for fast classification
        headers = {
            "Authorization": f"Bearer {config.GROQ_API_KEY}",  # API authentication
            "Content-Type": "application/json"                 # Request content type
        }

        # Configure request data for fast, consistent classification
        data = {
            "model": "llama-3.1-8b-instant",  # Use fastest model for validation to minimize latency
            "messages": validation_prompt,     # The classification prompt and user question
            "max_tokens": 10,                 # Very short response (just YES/NO needed)
            "temperature": 0.1                # Low temperature for consistent, deterministic responses
        }

        # Make the API request with a short timeout for responsiveness
        response = requests.post(
            config.GROQ_API_URL,  # Groq API endpoint
            headers=headers,      # Authentication headers
            json=data,           # Request payload
            timeout=10           # Short timeout for validation (10 seconds)
        )

        # Process successful API responses
        if response.status_code == 200:
            # Parse the JSON response from the API
            result = response.json()
            # Extract the AI's response and normalize to uppercase for comparison
            ai_response = result["choices"][0]["message"]["content"].strip().upper()

            # Check for positive classification (CS/programming related)
            if "YES" in ai_response:
                return True, "API confirmed: CS/programming related"
            # Check for negative classification (not CS/programming related)
            elif "NO" in ai_response:
                return False, "API confirmed: Not CS/programming related"
            else:
                # Handle unexpected responses by defaulting to allow
                logger.warning(f"Unexpected API response: {ai_response}")
                return True, "API response unclear - allowing question"
        else:
            # Handle API errors by defaulting to allow questions
            logger.warning(f"API validation failed: {response.status_code}")
            return True, "API error - allowing question"

    except Exception as e:
        # Handle any exceptions during API communication
        logger.error(f"Error in API validation: {e}")
        # Default to allowing questions when validation fails to avoid blocking users
        return True, "API error - allowing question"

def build_context_validation_prompt(current_question: str, conversation_history: List[dict]) -> List[dict]:
    """
    Build a structured prompt for AI to analyze conversation context and determine topic relevance.

    This function creates a comprehensive prompt that includes conversation history and specific
    instructions for the AI to determine if a follow-up question is contextually related to
    an ongoing computer science discussion.

    Args:
        current_question (str): The latest user question that needs validation. This is the question
                              being evaluated for relevance to the ongoing conversation context.
        conversation_history (List[dict]): List of recent conversation messages providing context.
                                          Each dict should contain 'type' ('user' or 'ai') and
                                          'content' fields. Used to understand conversation flow.

    Returns:
        List[dict]: A list of message dictionaries formatted for API consumption, containing:
                   - System message with validation instructions and examples
                   - User message with formatted conversation history and current question
                   This format matches the expected API message structure.

    Example:
        >>> history = [{"type": "user", "content": "What is Python?"}, {"type": "ai", "content": "Python is..."}]
        >>> prompt = build_context_validation_prompt("Tell me more", history)
        >>> len(prompt)  # System + user message
        2
    """
    # Format recent conversation (last 4 messages for context)
    # Limit to 4 messages to provide sufficient context without overwhelming the AI
    conversation_text = ""  # Initialize string to build formatted conversation
    # Get the last 4 messages or all messages if fewer than 4 exist
    recent_messages = conversation_history[-4:] if len(conversation_history) > 4 else conversation_history

    # Format each message with role and content for the AI to analyze
    for i, msg in enumerate(recent_messages, 1):
        # Convert message type to readable role name
        role = "User" if msg.get('type') == 'user' else "Assistant"
        # Limit message content to 200 characters to prevent prompt bloat
        content = msg.get('content', '')[:200]  # Limit message length for API efficiency
        # Add formatted message to conversation text with numbering
        conversation_text += f"{i}. {role}: {content}\n"

    prompt = [
        {
            "role": "system",
            "content": """You are analyzing conversation flow to determine if a question is contextually related to computer science/programming topics.

Respond with ONLY "YES" or "NO".

Respond "YES" if the latest question is:
- A natural follow-up to the CS/programming discussion
- Asking for more details, alternatives, or clarifications about the technical topic
- A continuation like "is that all?", "tell me more", "what else?", "anything easier?"
- Requesting related technologies, tools, or approaches
- Asking for comparisons within the technical domain

Respond "NO" if the latest question:
- Introduces a completely new non-technical topic
- Asks about unrelated subjects (cooking, medicine, sports, etc.)
- Changes context to non-CS domains entirely

Examples:

CONVERSATION 1:
1. User: How difficult is assembly language?
2. Assistant: [explains assembly difficulty]
3. User: Is there anything easier?
→ YES (asking for easier programming alternatives)

CONVERSATION 2:
1. User: What is machine learning?
2. Assistant: [explains ML]
3. User: Tell me more about algorithms
→ YES (related technical topic)

CONVERSATION 3:
1. User: How do I write JavaScript functions?
2. Assistant: [explains JS functions]
3. User: What's a good recipe for pasta?
→ NO (unrelated topic)

CONVERSATION 4:
1. User: Explain React components
2. Assistant: [explains React]
3. User: What about Vue or Angular?
→ YES (asking about related frameworks)"""
        },
        {
            "role": "user",
            "content": f"""Analyze this conversation flow:

{conversation_text}
Current question: {current_question}

Is the current question contextually related to the computer science/programming discussion?"""
        }
    ]

    return prompt

def api_context_validation(current_question: str, conversation_history: List[dict]) -> Tuple[bool, str]:
    """
    Use AI API to validate if a question is contextually related to an ongoing CS discussion.

    This function performs context-aware validation by sending the conversation history and
    current question to the AI API for analysis. It determines if a follow-up question is
    naturally related to the ongoing computer science discussion.

    Args:
        current_question (str): The latest user question that needs validation in context.
                              This is analyzed against the conversation history to determine relevance.
        conversation_history (List[dict]): List of recent conversation messages providing context.
                                          Each dict should contain 'type' and 'content' fields.
                                          Used to understand the conversation flow and topic.

    Returns:
        Tuple[bool, str]: A tuple containing:
            - is_cs_related (bool): True if the question is contextually related to the CS discussion,
                                   False if it appears to be off-topic or unrelated
            - reason (str): A descriptive string explaining the validation decision with context details

    Example:
        >>> history = [{"type": "user", "content": "What is Python?"}, {"type": "ai", "content": "Python is..."}]
        >>> is_valid, reason = api_context_validation("Tell me more about it", history)
        >>> print(f"Valid: {is_valid}, Reason: {reason}")
    """
    # Check if API key is available for making validation requests
    if not config.GROQ_API_KEY:
        logger.warning("No API key available for context validation")
        # Default to allowing questions when API is unavailable to avoid blocking users
        return True, "API unavailable - allowing question"

    try:
        # Build context validation prompt with conversation history and current question
        # This creates a structured prompt for the AI to analyze conversation flow
        prompt = build_context_validation_prompt(current_question, conversation_history)

        # Make API request with authentication headers
        headers = {
            "Authorization": f"Bearer {config.GROQ_API_KEY}",  # API authentication token
            "Content-Type": "application/json"                 # Request content type
        }

        # Configure request data for fast, consistent context validation
        data = {
            "model": "llama-3.1-8b-instant",  # Fast model for validation to minimize latency
            "messages": prompt,               # The context validation prompt with conversation history
            "max_tokens": 5,                 # Very short response (just YES/NO needed)
            "temperature": 0.1               # Low temperature for consistent, deterministic responses
        }

        # Make the API request with a short timeout for responsiveness
        response = requests.post(
            config.GROQ_API_URL,  # Groq API endpoint for chat completions
            headers=headers,      # Authentication and content type headers
            json=data,           # Request payload with model and validation prompt
            timeout=10           # Short timeout for validation (10 seconds)
        )

        # Process successful API responses
        if response.status_code == 200:
            # Parse the JSON response from the API
            result = response.json()
            # Extract the AI's response and normalize to uppercase for comparison
            ai_response = result["choices"][0]["message"]["content"].strip().upper()

            # Check for positive validation (contextually related)
            if "YES" in ai_response:
                return True, "AI confirmed: Contextually related to CS discussion"
            # Check for negative validation (not contextually related)
            elif "NO" in ai_response:
                return False, "AI confirmed: Not related to CS discussion"
            else:
                # Handle unexpected responses by defaulting to allow
                logger.warning(f"Unexpected context API response: {ai_response}")
                return True, "API response unclear - allowing question"
        else:
            # Handle API errors by defaulting to allow questions
            logger.warning(f"Context API validation failed: {response.status_code}")
            return True, "API error - allowing question"

    except Exception as e:
        # Handle any exceptions during API communication
        logger.error(f"Error in context API validation: {e}")
        # Default to allowing questions when validation fails to avoid blocking users
        return True, "API error - allowing question"

def validate_question_topic(text: str, conversation_history: List[dict] = None) -> Tuple[bool, str]:
    """
    Main validation function that determines if a user's question is appropriate for the AI assistant.

    This function implements a two-tier validation system: first checking conversation context
    if available (to allow follow-up questions in ongoing CS discussions), then falling back
    to single-question validation for standalone questions. It's designed to be permissive
    for legitimate CS discussions while filtering out unrelated topics.

    Args:
        text (str): The user's question text to validate. Should be a complete question or
                   statement. Very short text (less than 3 characters) is automatically rejected.
                   The function handles various question formats and lengths.
        conversation_history (List[dict], optional): List of recent conversation messages for
                                                   context validation. Each dict should contain
                                                   'type' and 'content' fields. If provided and
                                                   contains at least 2 messages, enables context-aware
                                                   validation. Defaults to None.

    Returns:
        Tuple[bool, str]: A tuple containing:
            - is_allowed (bool): True if the question should be processed by the AI,
                               False if it should be rejected as off-topic
            - reason (str): A descriptive string explaining the validation decision,
                          includes the validation method used and the specific result

    Example:
        >>> is_valid, reason = validate_question_topic("What is Python?")
        >>> print(f"Valid: {is_valid}, Reason: {reason}")
        Valid: True, Reason: API validation: API confirmed: CS/programming related

        >>> history = [{"type": "user", "content": "What is Python?"}, {"type": "ai", "content": "Python is..."}]
        >>> is_valid, reason = validate_question_topic("Tell me more", history)
        >>> print(f"Valid: {is_valid}, Reason: {reason}")
        Valid: True, Reason: Context validation: AI confirmed: Contextually related to CS discussion
    """
    # Log the validation attempt with truncated text for debugging
    logger.info(f"Validating question topic: {text[:100]}...")

    # Basic input validation to filter out empty or very short questions
    if not text or len(text.strip()) < 3:
        logger.info("❌ Question too short")
        return False, "Question too short"

    # Step 1: Check if we have conversation context for context-aware validation
    # Context validation allows follow-up questions in ongoing CS discussions
    if conversation_history and len(conversation_history) >= 2:
        logger.info("🔍 Using conversation context validation...")
        # Use context-aware validation that considers the ongoing conversation
        context_result, context_reason = api_context_validation(text, conversation_history)

        # If context validation passes, allow the question
        if context_result:
            logger.info(f"✅ Context validation PASSED: {context_reason}")
            return True, f"Context validation: {context_reason}"
        else:
            # If context validation fails, reject the question
            logger.info(f"❌ Context validation FAILED: {context_reason}")
            return False, f"Context validation: {context_reason}"

    # Step 2: Fall back to single-question API validation
    # This is used for standalone questions without conversation context
    logger.info("🔍 Using single-question API validation...")
    api_result, api_reason = api_based_validation(text)

    # Return the result of single-question validation
    if api_result:
        logger.info(f"✅ API validation PASSED: {api_reason}")
        return True, f"API validation: {api_reason}"
    else:
        logger.info(f"❌ API validation FAILED: {api_reason}")
        return False, f"API validation: {api_reason}"
