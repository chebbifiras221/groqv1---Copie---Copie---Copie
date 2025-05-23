"""
Authentication API endpoints for handling user registration, login, and token validation.
This module provides functions that can be called from the main application to handle
authentication-related requests.
"""

import json
import logging
from typing import Dict, Any, Tuple

import auth_db

# Get logger for this module

logger = logging.getLogger("auth-api")

def handle_auth_request(data: bytes) -> Tuple[Dict[str, Any], int]:
    """
    Handle authentication requests from the client.

    Args:
        data: JSON data from the client

    Returns:
        Tuple containing:
        - Response data as a dictionary
        - HTTP status code
    """
    try:
        # Parse the request data
        request = json.loads(data.decode('utf-8'))
        request_type = request.get('type')

        if request_type == 'register':
            return handle_register(request)
        elif request_type == 'login':
            return handle_login(request)
        elif request_type == 'verify':
            return handle_verify(request)
        elif request_type == 'logout':
            return handle_logout(request)
        else:
            return {
                'success': False,
                'message': 'Invalid request type'
            }, 400
    except json.JSONDecodeError:
        logger.error("Invalid JSON in auth request")
        return {
            'success': False,
            'message': 'Invalid JSON data'
        }, 400
    except Exception as e:
        logger.error(f"Error handling auth request: {e}")
        return {
            'success': False,
            'message': f'Server error: {str(e)}'
        }, 500

def handle_register(request: Dict[str, Any]) -> Tuple[Dict[str, Any], int]:
    """
    Handle user registration requests.

    Args:
        request: Registration request data

    Returns:
        Tuple containing:
        - Response data as a dictionary
        - HTTP status code
    """
    username = request.get('username')
    password = request.get('password')
    email = request.get('email')

    logger.info(f"Registration request received for username: {username}")

    # Validate required fields
    if not username or not password:
        logger.warning(f"Registration validation failed: Missing username or password")
        return {
            'success': False,
            'message': 'Username and password are required',
            'errorType': 'validation'
        }, 400

    # Log password length for security validation (don't log the actual password)
    logger.info(f"Password validation: Length={len(password) if password else 0}")

    # Register the user
    logger.info(f"Attempting to register user: {username}")
    success, message, user = auth_db.register_user(username, password, email)

    if success:
        logger.info(f"User registered successfully: {username} (ID: {user['id'] if user else 'unknown'})")
        return {
            'success': True,
            'message': message,
            'user': user
        }, 201
    else:
        error_type = 'username_exists' if 'exists' in message.lower() else 'server_error'
        logger.warning(f"Registration failed for {username}: {message} (Error type: {error_type})")
        return {
            'success': False,
            'message': message,
            'errorType': error_type
        }, 400

def handle_login(request: Dict[str, Any]) -> Tuple[Dict[str, Any], int]:
    """
    Handle user login requests.

    Args:
        request: Login request data

    Returns:
        Tuple containing:
        - Response data as a dictionary
        - HTTP status code
    """
    username = request.get('username')
    password = request.get('password')

    logger.info(f"Login attempt received for username: {username}")

    # Validate required fields
    if not username or not password:
        logger.warning(f"Login validation failed: Missing username or password")
        return {
            'success': False,
            'message': 'Username and password are required',
            'errorType': 'validation'
        }, 400

    # Authenticate the user
    logger.info(f"Authenticating user: {username}")
    success, token_or_message, user = auth_db.login_user(username, password)

    if success:
        logger.info(f"Login successful for user: {username} (ID: {user['id'] if user else 'unknown'})")
        # Log token details (first 8 chars only for security)
        token_preview = token_or_message[:8] + "..." if token_or_message and len(token_or_message) > 8 else "N/A"
        logger.info(f"Generated token for {username}: {token_preview}")

        return {
            'success': True,
            'message': 'Login successful',
            'token': token_or_message,
            'user': user
        }, 200
    else:
        # Determine the specific error type
        error_type = 'username' if 'user does not exist' in token_or_message.lower() else 'password' if 'password is incorrect' in token_or_message.lower() else 'server_error'

        logger.warning(f"Login failed for {username}: {token_or_message} (Error type: {error_type})")

        return {
            'success': False,
            'message': token_or_message,
            'errorType': error_type
        }, 401

def handle_verify(request: Dict[str, Any]) -> Tuple[Dict[str, Any], int]:
    """
    Handle token verification requests.

    Args:
        request: Verification request data

    Returns:
        Tuple containing:
        - Response data as a dictionary
        - HTTP status code
    """
    token = request.get('token')

    # Log token verification attempt (first 8 chars only for security)
    token_preview = token[:8] + "..." if token and len(token) > 8 else "N/A"
    logger.info(f"Token verification request received: {token_preview}")

    # Validate required fields
    if not token:
        logger.warning("Token verification failed: No token provided")
        return {
            'success': False,
            'message': 'Token is required',
            'errorType': 'validation'
        }, 400

    # Verify the token
    logger.info("Verifying token with authentication database")
    success, user = auth_db.verify_token(token)

    if success:
        username = user.get('username', 'unknown') if user else 'unknown'
        user_id = user.get('id', 'unknown') if user else 'unknown'
        logger.info(f"Token verified successfully for user: {username} (ID: {user_id})")
        return {
            'success': True,
            'message': 'Token verified',
            'user': user
        }, 200
    else:
        logger.warning(f"Token verification failed: Invalid or expired token ({token_preview})")
        return {
            'success': False,
            'message': 'Invalid token',
            'errorType': 'token'
        }, 401

def handle_logout(request: Dict[str, Any]) -> Tuple[Dict[str, Any], int]:
    """
    Handle user logout requests.

    Args:
        request: Logout request data

    Returns:
        Tuple containing:
        - Response data as a dictionary
        - HTTP status code
    """
    token = request.get('token')

    # Log logout attempt (first 8 chars only for security)
    token_preview = token[:8] + "..." if token and len(token) > 8 else "N/A"
    logger.info(f"Logout request received for token: {token_preview}")

    # Validate required fields
    if not token:
        logger.warning("Logout failed: No token provided")
        return {
            'success': False,
            'message': 'Token is required',
            'errorType': 'validation'
        }, 400

    # First, try to identify the user before logging them out
    verify_success, user = auth_db.verify_token(token)
    if verify_success and user:
        username = user.get('username', 'unknown')
        user_id = user.get('id', 'unknown')
        logger.info(f"Logging out user: {username} (ID: {user_id})")
    else:
        logger.info(f"Logging out unknown user with token: {token_preview}")

    # Logout the user
    success = auth_db.logout_user(token)

    if success:
        logger.info(f"Logout successful for token: {token_preview}")
        return {
            'success': True,
            'message': 'Logout successful'
        }, 200
    else:
        logger.error(f"Error logging out user with token: {token_preview}")
        return {
            'success': False,
            'message': 'Error logging out',
            'errorType': 'server_error'
        }, 500
