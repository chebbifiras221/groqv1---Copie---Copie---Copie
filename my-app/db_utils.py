"""
Database utility functions for managing SQLite connections and common operations.
This module provides a connection pool and utility functions for database operations.
"""

import sqlite3
import logging
import threading
from typing import Any, Dict, List, Optional, Tuple, Union

logger = logging.getLogger("db-utils")

# Database file path
DB_FILE = "conversations.db"

# Simple connection pool for SQLite
class ConnectionPool:
    """A simple connection pool for SQLite to manage database connections efficiently."""
    
    _instance = None
    _lock = threading.Lock()

    def __new__(cls):
        with cls._lock:
            if cls._instance is None:
                cls._instance = super(ConnectionPool, cls).__new__(cls)
                cls._instance.pool = []
                cls._instance.max_connections = 5
                cls._instance.in_use = set()
            return cls._instance

    def get_connection(self):
        """Get a connection from the pool or create a new one"""
        with self._lock:
            # Try to reuse an existing connection
            while self.pool:
                conn = self.pool.pop()
                if conn not in self.in_use:
                    try:
                        # Test if connection is still valid
                        conn.execute("SELECT 1")
                        self.in_use.add(conn)
                        return conn
                    except sqlite3.Error:
                        # Connection is no longer valid, discard it
                        continue

            # Create a new connection
            conn = sqlite3.connect(DB_FILE, check_same_thread=False)
            conn.row_factory = sqlite3.Row  # Return rows as dictionaries
            self.in_use.add(conn)
            return conn

    def release_connection(self, conn):
        """Return a connection to the pool"""
        with self._lock:
            if conn in self.in_use:
                self.in_use.remove(conn)
                if len(self.pool) < self.max_connections:
                    self.pool.append(conn)
                else:
                    conn.close()

# Initialize the connection pool
_pool = ConnectionPool()

def get_db_connection():
    """Get a connection from the pool"""
    return _pool.get_connection()

def release_connection(conn):
    """Release a connection back to the pool"""
    _pool.release_connection(conn)

def check_column_exists(conn, table: str, column: str) -> bool:
    """Check if a column exists in a table"""
    cursor = conn.cursor()
    cursor.execute(f"PRAGMA table_info({table})")
    columns = cursor.fetchall()
    return any(col["name"] == column for col in columns)

def execute_query(query: str, params: Tuple = (), fetch_all: bool = False, 
                  fetch_one: bool = False, commit: bool = False) -> Optional[Union[List[Dict[str, Any]], Dict[str, Any]]]:
    """
    Execute a SQL query with error handling and connection management.
    
    Args:
        query: SQL query to execute
        params: Parameters for the query
        fetch_all: Whether to fetch all results
        fetch_one: Whether to fetch one result
        commit: Whether to commit the transaction
        
    Returns:
        Query results if fetch_all or fetch_one is True, None otherwise
    """
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(query, params)
        
        result = None
        if fetch_all:
            result = [dict(row) for row in cursor.fetchall()]
        elif fetch_one:
            row = cursor.fetchone()
            result = dict(row) if row else None
            
        if commit:
            conn.commit()
            
        return result
    except Exception as e:
        if commit:
            conn.rollback()
        logger.error(f"Database error executing query: {e}")
        raise
    finally:
        release_connection(conn)

def execute_transaction(queries: List[Dict[str, Any]]) -> bool:
    """
    Execute multiple queries in a single transaction.
    
    Args:
        queries: List of dictionaries with keys:
            - query: SQL query string
            - params: Parameters for the query (optional)
            
    Returns:
        True if transaction was successful, False otherwise
    """
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("BEGIN TRANSACTION")
        
        for query_data in queries:
            query = query_data["query"]
            params = query_data.get("params", ())
            cursor.execute(query, params)
            
        conn.commit()
        return True
    except Exception as e:
        conn.rollback()
        logger.error(f"Transaction error: {e}")
        return False
    finally:
        release_connection(conn)
