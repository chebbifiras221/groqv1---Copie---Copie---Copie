<a href="https://livekit.io/">
  <img src="./.github/assets/livekit-mark.png" alt="LiveKit logo" width="100" height="100">
</a>

# Python Speech Transcriber Agent

<p>
  <a href="https://cloud.livekit.io/projects/p_/sandbox"><strong>Deploy a sandbox app</strong></a>
  •
  <a href="https://docs.livekit.io/agents/overview/">LiveKit Agents Docs</a>
  •
  <a href="https://livekit.io/cloud">LiveKit Cloud</a>
  •
  <a href="https://blog.livekit.io/">Blog</a>
</p>

A voice assistant application using LiveKit, Groq API, and a text-to-speech (TTS) engine.

## Dev Setup

Clone the repository and install dependencies to a virtual environment:

```console
cd transcription-groq
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

Set up the environment by copying `.env.example` to `.env.local` and filling in the required values:

- `LIVEKIT_URL`
- `LIVEKIT_API_KEY`
- `LIVEKIT_API_SECRET`
- `GROQ_API_KEY`

You can also do this automatically using the LiveKit CLI:

```console
lk app env --write
```

Run the agent:

```console
python3 main.py dev
```

This agent requires a frontend application to communicate with. You can use one of our example frontends in [livekit-examples](https://github.com/livekit-examples/), create your own following one of our [client quickstarts](https://docs.livekit.io/realtime/quickstarts/), or test instantly against one of our hosted [Sandbox](https://cloud.livekit.io/projects/p_/sandbox) frontends.

## Text-to-Speech (TTS)

The application uses Coqui TTS, an open-source Text-to-Speech toolkit that provides high-quality speech synthesis.

### Installing Coqui TTS

The application will automatically install Coqui TTS and its dependencies when it starts. However, you can also install it manually with the following command:

```bash
pip install coqui-tts>=0.26.0
```

> **Note for Python 3.12 users**: Make sure to use numpy version 1.26.0 or higher for compatibility with Python 3.12.

### Features of Coqui TTS

- Supports multiple languages and voices
- Offers various TTS models (Tacotron2, VITS, FastSpeech2, etc.)
- Runs locally without requiring an API key
- Provides a fallback mechanism for when TTS fails

### Previous Implementations

A previous implementation using ElevenLabs TTS has been saved as a checkpoint in the `checkpoints/elevenlabs-tts` directory. This can be restored if needed.

### How to Implement a New TTS Engine

To implement a new TTS engine:

1. Create a new file (e.g., `tts_new.py`) with a class that has the following methods:
   - `__init__()`: Initialize the TTS engine
   - `synthesize(text, voice_name=None)`: Synthesize speech from text and return the audio data as bytes
   - `get_available_voices()`: Return a list of available voice names

2. Update the `main.py` file to use the new TTS engine:
   - Import the new TTS class
   - Update the `initialize_tts()` function to use the new TTS class
   - Update the messages to use the new TTS provider name

3. Update the `.env.local` file with any required API keys or configuration for the new TTS engine.
