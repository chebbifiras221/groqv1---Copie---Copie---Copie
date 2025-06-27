General introduction
Programming education today offers many different learning options. Students can choose from interactive coding platforms, video tutorials, and gamified learning experiences. While these tools are widely available, most lack the personalized guidance and immediate feedback that make one-on-one instruction effective. Our Programming AI Teacher addresses this problem by combining the convenience of digital tools with the personal attention of a human instructor.
Our AI teacher works with both voice and text input, combining this technology with a friendly design. Traditional educational tools often use fixed learning paths, but our system adjusts to what each student needs, helping them build confidence as they learn programming.
The system uses natural language processing(NLP) and voice recognition to create a learning environment that works for different learning preferences. Students can use voice commands, type questions, or write code directly in the built-in editor, making programming more approachable.
In the following chapters, this report will cover various aspects of the project from start to finish.
Chapter Overview
•	Chapter 1: Background and Motivation - In this chapter, we introduce our Programming AI Teacher project and present its purpose. We look at how AI is changing education, especially with generative AI and Large Language Models like GPT-4 and Claude. We examine what’s already out there - online courses like Udemy and Coursera, coding platforms like Codecademy, and AI tools like GitHub Copilot. Most of these have the problem of not being personal enough. Our solution fixes these issues by letting students choose between structured courses or quick answers and talk to the AI with voice or text. We also explain how we used Kanban to help us manage our work.
List of Tables
•	Chapter 2: Requirements Analysis and Specification - In this chapter, we figure out what our Programming AI Teacher needs to do. We list the main features it should have, like creating educational content, offering two teaching modes, handling voice and text input, and helping with code. The chapter shows how our system works, with Python handling the backend while React and Next.js run the frontend, along with Groq providing AI responses and LiveKit managing voice communication. We create use case diagrams that show exactly how users will interact with our system.
•	Chapter 3: Conceptual study - This chapter explains how we designed our Programming AI Teacher system. We show the overall structure, like how the frontend talks to the backend, how we keep different users’ data separate, and how voice and text features work together. We draw diagrams that show what happens when someone logs in, has a conversation, or manages their chat history. The chapter also explains how we store data in our database and how we handle voice processing, turning speech into text and text back into speech.
•	Chapter 4: Implementation - This chapter shows how we actually built our Programming AI Teacher. We start by explaining our development setup, then we talk about the technologies we picked. We explain how we started with a simple prototype and gradually improved it into the final project. The chapter walks through building the user interface, setting up voice features, creating the code editor, and making sure everything works together smoothly.
Each chapter ends with a summary of what we learned and accomplished. Together, these chapters document the complete development process of our Programming AI Teacher from initial concept to final implementation. At the end, we wrap up by discussing what we achieved, what challenges we faced, and how we could make the system even better in the future.
Chapter 1
Background and motivation
 
Introduction
In this chapter, we give an overview of the scope of our project. We will look at the context in which the project is set, examine existing solutions, and find their problems. We will present our proposed solution, outline the methodology used to achieve the project goals, and detail the work during development.
1.1	The Evolution of AI-Enhanced Education
In this section, we examine how recent advances in AI combine with established educational principles to create more effective learning experiences.
1.1.1	Generative AI
Instead of just analyzing data, generative AI produces new content. These models generate text, images, code, and audio by learning patterns from large datasets, unlike traditional AI systems that follow strict rules with recent innovations significantly enhancing their capacity to produce contextually relevant content. This technology in education allows for truly customized learning experiences that adjust to individual student needs.
1.1.2	Large Language Models
Large text data are used to train LLMs, which are specialized generative AI systems. GPT-4, Claude, and Llama are examples of models that understand context, carry on conversations, and communicate difficult concepts in simple terms. They identify patterns in communication through their ’transformer-based’ architecture with billions of parameters. LLMs provide instant help to programming students by describing ideas, providing examples, finding mistakes, and suggesting improvements. Developers can customize these models for specific applications through two main approaches.
-	Fine-tuning involves training an existing model with your own data to improve performance for specific tasks, but it requires significant computational resources and technical expertise.
-	Prompt engineering on the other hand uses carefully written instructions to guide model behavior without additional training, requiring less infrastructure but demanding precise instruction design.
1.1.3	Educational Methodology
Effective teaching creates an environment where learning and knowledge can grow rather than just being given. Active participation is more important than passive listening in modern teaching methods. The best learning happens when students use guided exploration to build understanding. For programming, scaffolding, support that slowly reduces as skills develop, works especially well. Instant feedback, and helping students understand their thought processes, greatly improve learning outcomes.
1.1.4	AI-Enhanced Teaching
AI combined with good teaching practices creates new educational opportunities. AI-enhanced instruction combines technology reliability with personal tutor attention. Programming students receive custom explanations when they need them, based on their learning preferences and knowledge level. Well-designed AI teaching systems find specific misconceptions and make needed adjustments. The best implementations handle routine explanations while building problem-solving abilities, improving rather than replacing critical thinking.
1.2	Project presentation
In this section, we will provide an overview of the project, including a description of the problem and our proposed solutions.
1.2.1	Project context
The Programming AI Teacher represents a big step forward in educational technology, specifically designed to change how programming concepts are taught and learned. This voice and text-based AI teacher is designed to create an adaptive learning experience. By using natural language processing(NLP) and speech recognition, the system provides personalized instruction that copies the experience of working with a dedicated human programming tutor.
1.2.2	Existing solutions
Traditional Online Courses (Udemy, Coursera)
Traditional online courses offer a ’learning package’ of pre-recorded video lectures, text tutorials, interactive quizzes, discussion forums, and completion certificates.
Strengths: These platforms provide complete curricula covering a wide range of programming topics with many learning paths. Content is accessible to anyone with internet access, created by industry experts and academics.
Weaknesses: These platforms does have limited personalization and lack of real-time support. Learners often receive delayed feedback, making it difficult to solve coding issues quickly. The experience tends to be passive with little adaptation to individual learning styles.
Interactive Coding Platforms (Codecademy, freeCodeCamp)
Interactive coding platforms combine browser-based code editors with step-by-step tutorials, providing immediate feedback. They use gamified learning with badges and achievements, focusing on project-based learning. Strengths: These platforms deliver hands-on learning with immediate feedback on code correctness. They also offer community support through forums.
Weaknesses: These platforms have limited depth in explaining concepts and rigid learning paths. Coding environments are simplified and may not reflect real-world setups, making transition to actual projects harder.
Debugging support is limited for complex issues.
AI Coding Assistants (GitHub Copilot, ChatGPT)
AI coding assistants provide code completion and generation with natural language explanations. They offer debugging help and can answer programming questions across multiple languages.
Strengths: These tools deliver immediate responses and generate working code examples. They explain complex concepts in simple terms and remain available 24/7.
Weaknesses: These tools lack organized educational pathways and focus on quick solutions over deep understanding. No voice interaction, limited progress tracking, and they don’t follow pedagogical best practices.
1.2.3	Limitations of existing solutions
Despite the variety of programming education tools available, several critical limitations persist:
•	Lack of Personalization means most solutions offer identical instruction rather than adapting to the individual, reducing effectiveness for learners.
•	Current tools provide limited interactivity and absence of voice interaction, relying mainly on text-based communication that misses natural engagement opportunities.
•	Many platforms suffer from poor pedagogical design, focusing on content delivery rather than educational methods. This creates an inefficient experience where learners jump between multiple platforms.
•	Without organized reinforcement, poor retention and application of programming knowledge becomes common.
•	Finally, limited accessibility in text-heavy interfaces creates barriers for learners with visual impairments or reading difficulties.
1.2.4	Proposed solution
Our project addresses these limitations through a new approach to programming education. The Programming AI Teacher combines voice and text interaction, allowing learners to engage naturally. The system offers dual teaching modes: "Teacher Mode" provides complete courses with learning goals and organized chapters, while "Q&A Mode" delivers immediate answers to specific questions. The built-in code editor with syntax highlighting removes the need to switch applications, creating an environment where learners can write and receive feedback from the AI. Conversation management enables storage and retrieval of past interactions, allowing progress tracking and lesson review.
1.3	Methodology adopted
During the course of our project, we used a specific methodology that we found fitting for our workflow to manage tasks and monitor our progress.
Kanban
The kanban methodology, an approach that focuses on continuous delivery, visual task management, and limiting work in progress, was adopted to manage and track our progress. This approach allowed us to maintain flexibility while ensuring clear visibility on task status and responsibilities.
 
Figure 1.1: Kanban Board Diagram
Conclusion
This chapter has described the Programming AI Teacher project and our educational solution scope. We examined current programming education solutions and noted their problems. Our solution aims to be more personal and interactive through voice-based interface and dual teaching modes. Combining voice interaction with organized learning paths, the
Programming AI Teacher addresses gaps in current educational technology by creating an experience resembling work with a human tutor. The combination of adaptive learning, conversation management, and code editor provides a complete environment without switching between tools.
 
Chapter 2 Requirements Analysis and
Specification 
Introduction
We will look at and outline our project’s requirements in this chapter. This analysis includes a system overview, a description of the functional and non-functional requirements, and specific use cases that show how the system is used. This approach makes sure that every part of the system is carefully thought out.
2.1	Identification of requirements
This section outlines the main functional and nonfunctional requirements of the project, making sure that it meets both user needs and quality standards.
2.1.1	Functional Requirements
Based on educational technology research, we identified the following core functional requirements:
-	Programming education content generation: The system must create organized educational content covering programming concepts, syntax explanations, and practical examples. This makes sure users get complete learning materials made for their needs.
-	Multiple teaching modes: To fit different learning situations, we designed the system to support both organized course-based learning using Teacher Mode, and direct question-answering using Q&A Mode, with proper content formatting for each mode.
-	Voice interaction capabilities: The system must recognize accents and technical terms while giving clear voice explanations.
-	Text-based conversation: For situations where voice interaction is not practical, the system also provides a text interface with support for code formatting, markdown, and educational content organization.
-	Code improvement and debugging:	Users can submit code for debugging and improvement with educational feedback from the AI teacher.
-	Concept explanation: The explanation system provides context for the concepts of programming.
2.1.2	Non-functional Requirements
Based on our research into educational technology standards, we found the following main non-functional requirements:
-	Performance and response time : AI responses must be delivered fast to keep natural conversation flow, with voice transcription processing happening in near real-time.
-	Accessibility standards : The platform offers easy and user-friendly interfaces to make sure all users can navigate easily.
-	Cross-platform compatibility : The web application must works correctly across modern browsers (Chrome, Firefox, Edge) and adapts well to different screen sizes.
-	Scalability considerations : The system architecture supports growing user loads without big performance problems, with special attention to AI service capacity and real-time communication channels.
2.1.3	System Overview
2.1.3.1	Data Flow
 
Figure 2.1: LLM interaction
The data flow in the Programming AI Teacher follows a bidirectional pattern that supports both voice and text interactions:
-	User Input : The process begins with voice input captured by the microphone or text input from the keyboard.
-	Frontend Processing : The frontend captures and streams this input, sending it to the backend.
-	Backend Processing : For voice, the backend turns audio into text. For both input types, the backend generates an appropriate AI response using the Groq API.
-	Response Delivery : The AI response is sent back to the frontend for display, and voice responses are turned into speech using the TTS engine.
-	Storage : All interactions are stored in the database to maintain conversation history.
2.1.3.2	LLM interaction
Our Programming AI Teacher processes user input to understand programming questions and generate appropriate responses The system uses Groq’s LLaMA 3.3 70B model with set parameters (temperature 0.6, top p 0.9, the first for a balance that’s reliable but still natural-sounding, with the second meaning it only considers the most likely words that make up 90% of the probability) to create correct yet easy-to-understand responses.
2.2	Requirements analysis
This section details the functional requirements using Unified Modelling Language (UML) diagrams for various use cases.
2.2.1	General Use Case
Figure 2.3 shows our system’s general use case diagram and main interactions between users and the Programming AI Teacher.
 
Figure 2.2: General Use Case Diagram
2.2.2	Use Case : User Authentication
The use case diagram 2.4 below illustrates the user authentication process.
 
Figure 2.3: Use Case Diagram of "User Authentication"
The table 2.1 below further details this use case.
Actor	User
Description	Allows users to register, log in and log out.
Pre-condition	The user is on the login/registration page/modal.
Main Scenario	User registers with valid details, logs in with correct credentials, and logs out when finished.
Exception Scenario	Incorrect login details, registration with existing username.
Post-condition	User is authenticated and logged in or logged out as requested.
Visual Constraints	Clear error messages, easy-to-use forms, secure password entry.
Logical Constraints	Validation of user input, secure storage of passwords.
Table 2.1: Use Case Description: User Authentication
2.2.3	Use Case : Manage Conversations
The Conversation Management Use Case Diagram 2.5 showing how users interact with conversations.
 
Figure 2.4: Use Case Diagram of "Manage Conversation"
The table 2.2 below further details this use case.
Actor	User
Description	Allows users to create, view, rename, and delete conversations.
Pre-condition	User is authenticated and on the main application interface.
Main Scenario	User creates a new conversation, views conversation history, renames conversations, and deletes unwanted conversations.
Exception Scenario	Network issues preventing conversation operations, database errors during save/delete operations.
Post-condition	Conversation is created, modified, or deleted as requested by the user.
Visual Constraints	Conversation list gets shown, with clear indicators for active conversation and confirmation for deletion.
Logical Constraints	Proper data update, user-specific conversation isolation, prevention of data loss.
Table 2.2: Use Case Description: Manage Conversation
2.2.4	Use Case: Study Programming Concepts
Figure 2.6: Study Programming Concepts Use Case Diagram showing the educational interactions between users and the AI.
 
Figure 2.5: Use Case Diagram of "Study Programming Concepts"
The table(2.3) below further details this use case.
Actor	User
Description	Allows users to learn programming concepts through different interaction modes.
Pre-condition	User is in an active conversation with the AI teacher.
Main Scenario	User asks questions about programming, requests structured courses, follows learning paths, and receives explanations of code.
Exception Scenario	AI unable to understand complex queries, network issues, or unrelated questions.
Post-condition	User understands the requested programming topics.
Visual Constraints	Clear presentation of educational content, proper formatting of code examples, visual distinction between different content types.
Logical Constraints	Accurate programming information, pedagogically sound explanations, appropriate difficulty level.
Table 2.3: Use Case Description: Study Programming Concepts
2.2.5	Use Case : Chat with the teacher
Figure 2.7: Chat with the teacher Use Case Diagram showing the voice-based communication flow.
 
Figure 2.6: Use Case Diagram of "Submit Vocal Questions"
The table 2.4 below further details this use case.
Actor	User
Description	Allows users to interact with the AI using voice commands and receive spoken responses.
Pre-condition	User has granted microphone permissions and is in an active conversation.
Main Scenario	User activates voice input, speaks a question or command, and receives both text and spoken responses from the AI.
Exception Scenario	Microphone not working, speech recognition errors, TTS failures.
Post-condition	User’s speech is processed and appropriate responses are delivered both visually and audibly.
Visual Constraints	Clear microphone status indicators, visual feedback during speech recognition.
Logical Constraints	Accurate speech-to-text conversion, natural-sounding text-to-speech, minimal latency.
Table 2.4: Use Case Description: Submit Vocal Questions
2.2.6	Use Case : Review Code
Figure 2.8: Code Editing Use Case Diagram showing how users interact with the code editor.
 
Figure 2.7: Use Case Diagram of "Submit Code for Analysis"
The table 2.5 below further details this use case.
Actor	User
Description	Allows users to write and share code with the AI for explanation, debugging, or improvement.
Pre-condition	User is in an active conversation and has accessed the code editor.
Main Scenario	User writes code in the editor, selects the programming language, submits code to the AI, and receives feedback.
Exception Scenario	Syntax errors in code, unsupported programming language, AI unable to analyze complex code.
Post-condition	User receives detailed feedback on their code including explanations, corrections, or improvements.
Visual Constraints	Syntax highlighting, line numbers, proper code formatting, clear distinction between code and explanations.
Logical Constraints	Support for multiple programming languages, accurate code analysis, helpful and educational feedback.
Table 2.5: Use Case Description: Submit Code for Analysis
2.2.7	Use Case : Select Teaching Mode
Figure 2.9: Teaching Mode Selection Use Case Diagram showing how users switch between teaching modes.
 
Figure 2.8: Use Case Diagram of "Select Teaching Mode"
The table 2.6 below further details this use case.
Actor	User
Description	Allows users to switch between Teacher Mode and Q&A Mode to customize their learning experience.
Pre-condition	User is authenticated and has access to the mode selection interface.
Main Scenario	User selects Teacher Mode for structured learning with chapters and exercises, or Q&A Mode for direct answers to specific questions.
Exception Scenario	Mode switch fails due to system error, conversation context is lost during mode transition.
Post-condition	System adapts its responses according to the selected teaching mode.
Visual Constraints	Clear indication of current mode, intuitive mode switching interface.
Logical Constraints	Proper persistence of mode selection, appropriate adaptation of AI behavior based on selected mode.
Table 2.6: Use Case Description: Select Teaching Mode
Conclusion
In this chapter, we defined the requirements and specifications for our Programming AI Teacher system. We identified the core requirements including voice interaction, dual teaching modes, and code analysis capabilities. We also developed seven detailed use cases that demonstrate how users will interact with the system throughout their learning journey. These requirements provide a solid foundation for the design and implementation phases that follow.
 
Chapter 3 
Conceptual study 
Introduction
The Programming AI Teacher is an intelligent educational framework designed to enhance software pedagogy with AI-driven instruction. The system interprets and explains complex programming concepts while complying with educational standards. Through detailed activity and sequence diagrams, we demonstrate the system’s essential procedures and interactions between components. These UML diagrams will help us visualize how users interact with the system and how different modules interact o create tailored educational sessions.
3.1	System Architecture
This section outlines the basic structure of the Programming AI Teacher system, defining component interactions and design principles that enable educational interactions in real-time .
3.1.1	Overall Architecture
3.1.1.1	System overview and client-server design with LiveKit WebSocket communication
The system uses a client-server architecture where the Next.js frontend communicates with a Python backend through LiveKit’s WebSocket infrastructure, which ensures low-latency audio streaming and instant message delivery.
3.1.1.2	Multi-mode support (Teacher/QA) with user data isolation
To accommodate different learning preferences, the platform provides ’Teacher mode’ for detailed explanations and ’Q&A mode’ for direct answers. Data isolation is enforced through ID-based filtering in database operations, preventing cross-user access.
3.1.2	Component Integration
3.1.2.1	Frontend (Next.js/React) and Backend (Python/LiveKit Agents)
The frontend handles UI rendering, audio capture/playback, and conversation display through LiveKit client libraries. The Python backend operates as LiveKit agents, processing audio streams, managing speech-to-text conversion, AI interactions, and database operations.
3.1.2.2	External services (Groq AI, TTS, Authentication)
The Groq API provides AI response generation and Speech-to-Text processing. Web-based text-to-speech converts AI responses using browser APIs, while the JWT-based authentication manages user sessions through secure file storage.
3.2	Behavioral Models & System Flow
This section demonstrates how the system operates through detailed interaction flows, providing high-level process overviews and step-by-step sequences that show the engagement of the user with the AI teacher.
3.2.1	Activity Diagrams (Process Flows)
3.2.1.1	User journey: Authentication → Conversation Management
As shown in the following diagram, the user experience begins with registration or login, then progresses to connect with the main app to access the conversation management.
 
Figure 3.1: User Journey Sequence Diagram
3.2.1.2	Voice workflow: Audio → STT → AI → TTS → Response
As illustrated in Figure 3.2, the voice interaction process begins with microphone activation and proceeds through audio streaming, speech-to-text conversion, AI processing, and then text-to-speech synthesis back to the user. The workflow includes fallback mechanisms for failures.
 
Figure 3.2: Voice Interaction Sequence Diagram
3.2.1.3	Text workflow: Input → AI → Response
For text-based interactions, the system implements input validation, message transmission through LiveKit data channels, AI processing with conversation context, and response delivery.
 
Figure 3.3: Voice Interaction Sequence Diagram
3.2.1.4	Conversation management with CRUD operations
To maintain an organized user experience, users can create new conversations using the empty conversation button, switch between existing conversations, and rename or delete conversations through confirmation dialogs. The system includes user isolation and maintains UI synchronization.
 
Figure 3.4: Voice Interaction Sequence Diagram
3.2.2	Sequence Diagrams (Detailed Interactions)
3.2.2.1	Authentication flow with error handling
Instead of handling credentials(username and password) directly, the authentication process involves credential submission, backend validation, and JWT token generation for successful authentications. Alternative branches handle invalid credentials, registration conflicts, and server errors.
 
Figure 3.5: Login Sequence Diagram
 
Figure 3.6: Register Sequence Diagram
3.2.2.2	Voice conversation with fallback mechanisms
As demonstrated in the sequence diagrams bellow, the voice conversation contains steps from microphone activation through speech-to-text processing, to AI response generation, text-to-speech synthesis, and audio playback to the user.
 
Figure 3.7: Voice Interaction Sequence Diagram
3.2.2.3	Text conversation with validation
The voice interaction sequence diagram maps the complete voice processing, from initial speech capture through response delivery.
 
Figure 3.8: Voice Interaction Sequence Diagram
3.2.2.4	Conversation management with user isolation
CRUD operations showing permission checks, database transactions, and UI synchronization. Demonstrates user ownership verification and error handling for unauthorized access.
 
Figure 3.9: Initial Conversation Sequence Diagram
 
Figure 3.10: Create New Conversation Sequence Diagram
 
Figure 3.11: Switch & Manage Conversations Sequence Diagram
 
Figure 3.12: Delete Conversation Sequence Diagram
3.3	Data & AI Integration
This section covers the data structures and AI processing capabilities that form the system’s core functionality. It explains how data is organized, stored, and processed to enable intelligent educational interactions.
3.3.1	Data Architecture
3.3.1.1	Database schema (Users, Conversations, Messages)
The system uses a SQLite schema with Users for authentication and profiles, and Conversations for chat sessions with teaching or Q&A modes.
3.3.1.2	Data isolation and context management
To ensure privacy, the isolation of user data is maintained through user_id filtering in the database, preventing cross-user access. Context management extracts conversation history and teaching preferences for personalized AI interactions while handling context window.
3.3.2	AI Processing
3.3.2.1	Multi-model integration with Groq API and fallbacks
The system integrates with Groq’s multiple Large Language Models(LLM) with automatic fallback mechanisms. This includes conversation history preparation, mode-specific prompt engineering, and response post-processing.
3.3.2.2	Speech processing (STT/TTS) pipeline
For speech processing, STT uses Groq’s Whisper for real-time transcription with noise filtering, while TTS employs Web Speech API for browser-based synthesis. The pipeline includes audio processing, real-time transcription, and synchronized audio playback.
Conclusion
In this chapter, we designed the conceptual framework for our Programming AI Teacher system. We established the system architecture, defined how the frontend and backend components work together, and created detailed models through activity and sequence diagrams. We also designed the data architecture with user isolation and integrated AI processing capabilities. This conceptual design provides the technical blueprint needed to move forward with the actual implementation of our system.
 
Chapter 4 
Implementation 
Introduction
This chapter details the implementation aspects of our project, including the work environment, technologies used, and productivity techniques we employed. It covers our specific implementations for the Programming AI Teacher platform, focusing on both backend voice processing and frontend user interface development.
4.1	Developement environement
4.1.1	Hardware environement
The primary hardware used for the project was a standard development laptop with the following specifications:
Model	Lenovo IdeaPad Gaming 3
CPU	AMD Ryzen 5 5600H with Radeon Graphics
GPU	NVIDIA GeForce RTX 3050 Laptop GPU
RAM	16GB
Hard drive	Lenovo Samsung 512GB
Operating system	Windows 11 Famille Unilingue
Table 4.1: Primary Hardware Environment used for development
Model	HP pavilion g series
CPU	Intel(R) Core(TM) i5-2430M CPU @ 2.40GHz
GPU	NONE
RAM	6GB
Hard drive	Toshiba 500GB
Operating system	Windows 11 PRO
Table 4.2: Secondary Hardware Environment used for development
4.1.2	Software environement
In this subsection, we will present the different software tools we used during our project:
Visual Studio Code (VS Code) served as our primary code editor, providing debugging support, Git control, syntax highlighting, and intelligent code completion.[1]
 
Figure 4.1: VS Code’s logo
Git functions as our distributed version control system for source code management and collaboration throughout development.[2]
 
Figure 4.2: Git’s logo
npm/pnpm For package management, we used pnpm (Node Package
Manager) as our JavaScript package manager for managing dependencies in our frontend project.[3]
 
Figure 4.3: Pnpm’s logo
Github Desktop helps us work with files hosted on GitHub, providing a user-friendly interface for Git operations.[4]
 
Figure 4.4: Github desktop’s logo
4.1.2.1	Technologies used
The implementation of our project involves several key technologies, each serving a specific purpose in development.
4.1.2.2	Front-end
React is a JavaScript library for building user interfaces, particularly single-page applications.[5]
 
Figure 4.5: React’s logo
Next.js is a React framework that enables server-side rendering, static site generation, and other performance optimizations for React applications.[6]
 
Figure 4.6: Nextjs’s logo
Typescript is a strongly typed programming language that builds on JavaScript. TypeScript adds type checking throughout our code to improve quality and make development easier.[7]
 
Figure 4.7: Typescript’s logo
Tailwind CSS works as our CSS framework for quick UI development, keeping styling consistent across components and screen sizes.[8]
 
Figure 4.8: Tailwind CSS’s logo
Livekit client handles real-time audio and video communication through
WebRTC, which we used to build our voice interaction features.[9]
 
Figure 4.9: Livekit’s logo
4.1.2.3	Back-end
Python is a high-level, interpreted programming language known for its readability and versatility. Python manages AI connections, audio processing, and database work.[10]
 
Figure 4.10: Python’s logo
LiveKit Server SDK handles server-side tasks for managing rooms, participants, and tokens in our real-time communication system.real-time communication features.[11]
 
Figure 4.11: Livekit’s logo
Groq is a platform that provides access to large language models, especially models like Llama 3.3.[12]
 
Figure 4.12: Groq’s logo
SQLite provides simple database work for conversation history and user settings, improved with WAL mode for better performance.[13]
 
Figure 4.13: SQLite’s logo
Silero works as a smart system in our audio processing to detect when users are speaking.[14]
 
Figure 4.14: Silero’s logo
Web Text-to-Speech is a technology that turns text into speech to make the AI assistant talk back to users.[15]
 
Figure 4.15: Web Speech api’s logo
4.2	Implementation for Programming AI Teacher
This section details the evolution of our project from its initial prototype to the current implementation using LiveKit.
4.2.1	Prototype Development
4.2.1.1	Basic AI Assistant with Streamlit and Gemini API
Our project began as a simple web-based AI assistant built with Streamlit and Google’s Gemini API.
The initial prototype featured a basic interface where users could type questions and receive text responses from the AI. We chose Streamlit for its simplicity and Python integration, which aligned well with our backend development skills.
The application flow was straightforward: users would input text through the Streamlit interface, our backend would process this input and send it to the Gemini API, then display the returned response in the same interface. While functional, this prototype had many limitations. The text-only interface lacked engagement, the "synchronous" API calls resulted in noticeable latency, and the conversation context management was basic. Additionally, the Streamlit deployment had limitations that became problematic as our project grew.
4.2.1.2	Adding Speech Capabilities
We then expanded the prototype to include speech capabilities by integrating the Web Speech API for browser-based speech recognition and the Whisper API for improved transcription accuracy.
The speech processing worked successively: audio capture → trascription using Whisper → sending the transcribed text to Gemini → receiving text response → converting it to speech with webTTS → and finally playing the audio.
However, this implementation had significant limitations including high latency, poor voice quality, and lack of real-time streaming capabilities. The system also lacked real-time streaming capabilities, meaning users had to wait for complete processing before receiving any feedback.
4.2.2	Model Experimentation and Early Development
We began this project with a plan to develop our own custom LLM through fine-tuning. We selected CodeGemma as our first model because it was designed for programming applications. We invested time preparing training data by combining publicly available data with our own curated examples that demonstrated the approach we wanted for both Teacher Mode and Q&A Mode.
However, our fine-tuning experiments with CodeGemma produced problematic results. The model began generating unreliable outputs, including incorrect information and misplaced words and symbols in code examples.
We then transitioned to CodeLLama, which demonstrated better results during the fine-tuning process. The model successfully learned our intended teaching patterns and maintained response quality throughout training. We completed the training process and saved the new model weights.
Nevertheless, we encountered technical difficulties when attempting to deploy our custom CodeLLama model to Hugging Face. The upload process repeatedly failed due to network limitations and platform constraints. After several unsuccessful deployment attempts that consumed development time, we recognized the need for an alternative approach.
This experience led us to adopt prompt engineering, which provided the performance we required without the deployment complexities.
4.2.3	Prompt Engineering Implementation
After all our experiments with fine-tuning models, we figured out a prompt engineering approach that gives us almost the same customization without the upload difficulties. We wrote detailed instructions that told the AI how to behave as a teacher, how to format responses, and what teaching methods to follow.
We created two different sets of instructions in our ai_prompts.py file. The Teacher Mode instructions make the AI act like an experienced educator with rules about formatting, course creation, and writing style. The Q&A Mode instructions turn the AI into an expert who gives direct answers to specific questions.
This prompt engineering approach gets us the specialized teaching responses we originally wanted from fine-tuning. The system picks the right instructions automatically based on whether someone chooses Teacher Mode or Q&A Mode, so every conversation stays educational and helpful.
We also added an explanation feature that transforms technical information into clear educational content, ensuring explanations are both technically precise and pedagogically effective, helping students develop genuine understanding.
4.2.4	Migration to LiveKit Platform
4.2.4.1	Discovering Livekit
After evaluating our prototype’s limitations, we discovered LiveKit as a comprehensive solution. This platform offered WebRTC-based architecture with real-time communication, server-side speech processing and voice activity detection. The migration to LiveKit provided reduced latency and improved scalability.
We determined that migrating to LiveKit proved beneficial despite the significant changes required. The platform’s scalability, performance , and feature-set made it an ideal foundation for our evolving application.
4.2.4.2	Livekit CLI Installation and Application Bootstrapping
Our development process began with installing the LiveKit Command Line Interface and bootstrapping our application using LiveKit’s templates. This established a structured project with necessary components for real-time audio processing and AI integration.
 
Figure 4.16: Install Livekit CLI
For LiveKit Cloud users, authentication creates an API key and secret, allowing CLI use without manually providing credentials. The "lk" suite lets you access server APIs, create tokens, and generate test traffic from the command line.
 
Figure 4.17: Authenticate with Cloud
"lk" is LiveKit’s suite of CLI utilities. It lets you conveniently access server APIs, create tokens, and generate test traffic all from your command line. A participant creating or joining a LiveKit room needs an access token to do so.
 
Figure 4.18: Generate access token
4.3	Front-end implementations
In this section, we present our frontend implementation for the
Programming AI Teacher built with Next.js and React, featuring an architecture that delivers a cohesive educational experience.
4.3.1	Authentication
The AuthPage component provides our application’s main authentication interface with login and registration options. We built an AuthProvider and useAuth hook to manage user authentication, connecting to our backend API for credential validation. User data is stored in a JSON file for simplicity. The LoginForm handles existing user access, while the RegisterForm guides new users through account creation.
 
Figure 4.19: Authenticate: Login
 
Figure 4.20: Authenticate: Register
4.3.2	Entry Point and Connection Flow
The ConnectionPage component displays the Programming Teacher logo and connection interface. The ConnectionProvider component manages the connection process, handling authentication and WebSocket setup using JWT tokens for secure session management.
 
Figure 4.21: ConnectionPage
4.3.3	Main Layout and Header
Once connected, users access the main interface through the Header component, which contains the project title, connection status, and teaching mode toggle between "Teacher Mode" and "Q&A Mode."
 
Figure 4.22: Header
The ConversationManager component provides conversation history with "New Chat" functionality which is stored in the database. Each entry shows title, timestamp, and AI response preview.
 
Figure 4.23: ConversationManager
The Typewriter component handles conversation display with Markdown formatting and educational styling, while the CodeBlock component provides syntax highlighting for code examples.
 
Figure 4.24: Typewriter
 
Figure 4.25: CodeBlock
4.3.3.1	Interactive Features
The CodeEditor component provides an interface with syntax highlighting, line numbers, and language selection for code submission.
 
Figure 4.26: CodeEditor
The SettingsModal offers user customization including TTS volume control and microphone selection. Settings persist across sessions using custom React hooks for state management.
 
Figure 4.27: SettingsModal
The voice interaction system enables natural conversation through the MicrophoneButton component, which captures user input for real-time speech-to-text processing and AI response synthesis.
 
Figure 4.28: MicrophoneButton
4.3.3.2	System Features
The project use a design system managed by the ThemeProvider component with dark/light theme support and responsive typography.
 
Figure 4.29: ThemeProvider
The ConnectionToast component provides user feedback during connection states and error handling with appropriate visual indicators.
 
Figure 4.30: Connecting
 
Figure 4.31: Connecting message
 
Figure 4.32: Connected message
 
Figure 4.33: Connected
4.4	End-to-End Interaction Flow
 
Figure 4.34: General End-to-End Flow
4.4.1	User Authentication
The user journey begins with authentication through the AuthPage component, followed by WebSocket connection establishment via the ConnectionPage. The system processes authentication through JWT tokens and establishes secure LiveKit connections with visual feedback during each stage.
4.4.2	Initial Connection
After authentication, the user journey is followed by WebSocket connection establishment via the ConnectionPage component displaying a "Connect to Assistant" button. When clicked, the handleConnect function in the useConnection hook initiates a connection to the LiveKit server.
4.4.3	Mode Selection and Interface Loading
Upon connection, the project loads the main interface with teaching mode selection (Teacher/Q&A Mode) and conversation management. The system ensures data isolation by filtering conversations based on user ID and selected teaching mode initialized by the ConversationManager component.
4.4.4	User Input Methods
4.4.4.1	Text-Based Input
Users can type their questions or requests in the TextInput component. For example, a user might type "Teach me Python basics" in Teacher Mode or "How do I use list comprehensions in Python?" in Q&A Mode. Upon submission, the useConversation hook processes this request, adding the current teaching mode parameter and the user’s ID to the message payload.
4.4.4.2	Voice-Based Input
Alternatively, users can click the MicrophoneButton component to activate voice input in either mode. The useConnection hook activates the browser’s microphone and streams audio data to the LiveKit server, where it’s converted to text through speech recognition.
4.4.4.3	Input Processing
Regardless of input method, the backend receives the request through the handletextinput function in textprocessor.py. The system extracts the specific mode from the message and retrieves the appropriate conversation context from the database.
Mode-Specific Processing
-	In Teacher Mode, the system selects a system prompt that instructs the AI to create structured learning paths with chapters, objectives, and exercises.
-	In Q&A Mode, the system selects a focused system prompt that emphasizes direct, concise answers to specific questions.
4.4.5	Response Generation and Delivery
4.4.5.1	AI Response Generation
The Groq API generates a response based on the selected system prompt, user input, and conversation history. The backend stores this response in the database with the user’s ID and conversation ID.
4.4.5.2	Speech Synthesis
For both modes, the synthesize speech function processes the AI response text. The system uses the WebTTS approach, sending a web tts message to the frontend with the response text and voice settings.
4.4.5.3	Response Delivery
The backend sends the AI response to the frontend as a JSON message containing the response text, conversation ID, and any additional metadata.
For voice input, the system also sends the synthesized speech data.
4.4.6	Frontend Rendering
4.4.6.1	Text Rendering
The Typewriter component receives and renders AI responses using the renderEnhancedResponse function, processing markdown, code blocks, and formatting elements. The ContentSegment components handle different content (text, code, etc.) types with appropriate styling.
4.4.6.2	Mode-Specific UI Elements
The UI adapts based on teaching mode:
-	In Teacher Mode, the CourseUI component extracts and displays chapter structure in the sidebar for course navigation.
-	In Q&A Mode, the CourseUI component stays minimized for focused question-answer interaction.
4.4.6.3	Audio Playback
The useWebTTS hook manages audio playback based on user volume settings. The speak function processes text and handles special formatting for speech synthesis(like ignoring code blocks, etc.).
4.4.7	Code Editing and Submission
Users click the CodeEditorButton, in either mode, to open the CodeEditor component for writing, pasting, and submitting code with language selection. The code gets formatted with markdown syntax and sent through the same channels as text input. The AI analyzes code and provides feedback based on the current teaching mode.
4.4.8	Conversation Management
The ConversationManager component tracks and stores all exchanges.
Users can view conversation history, rename conversations, or delete unwanted conversations. All conversation data associates with the authenticated user’s ID for data isolation and privacy.
Conclusion
In this chapter, we successfully implemented our Programming Teacher AI system from initial prototype to fully functional platform. We evolved from a basic Streamlit and Gemini API prototype to a LiveKit-based system that handles real-time voice and text interactions.
We also built a frontend using React and Next.js with features like conversation management, voice interaction, and user settings, while developing a backend architecture that processes messages, manages AI responses, and ensures data security. This implementation demonstrates that our conceptual design translates effectively into a working educational platform that delivers the personalized programming instruction we envisioned.
 
General Conclusion
Through this project, we successfully developed a Programming AI Teacher that addresses real problems in programming education. We started by identifying gaps in existing solutions, with most of them lacking personalization, not supporting voice interaction, and failing to adapt to individual learning needs. Our solution combines the best aspects of human tutoring with current AI technology, offering both structured "Teacher Mode" courses and responsive "Q&A Mode" answers through voice and text interaction.
The development process took us from initial concept through requirements analysis, conceptual design, and full implementation. We built a system using modern technologies like React, Next.js, Python, LiveKit , and Groq’s AI models.
What makes our system different is its focus on educational principles rather than just technical features. We designed dual teaching modes that adapt to different learning preferences, integrated voice interaction that makes programming more accessible, and created an environment where students can learn, practice, and get feedback without switching between multiple tools. The system maintains conversation history, allows code editing with syntax highlighting, and provides personalized explanations based on each student’s needs.
This project demonstrates that AI can enhance education when designed thoughtfully. Instead of replacing human teachers, our Programming AI Teacher extends their reach, providing students with 24/7 access to personalized programming instruction. The combination of voice interaction and adaptive learning creates an educational experience that closely resembles working with a dedicated human tutor while exploiting the availability that only AI can provide.
References
[1]	Microsoft. Visual studio code - code editing. redefined. https://code. visualstudio.com/, 2024. Accessed: 2025-05-13.
[2]	Git Contributors. Git - fast, scalable, distributed revision control system. https://git-scm.com/, 2024. Accessed: 2025-05-13.
[3]	pnpm Contributors. pnpm - fast, disk space efficient package manager. https://pnpm.io/, 2024. Accessed: 2025-05-13.
[4]	GitHub, Inc. Github desktop. https://desktop.github.com, 2025. Accessed: 2025-05-13.
[5]	Meta. React – a javascript library for building user interfaces. https: //react.dev/, 2024. Accessed: 2025-05-13.
[6]	Vercel. Next.js - the react framework. https://nextjs.org/, 2024. Accessed: 2025-05-13.
[7]	Microsoft. Typescript - javascript with syntax for types. https://www. typescriptlang.org/, 2024. Accessed: 2025-05-13.
[8]	Tailwind Labs. Tailwind css - rapidly build modern websites without ever leaving your html. https://tailwindcss.com/, 2024. Accessed: 2025-05-13.
[9]	LiveKit. Livekit client sdk for javascript. https://github.com/ livekit/client-sdk-js, 2024. Accessed: 2025-05-13.
[10]	Python Software Foundation. Python programming language. https: //www.python.org/, 2024. Accessed: 2025-05-13.
[11]	LiveKit. Livekit server sdk for node.js. https://github.com/livekit/ server-sdk-js, 2024. Accessed: 2025-05-13.
[12]	Groq Inc. Groq - high-performance ai inference. https://groq.com/, 2024. Accessed: 2025-05-13.
References
 
[13]	SQLite Consortium. Sqlite - small. fast. reliable. choose any three. https://www.sqlite.org/, 2024. Accessed: 2025-05-13.
[14]	Silero Team. Silero vad - neural network vad. https://github.com/ snakers4/silero-vad, 2024. Accessed: 2025-05-13.
[15]	Mozilla. Web speech api - mdn web docs. https://developer.mozilla.
org/en-US/docs/Web/API/Web_Speech_API, 2024. Accessed: 2025-0513.
2025/2026
 
A VOICE CHATBOT TO TEACH COMPUTER SCIENCE 
 
Firas CHEBBI 
Moomen MSAADI 
 
 الخلاصة: يواجه تعليم البرمجة التقليدي صعوبات في تقديم دعم مُخصَّص. يعالج هذا المشروع هذه الفجوة عبر تطوير "مدرس برمجة بالذكاء الاصطناعي" يدمج التفاعل الصوتي/النصي ووضع تدريس )دروس مُنظمة وأسئلة/أجوبة مفتوحة( في منصة واحدة.  يوضح التقرير تحليل الخلفية، المتطلبات، التصميم المفاهيمي والتنفيذ باستخدام منهجية كانبان. بُُني النظام بتقنيات  React/Next.js  وPython، وتطور من نموذج أولي إلى حل عملي، ليقدم تعليم برمجة يربط النظرية بالتطبيق. المفاتيح : 
 تعليم البرمجة وعلوم الحاسوب، مدرس الذكاء الاصطناعي، التعلّم المُخصصَّ، التفاعل الصوتي، نماذج 
اللغة الكبيرة Python ،React ،LiveKit ،(LLM)، تكنولوجيا التعليم. 
 
Résumé : L'éducation traditionnelle en programmation peine souvent à fournir un soutien personnalisé. Ce projet comble cette lacune en développant un « Enseignant IA en Programmation » intégrant des interactions voix/texte et deux modes d'enseignement (leçons structurées et questions/réponses libres) sur une plateforme unique. Le rapport détaille l'analyse contextuelle, les exigences, la conception conceptuelle et la mise en œuvre avec la méthodologie Kanban. Construit avec React/Next.js et Python, le système a évolué d'un prototype vers une solution fonctionnelle, offrant une éducation à la programmation accessible qui relie théorie et pratique. 
Mots clés: 
Éducation en Programmation et Informatique, Enseignant IA, Apprentissage Personnalisé, Interaction Vocale, Modèles de Langage (LLM), LiveKit, React, Python, Technologie Éducative. 
Abstract:  
Traditional programming education often struggles to provide personalized support. This project tackles that gap by developing a Programming AI Teacher that integrates voice/text interactions and dual teaching modes (structured lessons and open Q&A) within a single platform. The report details background analysis, requirements, conceptual design, and implementation using Kanban methodology. Built with React/Next.js and Python, the system evolved from prototype to a functional solution, delivering accessible programming education that bridges theory and practice. 
Key-words: 
Programming and Computer Science Education, AI Teacher, Personalized 
Learning, Voice Interaction, LLM, LiveKit, React, Python, Educational Technology. 
