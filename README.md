# Programming Teacher AI

A voice and text-based AI assistant designed to help users learn programming concepts, debug code, and answer technical questions.

## Features

- **Voice Interaction**: Speak naturally with the AI assistant using your microphone
- **Text Input**: Type questions or commands for precise interactions
- **Code Editor**: Write and share code with syntax highlighting and formatting
- **Conversation History**: Access, manage, rename, and delete past conversations
- **Text-to-Speech**: Listen to AI responses with high-quality voice synthesis
- **User Authentication**: Secure login, registration, and user-specific data
- **Mobile Responsive**: Works seamlessly on desktop and mobile devices
- **Accessibility**: Fully accessible with keyboard navigation and screen reader support
- **Dark/Light Themes**: Support for both dark and light color schemes
- **Graceful Shutdown**: Proper database connection cleanup and data persistence

## Technology Stack

- **Frontend**: Next.js, React, TypeScript, Tailwind CSS
- **Backend**: Python with LiveKit Agents
- **Database**: SQLite with WAL mode for data persistence
- **Authentication**: JWT-based authentication with secure password hashing
- **Voice Processing**: LiveKit for real-time audio streaming
- **AI**: Groq API for fast, high-quality AI responses
- **Text-to-Speech**: Web Speech API with voice selection

## Getting Started

### Prerequisites

- Node.js 18+ and npm/yarn for the frontend
- Python 3.9+ for the backend
- LiveKit account for voice processing
- Groq API key for AI responses
- PyJWT for authentication (installed via requirements.txt)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/programming-teacher-ai.git
   cd programming-teacher-ai
   ```

2. Install backend dependencies:
   ```bash
   cd my-app
   pip install -r requirements.txt
   ```

3. Install frontend dependencies:
   ```bash
   cd my-app-front
   npm install
   # or
   yarn install
   ```

4. Create a `.env.local` file in the backend directory with the following variables:
   ```
   LIVEKIT_URL=your_livekit_url
   LIVEKIT_API_KEY=your_livekit_api_key
   LIVEKIT_API_SECRET=your_livekit_api_secret
   GROQ_API_KEY=your_groq_api_key
   ```

5. Create a `.env.local` file in the frontend directory with the following variables:
   ```
   NEXT_PUBLIC_LIVEKIT_URL=your_livekit_url
   ```

6. Start the backend server:
   ```bash
   cd my-app
   python main.py
   ```

7. Start the frontend development server in a separate terminal:
   ```bash
   cd my-app-front
   npm run dev
   # or
   yarn dev
   ```

8. Open [http://localhost:3000](http://localhost:3000) in your browser.

9. To gracefully shut down the backend server, press the '9' key in the terminal.

## Usage

1. **Register or Login**: Create an account or login with your credentials.
2. **Connect to the Assistant**: Click the "Connect to Assistant" button on the landing page.
3. **Voice Interaction**: Click the microphone button or press and hold the spacebar to speak.
4. **Text Input**: Type your message in the input field at the bottom of the screen.
5. **Code Editor**: Click the code button to open the code editor, write your code, and submit it.
6. **Manage Conversations**: Access your conversation history from the sidebar (or top-left menu on mobile).
7. **Switch Modes**: Toggle between Teacher mode and Q&A mode as needed.

## Development

### Project Structure

#### Backend Structure
- `my-app/`: Backend Python application
  - `main.py`: Main application entry point
  - `auth_api.py`: Authentication API endpoints
  - `auth_db.py`: Authentication database functions
  - `db_utils.py`: Database utility functions
  - `shutdown.py`: Graceful shutdown handling
  - `database.py`: Conversation database functions
  - `tts_web.py`: Text-to-speech functionality

#### Frontend Structure

- `my-app-front/`: Frontend Next.js application
  - `app/`: Next.js app router files
    - `api/`: API routes for token generation, disconnection, and authentication
    - `auth/`: Authentication-related components and pages
    - `globals.css`: Global styles and CSS variables
  - `light-theme.css`: Light theme specific styles
- `components/`: React components
  - `ui/`: Reusable UI components (buttons, modals, toasts, etc.)
  - `code/`: Code editor and syntax highlighting components
  - `conversation/`: Conversation management components
  - `visualization/`: Audio visualization components
- `hooks/`: Custom React hooks
  - `use-ai-responses.ts`: Manages AI responses and TTS
  - `use-auth.tsx`: Handles user authentication
  - `use-conversation.ts`: Manages conversation history
  - `use-connection.tsx`: Handles LiveKit connection
  - `use-error-handler.ts`: Centralized error handling
  - `use-settings.tsx`: User settings management
  - `use-theme.tsx`: Theme switching functionality
  - `use-transcriber.ts`: Speech-to-text functionality
  - `use-web-tts.ts`: Text-to-speech functionality
- `lib/`: Utility functions and helpers
- `public/`: Static assets and images

### Key Components

- `room.tsx`: Main LiveKit room component
- `playground.tsx`: Main interface container
- `typewriter.tsx`: Displays conversation history
- `text-input.tsx`: Text input component
- `code-editor.tsx`: Code editor component
- `conversation-manager.tsx`: Manages conversation history

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- [LiveKit](https://livekit.io/) for real-time audio streaming
- [Groq](https://groq.com/) for AI processing
- [Next.js](https://nextjs.org/) for the React framework
- [Tailwind CSS](https://tailwindcss.com/) for styling
- [PyJWT](https://pyjwt.readthedocs.io/) for JWT authentication
- [SQLite](https://www.sqlite.org/) for database storage
