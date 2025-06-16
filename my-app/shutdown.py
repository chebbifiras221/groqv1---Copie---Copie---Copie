"""
Graceful shutdown handling for the application.
This module provides functions to handle termination signals and ensure
database connections are properly closed before the application exits.
"""

import logging
import signal
import sys
from typing import Callable, List

logger = logging.getLogger("shutdown-handler")

# Global flag to indicate shutdown is in progress
shutdown_in_progress = False

# List of shutdown handlers to call
shutdown_handlers: List[Callable] = []

def register_shutdown_handler(handler: Callable) -> None:
    """
    Register a function to be called during shutdown.

    Args:
        handler: Function to call during shutdown
    """
    if handler not in shutdown_handlers:
        shutdown_handlers.append(handler)
        logger.debug(f"Registered shutdown handler: {handler.__name__}")

def signal_handler(sig: int, _=None) -> None:
    """
    Handle termination signals by gracefully shutting down the application.

    Args:
        sig: Signal number
        _: Unused parameter (frame in signal handlers)
    """
    global shutdown_in_progress

    signal_name = "SIGINT" if sig == signal.SIGINT else "SIGTERM" if sig == signal.SIGTERM else f"Signal {sig}"

    if shutdown_in_progress:
        logger.warning(f"{signal_name} received while shutdown in progress, forcing exit")
        sys.exit(1)

    logger.info(f"{signal_name} received, gracefully shutting down...")
    shutdown_in_progress = True

    # Call all registered shutdown handlers
    for handler in shutdown_handlers:
        try:
            logger.info(f"Calling shutdown handler: {handler.__name__}")
            handler()
        except Exception as e:
            logger.error(f"Error in shutdown handler {handler.__name__}: {e}")

    logger.info("Shutdown complete, exiting")
    sys.exit(0)

def setup_signal_handlers() -> None:
    """
    Set up signal handlers for graceful shutdown.
    """
    # Register signal handlers for termination signals
    signal.signal(signal.SIGTERM, signal_handler)  # Termination signal
    signal.signal(signal.SIGINT, signal_handler)   # Interrupt signal (Ctrl+C)
    logger.info("Signal handlers registered for graceful shutdown (SIGTERM, SIGINT)")

def close_db_connections() -> None:
    """
    Close all database connections.
    This function should be registered as a shutdown handler.
    """
    from db_utils import close_all_connections

    try:
        # Checkpoint the database before closing connections
        from db_utils import checkpoint_database
        checkpoint_database()
        logger.info("Database checkpoint completed during shutdown")
    except Exception as e:
        logger.error(f"Error during database checkpoint: {e}")

    try:
        # Close all database connections
        close_all_connections()
        logger.info("All database connections closed successfully")
    except Exception as e:
        logger.error(f"Error closing database connections: {e}")

def initialize_shutdown_handling() -> None:
    """
    Initialize shutdown handling by setting up signal handlers and
    registering shutdown handlers.
    """
    # Set up signal handlers
    setup_signal_handlers()

    # Register shutdown handlers
    register_shutdown_handler(close_db_connections)

    logger.info("Shutdown handling initialized")
