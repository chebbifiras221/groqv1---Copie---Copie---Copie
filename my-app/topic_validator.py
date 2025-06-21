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
    Use AI API to validate if question is CS/programming related.

    Args:
        text: User's question text

    Returns:
        Tuple of (is_cs_related, reason)
    """
    if not config.GROQ_API_KEY:
        logger.warning("No API key available for topic validation")
        return True, "API unavailable - allowing question"
    
    # Simple validation prompt
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
        # Make API request with minimal parameters
        headers = {
            "Authorization": f"Bearer {config.GROQ_API_KEY}",
            "Content-Type": "application/json"
        }
        
        data = {
            "model": "llama-3.1-8b-instant",  # Use fastest model for validation
            "messages": validation_prompt,
            "max_tokens": 10,  # Very short response
            "temperature": 0.1  # Low temperature for consistent responses
        }
        
        response = requests.post(
            config.GROQ_API_URL,
            headers=headers,
            json=data,
            timeout=10  # Short timeout for validation
        )
        
        if response.status_code == 200:
            result = response.json()
            ai_response = result["choices"][0]["message"]["content"].strip().upper()
            
            if "YES" in ai_response:
                return True, "API confirmed: CS/programming related"
            elif "NO" in ai_response:
                return False, "API confirmed: Not CS/programming related"
            else:
                logger.warning(f"Unexpected API response: {ai_response}")
                return True, "API response unclear - allowing question"
        else:
            logger.warning(f"API validation failed: {response.status_code}")
            return True, "API error - allowing question"
            
    except Exception as e:
        logger.error(f"Error in API validation: {e}")
        return True, "API error - allowing question"

def build_context_validation_prompt(current_question: str, conversation_history: List[dict]) -> List[dict]:
    """
    Build a prompt for AI to analyze conversation context.

    Args:
        current_question: The latest user question
        conversation_history: List of recent messages with 'type' and 'content'

    Returns:
        List of messages for API call
    """
    # Format recent conversation (last 4 messages for context)
    conversation_text = ""
    recent_messages = conversation_history[-4:] if len(conversation_history) > 4 else conversation_history

    for i, msg in enumerate(recent_messages, 1):
        role = "User" if msg.get('type') == 'user' else "Assistant"
        content = msg.get('content', '')[:200]  # Limit message length
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
    Use AI API to validate if question is contextually related to CS discussion.

    Args:
        current_question: The latest user question
        conversation_history: List of recent conversation messages

    Returns:
        Tuple of (is_cs_related, reason)
    """
    if not config.GROQ_API_KEY:
        logger.warning("No API key available for context validation")
        return True, "API unavailable - allowing question"

    try:
        # Build context validation prompt
        prompt = build_context_validation_prompt(current_question, conversation_history)

        # Make API request
        headers = {
            "Authorization": f"Bearer {config.GROQ_API_KEY}",
            "Content-Type": "application/json"
        }

        data = {
            "model": "llama-3.1-8b-instant",  # Fast model for validation
            "messages": prompt,
            "max_tokens": 5,      # Very short response
            "temperature": 0.1    # Consistent responses
        }

        response = requests.post(
            config.GROQ_API_URL,
            headers=headers,
            json=data,
            timeout=10  # Short timeout for validation
        )

        if response.status_code == 200:
            result = response.json()
            ai_response = result["choices"][0]["message"]["content"].strip().upper()

            if "YES" in ai_response:
                return True, "AI confirmed: Contextually related to CS discussion"
            elif "NO" in ai_response:
                return False, "AI confirmed: Not related to CS discussion"
            else:
                logger.warning(f"Unexpected context API response: {ai_response}")
                return True, "API response unclear - allowing question"
        else:
            logger.warning(f"Context API validation failed: {response.status_code}")
            return True, "API error - allowing question"

    except Exception as e:
        logger.error(f"Error in context API validation: {e}")
        return True, "API error - allowing question"

def validate_question_topic(text: str, conversation_history: List[dict] = None) -> Tuple[bool, str]:
    """
    Main validation function with conversation context support.
    Uses API-based validation with conversation context when available.

    Args:
        text: User's question text
        conversation_history: Optional list of recent conversation messages

    Returns:
        Tuple of (is_allowed, reason)
    """
    logger.info(f"Validating question topic: {text[:100]}...")

    # Basic input validation
    if not text or len(text.strip()) < 3:
        logger.info("❌ Question too short")
        return False, "Question too short"

    # Step 1: Check if we have conversation context
    if conversation_history and len(conversation_history) >= 2:
        logger.info("🔍 Using conversation context validation...")
        context_result, context_reason = api_context_validation(text, conversation_history)

        if context_result:
            logger.info(f"✅ Context validation PASSED: {context_reason}")
            return True, f"Context validation: {context_reason}"
        else:
            logger.info(f"❌ Context validation FAILED: {context_reason}")
            return False, f"Context validation: {context_reason}"

    # Step 2: Fall back to single-question API validation
    logger.info("🔍 Using single-question API validation...")
    api_result, api_reason = api_based_validation(text)

    if api_result:
        logger.info(f"✅ API validation PASSED: {api_reason}")
        return True, f"API validation: {api_reason}"
    else:
        logger.info(f"❌ API validation FAILED: {api_reason}")
        return False, f"API validation: {api_reason}"
