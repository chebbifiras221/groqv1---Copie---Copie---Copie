import os
import logging
import tempfile
import requests

logger = logging.getLogger("elevenlabs-tts")

class ElevenLabsTTS:
    """Text-to-speech engine using ElevenLabs API with fallback"""

    def __init__(self, api_key=None):
        """Initialize the ElevenLabs TTS engine

        Args:
            api_key (str, optional): ElevenLabs API key. If not provided, will try to get from environment.
        """
        self.use_fallback = False
        self.api_url = "https://api.elevenlabs.io/v1"

        # Get API key from parameter or environment, or use a hardcoded key as last resort
        self.api_key = api_key or os.getenv("ELEVENLABS_API_KEY") or "sk_130f021b52362c4ead667df9990294150f0e7725ba38c354"

        # Log API key status (without revealing the actual key)
        if self.api_key:
            logger.info(f"Using ElevenLabs API key: {self.api_key[:4]}...{self.api_key[-4:]}")
        else:
            logger.warning("ElevenLabs API key not found, using fallback mechanism")
            self.use_fallback = True
            return

        try:
            # Get available voices
            headers = {
                "xi-api-key": self.api_key,
                "Content-Type": "application/json"
            }

            response = requests.get(f"{self.api_url}/voices", headers=headers)
            response.raise_for_status()

            voices_data = response.json()
            self.available_voices = voices_data.get("voices", [])

            if self.available_voices:
                voice_names = [voice.get("name") for voice in self.available_voices]
                logger.info(f"Available ElevenLabs voices: {voice_names}")

                # Use a voice that's available in the free plan
                # Free voices include: "Adam", "Antoni", "Arnold", "Bella", "Domi", "Elli", "Josh", "Rachel", "Sam"
                free_voices = ["Adam", "Antoni", "Arnold", "Bella", "Domi", "Elli", "Josh", "Rachel", "Sam"]

                # First try to find a male voice from the free voices
                free_male_voices = [v for v in self.available_voices if v.get("name") in ["Adam", "Antoni", "Arnold", "Josh", "Sam"]]

                if free_male_voices:
                    # Use the first available free male voice
                    selected_voice = free_male_voices[0]
                    self.default_voice_id = selected_voice.get("voice_id")
                    self.default_voice_name = selected_voice.get("name")
                    logger.info(f"Selected free male voice: {self.default_voice_name} with ID: {self.default_voice_id}")
                elif self.available_voices:
                    # Fall back to the first available voice
                    self.default_voice_id = self.available_voices[0].get("voice_id")
                    self.default_voice_name = self.available_voices[0].get("name")
                    logger.info(f"No free male voices found, using default voice: {self.default_voice_name}")
                else:
                    # No voices available, use fallback
                    logger.warning("No voices available from ElevenLabs")
                    self.use_fallback = True
            else:
                logger.warning("No voices available from ElevenLabs")
                self.use_fallback = True

            logger.info("ElevenLabs TTS engine initialized successfully")
        except Exception as e:
            logger.error(f"Error initializing ElevenLabs TTS engine: {e}")
            logger.warning("Using fallback mechanism for TTS")
            self.use_fallback = True

    def synthesize(self, text, voice_name=None):
        """Synthesize speech from text using ElevenLabs or fallback

        Args:
            text (str): The text to synthesize
            voice_name (str, optional): The voice name to use. Defaults to None (uses default voice).

        Returns:
            bytes: The audio data as bytes
        """
        if not text:
            logger.warning("Empty text provided, cannot synthesize speech")
            return None

        # If we're using the fallback mechanism, generate simple audio
        if self.use_fallback:
            return self._generate_fallback_audio(text)

        # Use the default voice (which should be a free voice)
        voice_id = self.default_voice_id
        logger.info(f"Using voice: {self.default_voice_name} (ID: {voice_id})")

        # Log if a different voice was requested
        if voice_name and voice_name != self.default_voice_name:
            logger.info(f"Voice '{voice_name}' was requested, but using {self.default_voice_name} instead")

        try:
            logger.info(f"Synthesizing speech with ElevenLabs: {text[:50]}...")

            # Validate API key
            if not self.api_key or len(self.api_key) < 10:
                logger.error("Invalid ElevenLabs API key")
                return self._generate_fallback_audio(text)

            # Generate audio using ElevenLabs API
            headers = {
                "xi-api-key": self.api_key,
                "Content-Type": "application/json"
            }

            # Use the same model and settings as the frontend
            data = {
                "text": text,
                "model_id": "eleven_monolingual_v1",
                "voice_settings": {
                    "stability": 0.5,
                    "similarity_boost": 0.75
                }
            }

            # Log the API request details (without the key)
            logger.info(f"Making ElevenLabs API request to voice ID: {voice_id}")

            # Make the API request
            response = requests.post(
                f"{self.api_url}/text-to-speech/{voice_id}?output_format=mp3_44100_128",
                headers=headers,
                json=data
            )

            # Check for specific error codes
            if response.status_code == 401:
                logger.error("ElevenLabs API key unauthorized. Please check your API key.")
                return self._generate_fallback_audio(text)

            response.raise_for_status()

            # Get the audio data
            audio_data = response.content

            logger.info(f"Speech synthesis complete, audio size: {len(audio_data)} bytes")
            return audio_data

        except Exception as e:
            logger.error(f"Error in speech synthesis: {e}")
            logger.warning("Falling back to simple audio generation")
            return self._generate_fallback_audio(text)

    def _generate_fallback_audio(self, text):
        """Generate a simple audio file with silence as a fallback

        Args:
            text (str): The text to synthesize (used to determine duration)

        Returns:
            bytes: The audio data as bytes
        """
        try:
            # Choose duration based on text length
            if len(text) < 50:
                duration = 2.0  # seconds
            elif len(text) < 200:
                duration = 5.0  # seconds
            else:
                duration = 10.0  # seconds

            logger.info(f"Generating fallback audio for text: {text[:50]}... (duration: {duration}s)")

            # Create a temporary file to save the audio
            with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as temp_file:
                temp_path = temp_file.name

            # Generate a silent WAV file
            sample_rate = 24000
            num_samples = int(duration * sample_rate)

            # Create a silent WAV file (all zeros)
            with open(temp_path, 'wb') as f:
                # WAV header
                f.write(b'RIFF')
                f.write((36 + num_samples * 2).to_bytes(4, 'little'))  # File size
                f.write(b'WAVE')
                f.write(b'fmt ')
                f.write((16).to_bytes(4, 'little'))  # Subchunk1Size
                f.write((1).to_bytes(2, 'little'))  # AudioFormat (PCM)
                f.write((1).to_bytes(2, 'little'))  # NumChannels (Mono)
                f.write((sample_rate).to_bytes(4, 'little'))  # SampleRate
                f.write((sample_rate * 2).to_bytes(4, 'little'))  # ByteRate
                f.write((2).to_bytes(2, 'little'))  # BlockAlign
                f.write((16).to_bytes(2, 'little'))  # BitsPerSample
                f.write(b'data')
                f.write((num_samples * 2).to_bytes(4, 'little'))  # Subchunk2Size

                # Audio data (silence)
                for _ in range(num_samples):
                    f.write((0).to_bytes(2, 'little'))

            # Read the audio file
            with open(temp_path, 'rb') as f:
                audio_bytes = f.read()

            # Clean up the temporary file
            os.unlink(temp_path)

            logger.info(f"Fallback audio generation complete, size: {len(audio_bytes)} bytes")
            return audio_bytes

        except Exception as e:
            logger.error(f"Error generating fallback audio: {e}")
            return None

    def get_available_voices(self):
        """Get a list of available voices

        Returns:
            list: A list of available voice names
        """
        if self.use_fallback:
            return []

        return [voice.get("name") for voice in self.available_voices]
