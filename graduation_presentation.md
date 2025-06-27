# Programming AI Teacher - Graduation Presentation
## A Voice Chatbot to Teach Computer Science

**Presented by:** Firas CHEBBI & Moomen MSAADI
**Duration:** 15 minutes

---

## Slide 1: Title Slide
**Programming AI Teacher**
*A Voice Chatbot to Teach Computer Science*

**Students:** Firas CHEBBI & Moomen MSAADI
**Academic Year:** 2025/2026

**Import:** University logo, graduation cap icon

**Transition:** Start with a confident greeting, introduce yourselves and the project title.

**Oral Notes:** "Good morning everyone. I'm [Name] and this is my colleague [Name]. Today we're presenting our graduation project: Programming AI Teacher - a voice chatbot that teaches computer science."

**Personal Notes:** Keep introduction short and confident. Make eye contact. Don't rush into technical details yet.

---

## Slide 2: Presentation Overview
**What We'll Cover Today**

1. **Problem Analysis** - Current programming education challenges
2. **Our Solution** - Programming AI Teacher features
3. **Technical Implementation** - Architecture, development journey & challenges
4. **Results & Future** - What we achieved and next steps

**Import:** Presentation roadmap icon, agenda checklist

**Transition:** Give a clear roadmap of the presentation structure.

**Oral Notes:** "We'll cover four main points today. First, the problems in current programming education. Then our solution and how we built it technically. We'll finish with our results and future plans."

**Personal Notes:** Point to each item on the slide as you mention it. This sets expectations and keeps you on track for timing.

---

## Slide 3: Existing Solutions & Their Limitations
**Current Approaches to Programming Education**

• Online courses (Udemy, Coursera)
• Coding platforms (LeetCode, Codecademy)
• AI Coding Assistants (GitHub Copilot, ChatGPT)

**Import:** Icons for online courses, coding platforms, video tutorials, forums

**Transition:** Move from analyzing existing solutions to presenting your unique approach.

**Oral Notes:** "Current solutions for learning programming include online courses, coding platforms, video tutorials, and forums. While each offers value, they all have major limitations: no real-time voice interaction, feedback is often delayed or generic, and students have to juggle multiple tools. None of these platforms truly adapt to individual learning needs or provide a seamless, interactive experience."

**Personal Notes:** Expand on how your project addresses these gaps in the next slide.

---

## Slide 4: Our Solution
**Programming AI Teacher**

• Voice + Text interaction
• Two teaching modes
• Built-in code editor
• Personalized learning

**Import:** Solution/lightbulb icon, AI teacher illustration

**Transition:** Shift from problem to solution presentation.

**Oral Notes:** "Our Programming AI Teacher fixes these problems. Students can talk to it using voice or text. It has two teaching modes and a built-in code editor. Everything happens in one place."

**Personal Notes:** Show enthusiasm here - this is your main contribution. Gesture to each bullet point as you mention it.

---

## Slide 5: Key Features
**What Makes It Special**

**Teacher Mode:** Structured courses with chapters
**Q&A Mode:** Direct answers to specific questions
**Voice Interaction:** Natural conversation flow
**Pedagogical Approach:** Adaptive, student-centered teaching

**Import:** Feature icons (microphone, teaching, chat bubbles)

**Transition:** Explain the core features mentioned in the solution.

**Oral Notes:** "Teacher Mode gives structured courses with chapters. Q&A Mode gives quick answers to specific questions. Voice interaction lets students actually talk to the AI teacher. Our pedagogical approach adapts to each student, making learning more effective."

**Personal Notes:** This slide sets up your unique value. Emphasize voice interaction and adaptive pedagogy as your main differentiators.

---

## Slide 6: Requirements & Use Cases
**System Analysis**

• User Authentication & Management
• Conversation Management
• Voice & Text Interaction
• Code Analysis & Feedback

**[Include Use Case Diagrams from Chapter 2: General Use Case, User Authentication, Manage Conversations, Study Programming Concepts]**

**Import:** UML diagram icons, user interaction flowcharts

**Transition:** Move from features to technical analysis.

**Oral Notes:** "Before building, we analyzed what the system needed to do. We identified core requirements and created use case diagrams showing how users interact with our system."

**Personal Notes:** Don't spend too much time on this - it's technical background. Show the diagrams briefly and move on.

---

## Slide 7: System Architecture
**Technical Foundation**

**Frontend:** React + Next.js + TypeScript
**Backend:** Python + LiveKit Agents
**AI:** Groq API (LLaMA 3.3 70B)
**Database:** SQLite with WAL mode

**[Include Activity Diagrams from Chapter 3: User Journey, Voice Workflow, Text Workflow]**

**Import:** Architecture diagram, technology logos

**Transition:** Present the technical architecture decisions.

**Oral Notes:** "Our system uses React and Next.js for the frontend, Python with LiveKit for the backend, and Groq's LLaMA model for AI responses. LiveKit handles real-time voice communication."

**Personal Notes:** Keep this technical but brief. Point to the architecture diagram if you have one. Don't get lost in technical details.

---

## Slide 8: Development Journey
**From Concept to Reality**

**Phase 1:** Streamlit + Gemini (Basic prototype)
**Phase 2:** Added Whisper STT + Web TTS
**Phase 3:** Fine-tuning experiments (CodeGemma → CodeLLama)
**Phase 4:** Prompt engineering approach
**Phase 5:** LiveKit migration & production system

**Import:** Timeline/journey illustration, development icons

**Transition:** Explain how your development process evolved.

**Oral Notes:** "We went through five phases. Started with a basic Streamlit prototype, added speech capabilities, tried fine-tuning models but had deployment issues, switched to prompt engineering, and finally migrated to LiveKit for real-time performance."

**Personal Notes:** This shows your learning process. Emphasize that challenges led to better solutions. Don't dwell on failures.

---

## Slide 9: Challenges & Solutions
**Technical Problem Solving**

**Challenge:** Model fine-tuning complexity
**Solution:** Prompt engineering approach

**Challenge:** High latency in voice processing
**Solution:** LiveKit real-time infrastructure

**Challenge:** User experience consistency
**Solution:** Iterative design with React components

**Import:** Problem-solution diagram, engineering icons

**Transition:** Discuss the major challenges and how you solved them, as part of your development journey.

**Oral Notes:** "We faced three main challenges. Fine-tuning models was too complex, so we used prompt engineering. High latency made voice unusable, so we switched to LiveKit. User experience needed multiple iterations with React components."

**Personal Notes:** Show that you learned from problems and found better solutions. This demonstrates problem-solving skills.

---

## Slide 10: Backend Architecture (Chapter 4)
**Server-Side Implementation**

• **LiveKit Agents:** Real-time message processing
• **Speech Pipeline:** Groq Whisper STT + Web TTS
• **Database Operations:** User isolation & conversation management
• **Prompt Engineering:** Mode-specific AI instructions

**[Include the general backend architecture diagram. Mention that detailed diagrams are available in the report if needed.]**

**Import:** Server architecture diagram, database schema

**Transition:** Explain the backend implementation.

**Oral Notes:** "The backend uses LiveKit Agents for real-time processing, Groq's Whisper for speech-to-text, and prompt engineering for different teaching modes. Each user's data stays separate. More detailed diagrams are available in our report."

**Personal Notes:** Keep backend explanation simple. Focus on the real-time aspect and user data separation for security.

---

## Slide 11: Voice Interaction System
**Real-Time Communication Flow**

**Process:** Audio Capture → STT → AI Processing → TTS → Playback
**Features:** Voice Activity Detection, Noise Filtering, Synchronized Audio

**Import:** Voice flow diagram, microphone icon, sound waves

**Transition:** Show the unique voice interaction capability.

**Oral Notes:** "This is our main feature. Audio goes from microphone to speech-to-text, then AI processing, then text-to-speech back to the user. We added voice activity detection and noise filtering for clear conversation."

**Personal Notes:** This is your unique selling point. Prepare to demo this if possible. Emphasize real-time performance.

---

## Slide 12: Teaching Modes Implementation
**Learning Through Prompt Engineering**

**Teacher Mode:** Structured courses, learning objectives, chapter organization
**Q&A Mode:** Direct answers, focused responses, quick problem solving

**Both modes use:** Conversation history, user context, educational formatting

**Import:** Mode comparison diagram, teaching methodology icons

**Transition:** Explain how the two teaching modes work in practice.

**Oral Notes:** "Teacher Mode creates structured courses with chapters. Q&A Mode gives direct answers to questions. Both use conversation history and adapt to the user, but format responses differently."

**Personal Notes:** Show examples of both modes if you have screenshots. This demonstrates your understanding of different learning needs.

---

## Slide 14: Project Results & Impact
**What We Successfully Delivered**

✓ **Functional System:** Real-time voice + text interaction, tested with students
✓ **Educational Value:** Personalized, adaptive programming instruction
✓ **Technical Achievement:** Modern web application with robust AI integration
✓ **User Experience:** Seamless, accessible, and engaging learning environment
✓ **Feedback:** Positive responses from test users; improved engagement and learning speed

**Import:** Achievement badges, success metrics, graduation cap

**Transition:** Present the concrete results and achievements.

**Oral Notes:** "We successfully built a working system with real-time voice interaction, adaptive instruction, and a complete learning environment. Test users reported higher engagement and faster learning."

**Personal Notes:** Be proud of what you accomplished. This slide shows your project's value and impact.

---

## Slide 15: Future Enhancements
**Building on Our Foundation**

• **Multi-language Support:** Python, Java, C++, JavaScript
• **Advanced Analytics:** Learning progress tracking
• **Mobile Platform:** iOS and Android applications
• **Collaborative Features:** Peer learning and group projects

**Import:** Future/roadmap icon, mobile device illustrations

**Transition:** Discuss potential improvements and extensions.

**Oral Notes:** "Future work includes supporting more programming languages, adding learning analytics, building mobile apps, and enabling collaborative features."

**Personal Notes:** Keep this brief. Focus on realistic next steps that build on what you've already accomplished.

---

## Slide 16: Conclusion
**Programming Education Reimagined**

• **Innovation:** First voice-interactive programming teacher
• **Impact:** 24/7 personalized programming instruction
• **Technology:** Modern AI integrated with educational principles
• **Future:** Shows AI's potential to enhance education

**Import:** Innovation icon, educational technology symbols

**Transition:** Summarize the project's significance and impact.

**Oral Notes:** "We've created the first voice-interactive programming teacher that provides 24/7 personalized instruction. Our project shows how AI can enhance education by making quality programming instruction more accessible."

**Personal Notes:** End on a strong note. Emphasize the innovation and impact. This is your final impression.

---

## Slide 17: Thank You
**Questions & Discussion**

**Programming AI Teacher**
*Firas CHEBBI & Moomen MSAADI*

*Thank you for your attention. We're ready for your questions!*

**Import:** Question mark icon, university logo

**Transition:** Open the floor for questions and discussion.

**Oral Notes:** "Thank you for your attention. We're ready for your questions."

**Personal Notes:** Be confident and prepared for questions about technical choices, challenges, and future work. Refer back to your slides if needed.

---

## Presentation Guidelines:

**Timing Breakdown (15 minutes total):**
- Introduction & Overview (1.5 minutes)
- Problem Analysis (1.5 minutes)
- Solution & Requirements (2 minutes)
- Technical Implementation & Architecture (4 minutes)
- Development Journey & Challenges (2.5 minutes)
- Results & Future (3.5 minutes)

**Key Oral Presentation Points:**
1. **Voice interaction** - Your unique differentiator that makes programming accessible
2. **Dual teaching modes** - Sophisticated prompt engineering solving different learning needs
3. **Real-time architecture** - LiveKit enabling seamless voice communication
4. **Iterative development** - Learning from challenges and adapting solutions
5. **Educational impact** - Bridging digital convenience with human-like tutoring

**Chapter Integration:**
- **Chapter 2 diagrams** used in Slide 5 (Requirements)
- **Chapter 3 diagrams** used in Slides 6 & 9 (Architecture & Backend)
- **Chapter 4 content** heavily featured in Slides 8-13 (Implementation focus)
