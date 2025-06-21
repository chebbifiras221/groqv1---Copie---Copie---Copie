"""
Authentication database module for user management.
This module provides functions for user registration, login, and token management
using the same SQLite database as the conversations.
"""

import uuid
import logging
import hashlib
import secrets
import os
import jwt
from datetime import datetime, timedelta, timezone
from typing import Dict, Any, Optional, Tuple

from db_utils import (
    get_db_connection,
    release_connection,
    execute_query,
    get_record_by_id
)

# Get logger for this module
logger = logging.getLogger("auth-db")

# JWT configuration
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION = 24  # hours

# Secret key for JWT token generation - should be stored in environment variables in production
# We'll store it in a file to persist between server restarts
JWT_SECRET_FILE = os.path.join(os.path.dirname(__file__), "jwt_secret.key")

# Load or generate JWT secret
def get_jwt_secret():
    try:
        # Check if the secret file exists
        if os.path.exists(JWT_SECRET_FILE):
            # Load the secret from the file
            with open(JWT_SECRET_FILE, 'r') as f:
                secret = f.read().strip()
                logger.info("JWT secret loaded from file")
                return secret

        # Generate a new secret
        secret = secrets.token_hex(32)

        # Save the secret to the file
        with open(JWT_SECRET_FILE, 'w') as f:
            f.write(secret)

        logger.info("New JWT secret generated and saved to file")
        return secret
    except Exception as e:
        logger.error(f"Error handling JWT secret: {e}")
        # Fallback to a new secret
        return secrets.token_hex(32)

# Get the JWT secret
JWT_SECRET = get_jwt_secret()

def init_auth_db():
    """Initialize the authentication tables in the database"""
    conn = get_db_connection()
    try:
        cursor = conn.cursor()

        # Create users table if it doesn't exist
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        ''')

        # Create tokens table for session management
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS tokens (
            token TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
        ''')

        conn.commit()
        logger.info("Auth database initialized")
    except Exception as e:
        logger.error(f"Error initializing auth database: {e}")
        conn.rollback()
        raise
    finally:
        release_connection(conn)

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

def register_user(username: str, password: str) -> Tuple[bool, str, Optional[Dict[str, Any]]]:
    """
    Register a new user.

    Args:
        username: Username for the new user
        password: Password for the new user

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

        # Create new user
        user_id = str(uuid.uuid4())
        password_hash = hash_password(password)
        now = datetime.now().isoformat()

        # Insert user into database
        execute_query(
            "INSERT INTO users (id, username, password_hash, created_at) VALUES (?, ?, ?, ?)",
            (user_id, username, password_hash, now),
            commit=True
        )

        # Return user data without password hash
        user_data = {
            "id": user_id,
            "username": username,
            "created_at": now
        }

        return True, "User registered successfully", user_data
    except Exception as e:
        logger.error(f"Error registering user: {e}")
        return False, f"Registration error: {str(e)}", None

def login_user(username: str, password: str) -> Tuple[bool, str, Optional[Dict[str, Any]]]:
    """
    Authenticate a user and generate a JWT token.

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
            return False, "User does not exist", None

        # Verify password
        if not verify_password(user["password_hash"], password):
            return False, "Password is incorrect", None

        # Generate JWT token
        # Use timezone-aware objects for UTC time
        now = datetime.now(timezone.utc)
        expiration = now + timedelta(hours=JWT_EXPIRATION)

        token_data = {
            "sub": user["id"],
            "username": user["username"],
            "exp": expiration
        }
        token = jwt.encode(token_data, JWT_SECRET, algorithm=JWT_ALGORITHM)

        # Store token in database
        execute_query(
            "INSERT INTO tokens (token, user_id) VALUES (?, ?)",
            (token, user["id"]),
            commit=True
        )

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
            logger.warning(f"User {user_id} not found for token")
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

def logout_user(token: str) -> bool:
    """
    Invalidate a user's token by removing it from the database.

    Args:
        token: JWT token to invalidate

    Returns:
        True if successful, False otherwise
    """
    try:
        # Remove token from database
        execute_query(
            "DELETE FROM tokens WHERE token = ?",
            (token,),
            commit=True
        )
        return True
    except Exception as e:
        logger.error(f"Error logging out user: {e}")
        return False
