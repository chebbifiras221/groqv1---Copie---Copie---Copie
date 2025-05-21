"""
Database utility functions for managing SQLite connections and common operations.
This module provides a connection pool and utility functions for database operations.
"""

import sqlite3
import logging
import threading
from typing import Any, Dict, List, Optional, Tuple, Union

logger = logging.getLogger("db-utils")

# Database file path - use absolute path for better reliability
import os
DB_FILE = os.path.abspath(os.path.join(os.path.dirname(__file__), "conversations.db"))

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

            # Enable WAL mode for better crash recovery
            try:
                conn.execute("PRAGMA journal_mode=WAL")
                conn.execute("PRAGMA synchronous=NORMAL")
                logger.debug("WAL mode enabled for new database connection")
            except sqlite3.Error as e:
                logger.warning(f"Failed to enable WAL mode: {e}")

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

    def shutdown(self):
        """Properly close all connections during shutdown"""
        with self._lock:
            # First checkpoint the database
            try:
                conn = self.get_connection()
                conn.execute("PRAGMA wal_checkpoint(FULL)")
                self.release_connection(conn)
                logger.info("Database checkpoint completed during shutdown")
            except Exception as e:
                logger.error(f"Error during shutdown checkpoint: {e}")

            # Close all connections in the pool
            for conn in self.pool:
                try:
                    conn.close()
                    logger.debug("Closed pooled connection during shutdown")
                except Exception as e:
                    logger.error(f"Error closing pooled connection: {e}")

            # Close all in-use connections
            for conn in self.in_use:
                try:
                    conn.close()
                    logger.debug("Closed in-use connection during shutdown")
                except Exception as e:
                    logger.error(f"Error closing in-use connection: {e}")

            # Clear the pools
            self.pool = []
            self.in_use = set()
            logger.info("All database connections closed during shutdown")

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

def get_record_by_id(table: str, record_id: str, fields: List[str] = None) -> Optional[Dict[str, Any]]:
    """
    Get a record from a table by its ID.

    Args:
        table: Table name
        record_id: Record ID
        fields: List of fields to retrieve (None for all fields)

    Returns:
        Record as a dictionary if found, None otherwise
    """
    field_list = "*" if not fields else ", ".join(fields)
    query = f"SELECT {field_list} FROM {table} WHERE id = ?"
    return execute_query(query, (record_id,), fetch_one=True)

def count_records(table: str, where_clause: str = None, params: Tuple = ()) -> int:
    """
    Count records in a table with an optional WHERE clause.

    Args:
        table: Table name
        where_clause: WHERE clause without the 'WHERE' keyword (optional)
        params: Parameters for the WHERE clause (optional)

    Returns:
        Number of records
    """
    query = f"SELECT COUNT(*) as count FROM {table}"
    if where_clause:
        query += f" WHERE {where_clause}"

    result = execute_query(query, params, fetch_one=True)
    return result["count"] if result else 0

def batch_update(table: str, field_updates: Dict[str, Any], where_clause: str, params: Tuple = ()) -> bool:
    """
    Update multiple records in a table.

    Args:
        table: Table name
        field_updates: Dictionary of field names and values to update
        where_clause: WHERE clause without the 'WHERE' keyword
        params: Parameters for the WHERE clause

    Returns:
        True if successful, False otherwise
    """
    if not field_updates:
        return False

    set_clause = ", ".join([f"{field} = ?" for field in field_updates.keys()])
    update_values = tuple(field_updates.values())

    query = f"UPDATE {table} SET {set_clause} WHERE {where_clause}"
    all_params = update_values + params

    return execute_query(query, all_params, commit=True) is not None

def checkpoint_database():
    """
    Force a checkpoint of the database to ensure all changes are written to disk.
    This is especially important for WAL mode.
    """
    conn = get_db_connection()
    try:
        conn.execute("PRAGMA wal_checkpoint(FULL)")
        logger.info("Database checkpoint completed successfully")
    except Exception as e:
        logger.error(f"Error during database checkpoint: {e}")
    finally:
        release_connection(conn)

def enable_wal_mode():
    """
    Enable Write-Ahead Logging mode for better crash recovery.
    Should be called during application startup.
    """
    conn = get_db_connection()
    try:
        conn.execute("PRAGMA journal_mode=WAL")
        conn.execute("PRAGMA synchronous=NORMAL")
        logger.info("WAL mode enabled for database")
    except Exception as e:
        logger.error(f"Error enabling WAL mode: {e}")
    finally:
        release_connection(conn)

def close_all_connections():
    """
    Close all database connections in the pool.
    This should be called during application shutdown.
    """
    _pool.shutdown()

def ensure_db_file_exists():
    """
    Check if the database file exists and create it if it doesn't.
    This should be called during application startup.
    """
    db_dir = os.path.dirname(DB_FILE)

    # Create the directory if it doesn't exist
    if not os.path.exists(db_dir):
        try:
            os.makedirs(db_dir)
            logger.info(f"Created database directory: {db_dir}")
        except Exception as e:
            logger.error(f"Error creating database directory: {e}")

    # Check if the database file exists
    if not os.path.exists(DB_FILE):
        try:
            # Create an empty database file
            conn = sqlite3.connect(DB_FILE)
            conn.close()
            logger.info(f"Created empty database file: {DB_FILE}")
        except Exception as e:
            logger.error(f"Error creating database file: {e}")
    else:
        logger.info(f"Database file exists: {DB_FILE}")

    # Log the absolute path to the database file
    logger.info(f"Using database file: {os.path.abspath(DB_FILE)}")
