import json
import logging
from typing import Dict, Any, Tuple

import auth_db

logger = logging.getLogger("auth-api")

def handle_auth_request(data: bytes) -> Tuple[Dict[str, Any], int]:
    """
    Handle authentication requests from the client.
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
    """
    username = request.get('username')
    password = request.get('password')

    logger.info(f"Registration request for username: {username}")

    # Validate required fields
    if not username or not password:
        return {
            'success': False,
            'message': 'Username and password are required',
            'errorType': 'validation'
        }, 400

    # Register the user
    success, message, user = auth_db.register_user(username, password)

    if success:
        logger.info(f"User registered successfully: {username}")
        return {
            'success': True,
            'message': message,
            'user': user
        }, 201
    else:
        error_type = 'username_exists' if 'exists' in message.lower() else 'server_error'
        logger.warning(f"Registration failed for {username}: {message}")
        return {
            'success': False,
            'message': message,
            'errorType': error_type
        }, 400

def handle_login(request: Dict[str, Any]) -> Tuple[Dict[str, Any], int]:
    """
    Handle user login requests.
    """
    username = request.get('username')
    password = request.get('password')

    logger.info(f"Login attempt for username: {username}")

    # Validate required fields
    if not username or not password:
        return {
            'success': False,
            'message': 'Username and password are required',
            'errorType': 'validation'
        }, 400

    # Authenticate the user
    success, token_or_message, user = auth_db.login_user(username, password)

    if success:
        logger.info(f"Login successful for user: {username}")
        return {
            'success': True,
            'message': 'Login successful',
            'token': token_or_message,
            'user': user
        }, 200
    else:
        # Determine the specific error type
        if 'user does not exist' in token_or_message.lower():
            error_type = 'username'
        elif 'password is incorrect' in token_or_message.lower():
            error_type = 'password'
        else:
            error_type = 'server_error'

        logger.warning(f"Login failed for {username}: {token_or_message}")

        return {
            'success': False,
            'message': token_or_message,
            'errorType': error_type
        }, 401

def handle_verify(request: Dict[str, Any]) -> Tuple[Dict[str, Any], int]:
    """
    Handle token verification requests.
    """
    token = request.get('token')

    # Validate required fields
    if not token:
        return {
            'success': False,
            'message': 'Token is required',
            'errorType': 'validation'
        }, 400

    # Verify the token
    success, user = auth_db.verify_token(token)

    if success:
        username = user.get('username', 'unknown') if user else 'unknown'
        logger.info(f"Token verified for user: {username}")
        return {
            'success': True,
            'message': 'Token verified',
            'user': user
        }, 200
    else:
        logger.warning("Token verification failed: Invalid or expired token")
        return {
            'success': False,
            'message': 'Invalid token',
            'errorType': 'token'
        }, 401

def handle_logout(request: Dict[str, Any]) -> Tuple[Dict[str, Any], int]:
    """
    Handle user logout requests.
    """
    token = request.get('token')

    # Validate required fields
    if not token:
        return {
            'success': False,
            'message': 'Token is required',
            'errorType': 'validation'
        }, 400

    # Logout the user
    success = auth_db.logout_user(token)

    if success:
        logger.info("Logout successful")
        return {
            'success': True,
            'message': 'Logout successful'
        }, 200
    else:
        logger.error("Error logging out user")
        return {
            'success': False,
            'message': 'Error logging out',
            'errorType': 'server_error'
        }, 500
