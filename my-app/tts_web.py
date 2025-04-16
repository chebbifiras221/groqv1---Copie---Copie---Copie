import logging
import json

logger = logging.getLogger("web-tts")

class WebTTS:
    """Text-to-speech engine using web browser's speech synthesis"""

    def __init__(self):
        """Initialize the Web TTS engine"""
        self.default_voice_name = "Web Voice"
        self.use_fallback = False
        logger.info("Web TTS engine initialized")

    def get_available_voices(self):
        """Get a list of available voices

        Returns:
            list: A list of available voice names
        """
        return ["Web Voice"]

    def synthesize(self, text, voice_name=None):
        """Synthesize speech from text

        Args:
            text (str): The text to synthesize
            voice_name (str, optional): The voice name to use. Defaults to None (uses default voice).

        Returns:
            bytes: The audio data as bytes (in this case, a JSON message for the frontend)
        """
        if not text:
            logger.warning("Empty text provided, cannot synthesize speech")
            return None

        try:
            logger.info(f"Preparing text for web TTS: {text[:50]}...")

            # For web TTS, we don't actually generate audio here
            # Instead, we create a JSON message that tells the frontend to use web speech synthesis
            web_tts_message = {
                "type": "web_tts",
                "text": text,
                "voice": voice_name or self.default_voice_name
            }

            # Convert the message to JSON and then to bytes
            message_bytes = json.dumps(web_tts_message).encode('utf-8')

            logger.info("Web TTS preparation complete")
            return message_bytes

        except Exception as e:
            logger.error(f"Error in web TTS preparation: {e}")
            return None
