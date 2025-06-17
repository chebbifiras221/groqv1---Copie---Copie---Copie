"""
Topic Validator Module
This module validates if user questions are related to computer science, programming, or coding.
Uses a two-tier approach: keyword filtering first, then API validation if needed.
"""

import logging
import re
import requests
import json
from typing import Tuple, List, Set
import config

logger = logging.getLogger("topic_validator")

# Comprehensive keyword lists for computer science and programming topics
CS_KEYWORDS = {
    # Programming Languages
    'python', 'javascript', 'java', 'c++', 'c#', 'php', 'ruby', 'go', 'rust', 'swift',
    'kotlin', 'typescript', 'scala', 'perl', 'r', 'matlab', 'sql', 'html', 'css',
    
    # Programming Concepts
    'algorithm', 'algorithms', 'data structure', 'data structures', 'function', 'functions',
    'variable', 'variables', 'loop', 'loops', 'array', 'arrays', 'object', 'objects',
    'class', 'classes', 'method', 'methods', 'inheritance', 'polymorphism', 'encapsulation',
    'recursion', 'iteration', 'conditional', 'conditionals', 'boolean', 'string', 'integer',
    
    # Software Development
    'programming', 'coding', 'development', 'software', 'application', 'app', 'website',
    'web development', 'mobile development', 'frontend', 'backend', 'fullstack', 'api',
    'rest api', 'graphql', 'database', 'sql', 'nosql', 'mongodb', 'mysql', 'postgresql',
    
    # Computer Science Fields
    'computer science', 'artificial intelligence', 'machine learning', 'deep learning',
    'neural network', 'data science', 'cybersecurity', 'networking', 'operating system',
    'compiler', 'interpreter', 'virtual machine', 'cloud computing', 'devops',
    
    # Development Tools & Frameworks
    'git', 'github', 'docker', 'kubernetes', 'react', 'angular', 'vue', 'node.js',
    'express', 'django', 'flask', 'spring', 'laravel', 'rails', 'bootstrap', 'jquery',
    
    # Technical Concepts
    'debugging', 'testing', 'unit test', 'integration test', 'version control', 'agile',
    'scrum', 'mvc', 'oop', 'functional programming', 'design pattern', 'architecture',
    'microservices', 'monolith', 'scalability', 'performance', 'optimization',
    
    # Data & Algorithms
    'big o', 'complexity', 'sorting', 'searching', 'tree', 'graph', 'linked list',
    'stack', 'queue', 'hash table', 'binary search', 'merge sort', 'quick sort',
    
    # Web Technologies
    'http', 'https', 'json', 'xml', 'ajax', 'websocket', 'cors', 'authentication',
    'authorization', 'jwt', 'oauth', 'session', 'cookie', 'cache', 'cdn'
}

# Common non-CS keywords that might appear in mixed questions
NON_CS_INDICATORS = {
    'recipe', 'cooking', 'food', 'restaurant', 'medicine', 'doctor', 'health',
    'history', 'geography', 'literature', 'poetry', 'music', 'art', 'painting',
    'sports', 'football', 'basketball', 'weather', 'climate', 'biology', 'chemistry',
    'physics', 'mathematics', 'calculus', 'algebra', 'geometry'
}

def preprocess_text(text: str) -> str:
    """
    Preprocess text for keyword matching.
    
    Args:
        text: Input text to preprocess
        
    Returns:
        Cleaned and normalized text
    """
    # Convert to lowercase
    text = text.lower()
    
    # Remove special characters but keep spaces and alphanumeric
    text = re.sub(r'[^\w\s]', ' ', text)
    
    # Replace multiple spaces with single space
    text = re.sub(r'\s+', ' ', text)
    
    return text.strip()

def extract_keywords(text: str) -> Set[str]:
    """
    Extract potential keywords from text.
    
    Args:
        text: Input text
        
    Returns:
        Set of extracted keywords and phrases
    """
    processed_text = preprocess_text(text)
    keywords = set()
    
    # Add individual words
    words = processed_text.split()
    keywords.update(words)
    
    # Add common programming phrases (2-3 words)
    for i in range(len(words) - 1):
        two_word = f"{words[i]} {words[i+1]}"
        keywords.add(two_word)
        
        if i < len(words) - 2:
            three_word = f"{words[i]} {words[i+1]} {words[i+2]}"
            keywords.add(three_word)
    
    return keywords

def keyword_based_validation(text: str) -> Tuple[bool, str, List[str]]:
    """
    Fast keyword-based validation to filter obvious CS/programming questions.
    
    Args:
        text: User's question text
        
    Returns:
        Tuple of (is_cs_related, confidence_reason, matched_keywords)
    """
    if not text or len(text.strip()) < 3:
        return False, "Question too short", []
    
    # Extract keywords from the question
    question_keywords = extract_keywords(text)
    
    # Find matches with CS keywords
    cs_matches = question_keywords.intersection(CS_KEYWORDS)
    non_cs_matches = question_keywords.intersection(NON_CS_INDICATORS)
    
    # Log for debugging
    logger.debug(f"Question keywords: {list(question_keywords)[:10]}...")  # Show first 10
    logger.debug(f"CS matches: {list(cs_matches)}")
    logger.debug(f"Non-CS matches: {list(non_cs_matches)}")
    
    # Decision logic
    if len(cs_matches) >= 2:
        return True, f"Strong CS indicators: {list(cs_matches)[:3]}", list(cs_matches)
    elif len(cs_matches) == 1 and len(non_cs_matches) == 0:
        return True, f"CS indicator found: {list(cs_matches)[0]}", list(cs_matches)
    elif len(non_cs_matches) > len(cs_matches):
        return False, f"Non-CS topic detected: {list(non_cs_matches)[:2]}", []
    elif len(cs_matches) == 0:
        return None, "Unclear - needs API validation", []  # None means uncertain
    else:
        return None, "Mixed indicators - needs API validation", list(cs_matches)

def api_based_validation(text: str) -> Tuple[bool, str]:
    """
    Use AI API to validate if question is CS/programming related.
    Only called when keyword validation is uncertain.
    
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

    Args:
        text: User's question text
        conversation_history: Optional list of recent conversation messages

    Returns:
        Tuple of (is_allowed, reason)
    """
    logger.info(f"Validating question topic: {text[:100]}...")

    # Step 1: Fast keyword-based validation
    keyword_result, keyword_reason, matched_keywords = keyword_based_validation(text)

    if keyword_result is True:
        logger.info(f"✅ Keyword validation PASSED: {keyword_reason}")
        return True, f"Keyword match: {keyword_reason}"
    elif keyword_result is False:
        logger.info(f"❌ Keyword validation FAILED: {keyword_reason}")
        return False, f"Non-CS topic: {keyword_reason}"

    # Step 2: Check if we have conversation context for uncertain cases
    if conversation_history and len(conversation_history) >= 2:
        logger.info("🔍 Keyword validation uncertain, using conversation context...")
        context_result, context_reason = api_context_validation(text, conversation_history)

        if context_result:
            logger.info(f"✅ Context validation PASSED: {context_reason}")
            return True, f"Context validation: {context_reason}"
        else:
            logger.info(f"❌ Context validation FAILED: {context_reason}")
            return False, f"Context validation: {context_reason}"

    # Step 3: Fall back to single-question API validation
    logger.info("🔍 No conversation context, using single-question API validation...")
    api_result, api_reason = api_based_validation(text)

    if api_result:
        logger.info(f"✅ API validation PASSED: {api_reason}")
        return True, f"API validation: {api_reason}"
    else:
        logger.info(f"❌ API validation FAILED: {api_reason}")
        return False, f"API validation: {api_reason}"
