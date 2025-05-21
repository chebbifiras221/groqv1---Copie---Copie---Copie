"""
Graceful shutdown handling for the application.
This module provides functions to handle termination signals and ensure
database connections are properly closed before the application exits.
"""

import signal
import sys
import logging
import time
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
    # Register signal handler for termination signal
    signal.signal(signal.SIGTERM, signal_handler)  # Termination signal
    logger.info("Signal handlers registered for graceful shutdown")

    # Start a thread to listen for the '9' key
    import threading
    import platform

    # Different keyboard input handling based on platform
    if platform.system() == 'Windows':
        # Windows-specific keyboard input
        try:
            import msvcrt

            def keyboard_listener():
                """Listen for '9' keypress and trigger shutdown (Windows)"""
                logger.info("Keyboard listener started. Press '9' to shutdown gracefully.")
                while not shutdown_in_progress:
                    try:
                        if msvcrt.kbhit():  # Check if a key has been pressed
                            key = msvcrt.getch()  # Get the key
                            # '9' key is ASCII 57
                            if key == b'9':
                                print("\n=== Number '9' key pressed ===")
                                logger.info("Number '9' key detected, initiating graceful shutdown...")
                                signal_handler(signal.SIGTERM, None)
                                break
                    except Exception as e:
                        logger.error(f"Error in keyboard listener: {e}")
                        break
                    # Sleep briefly to avoid consuming too much CPU
                    time.sleep(0.1)
        except ImportError:
            logger.error("msvcrt module not available on this Windows system")

            def keyboard_listener():
                """Dummy keyboard listener when msvcrt is not available"""
                logger.warning("Keyboard listener not available. Use SIGTERM to shutdown.")
                while not shutdown_in_progress:
                    time.sleep(1)
    else:
        # Unix-like systems (Linux, macOS)
        try:
            import termios
            import tty
            import sys
            import select

            def keyboard_listener():
                """Listen for '9' keypress and trigger shutdown (Unix)"""
                logger.info("Keyboard listener started. Press '9' to shutdown gracefully.")

                # Save the terminal settings
                fd = sys.stdin.fileno()
                old_settings = termios.tcgetattr(fd)

                try:
                    # Set the terminal to raw mode
                    tty.setraw(fd)

                    while not shutdown_in_progress:
                        # Check if there's input available
                        if select.select([sys.stdin], [], [], 0.1)[0]:
                            key = sys.stdin.read(1)
                            if key == '9':
                                print("\n=== Number '9' key pressed ===")
                                logger.info("Number '9' key detected, initiating graceful shutdown...")
                                # Restore terminal settings before shutdown
                                termios.tcsetattr(fd, termios.TCSADRAIN, old_settings)
                                signal_handler(signal.SIGTERM, None)
                                break
                        # Sleep briefly to avoid consuming too much CPU
                        time.sleep(0.1)
                except Exception as e:
                    logger.error(f"Error in keyboard listener: {e}")
                finally:
                    # Restore terminal settings
                    termios.tcsetattr(fd, termios.TCSADRAIN, old_settings)
        except (ImportError, AttributeError):
            logger.error("Terminal control modules not available on this system")

            def keyboard_listener():
                """Dummy keyboard listener when terminal control is not available"""
                logger.warning("Keyboard listener not available. Use SIGTERM to shutdown.")
                while not shutdown_in_progress:
                    time.sleep(1)

    # Start the keyboard listener in a daemon thread
    keyboard_thread = threading.Thread(target=keyboard_listener, daemon=True)
    keyboard_thread.start()

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
