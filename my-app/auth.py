"""
Authentication module for user management and authentication.
This module provides functions for user registration, login, and token management.
"""

import uuid
import logging
import hashlib
import secrets
import jwt
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, Tuple

from db_utils import (
    get_db_connection,
    release_connection,
    execute_query,
    execute_transaction,
    get_record_by_id
)

logger = logging.getLogger("auth")

# Secret key for JWT token generation - should be stored in environment variables in production
JWT_SECRET = secrets.token_hex(32)
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION = 24  # hours

def hash_password(password: str) -> str:
    """
    Hash a password using SHA-256 with a salt.
    In a production environment, use a more secure method like bcrypt.
    """
    salt = secrets.token_hex(16)
    pwdhash = hashlib.sha256((password + salt).encode()).hexdigest()
    return f"{salt}${pwdhash}"

def verify_password(stored_password: str, provided_password: str) -> bool:
    """
    Verify a password against its stored hash.
    """
    try:
        salt, stored_hash = stored_password.split('$')
        calculated_hash = hashlib.sha256((provided_password + salt).encode()).hexdigest()
        return secrets.compare_digest(calculated_hash, stored_hash)
    except Exception as e:
        logger.error(f"Error verifying password: {e}")
        return False

def register_user(username: str, password: str, email: str = None) -> Tuple[bool, str, Optional[Dict[str, Any]]]:
    """
    Register a new user.
    
    Args:
        username: Username for the new user
        password: Password for the new user
        email: Optional email address
        
    Returns:
        Tuple containing:
        - Success flag (True/False)
        - Message (success or error message)
        - User data if successful, None otherwise
    """
    try:
        # Check if username already exists
        existing_user = execute_query(
            "SELECT id FROM users WHERE username = ?",
            (username,),
            fetch_one=True
        )
        
        if existing_user:
            return False, "Username already exists", None
            
        # Check if email already exists (if provided)
        if email:
            existing_email = execute_query(
                "SELECT id FROM users WHERE email = ?",
                (email,),
                fetch_one=True
            )
            
            if existing_email:
                return False, "Email already exists", None
        
        # Create new user
        user_id = str(uuid.uuid4())
        password_hash = hash_password(password)
        now = datetime.now().isoformat()
        
        # Insert user into database
        execute_query(
            "INSERT INTO users (id, username, password_hash, email, created_at) VALUES (?, ?, ?, ?, ?)",
            (user_id, username, password_hash, email, now),
            commit=True
        )
        
        # Get the created user
        user = get_record_by_id("users", user_id)
        if user and "password_hash" in user:
            del user["password_hash"]  # Don't return the password hash
            
        return True, "User registered successfully", user
    except Exception as e:
        logger.error(f"Error registering user: {e}")
        return False, f"Registration error: {str(e)}", None

def login_user(username: str, password: str) -> Tuple[bool, str, Optional[Dict[str, Any]]]:
    """
    Authenticate a user and return a JWT token if successful.
    
    Args:
        username: Username to authenticate
        password: Password to verify
        
    Returns:
        Tuple containing:
        - Success flag (True/False)
        - Token or error message
        - User data if successful, None otherwise
    """
    try:
        # Get user by username
        user = execute_query(
            "SELECT * FROM users WHERE username = ?",
            (username,),
            fetch_one=True
        )
        
        if not user:
            return False, "Invalid username or password", None
            
        # Verify password
        if not verify_password(user["password_hash"], password):
            return False, "Invalid username or password", None
            
        # Update last login timestamp
        now = datetime.now().isoformat()
        execute_query(
            "UPDATE users SET last_login = ? WHERE id = ?",
            (now, user["id"]),
            commit=True
        )
        
        # Generate JWT token
        token_data = {
            "sub": user["id"],
            "username": user["username"],
            "exp": datetime.utcnow() + timedelta(hours=JWT_EXPIRATION)
        }
        token = jwt.encode(token_data, JWT_SECRET, algorithm=JWT_ALGORITHM)
        
        # Don't return the password hash
        if "password_hash" in user:
            del user["password_hash"]
            
        return True, token, user
    except Exception as e:
        logger.error(f"Error logging in user: {e}")
        return False, f"Login error: {str(e)}", None

def verify_token(token: str) -> Tuple[bool, Optional[Dict[str, Any]]]:
    """
    Verify a JWT token and return the user data if valid.
    
    Args:
        token: JWT token to verify
        
    Returns:
        Tuple containing:
        - Success flag (True/False)
        - User data if successful, None otherwise
    """
    try:
        # Decode and verify the token
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        
        # Get user from database
        user_id = payload["sub"]
        user = get_record_by_id("users", user_id)
        
        if not user:
            return False, None
            
        # Don't return the password hash
        if "password_hash" in user:
            del user["password_hash"]
            
        return True, user
    except jwt.ExpiredSignatureError:
        logger.warning("Token expired")
        return False, None
    except jwt.InvalidTokenError:
        logger.warning("Invalid token")
        return False, None
    except Exception as e:
        logger.error(f"Error verifying token: {e}")
        return False, None
