# Frontend File Classification for Technical Interviews

## 🎯 **IMPORTANT FILES** (Must Know for Technical Interviews)

### **Core Hooks (State Management)**
```
✅ hooks/use-auth.tsx           - Authentication system with JWT tokens
✅ hooks/use-connection.tsx     - WebRTC connection management  
✅ hooks/use-conversation.ts    - Real-time messaging and conversation state
✅ hooks/use-settings.tsx       - User preferences and app settings
✅ hooks/use-theme.tsx          - Theme switching and CSS management
🔄 hooks/use-ai-responses.ts    - AI response handling and TTS
🔄 hooks/use-transcriber.ts     - Speech-to-text functionality
```

### **Main Components (Business Logic)**
```
✅ components/text-input.tsx        - Advanced input with voice controls
🔄 components/room.tsx              - LiveKit room management
🔄 components/playground.tsx        - Main app interface
🔄 components/conversation-manager.tsx - Conversation history management
🔄 components/typewriter.tsx        - Message display with animations
🔄 components/connection-page.tsx   - Landing page with connection setup
```

### **Core Application Files**
```
🔄 app/layout.tsx               - Root layout and providers
🔄 app/page.tsx                 - Main entry point with provider hierarchy
🔄 app/api/auth/route.ts        - Authentication API endpoints
🔄 app/api/token/route.ts       - LiveKit token generation
```

### **Utility Functions**
```
🔄 utils/conversation-utils.ts  - WebRTC and conversation helpers
🔄 utils/markdown-formatter.ts - Message formatting utilities
🔄 lib/utils.ts                - General utility functions
```

---

## 🎨 **UI-ONLY FILES** (Less Important for Technical Interviews)

### **Basic UI Components**
```
❌ components/ui/button.tsx              - Basic button component
❌ components/ui/modal.tsx               - Generic modal wrapper
❌ components/ui/toast.tsx               - Notification system
❌ components/ui/slider.tsx              - Range input slider
❌ components/ui/progress-bar.tsx        - Loading progress indicator
❌ components/ui/loading-svg.tsx         - Loading spinner SVG
❌ components/ui/simple-bot-face.tsx     - Bot avatar component
❌ components/ui/bot-icon.tsx            - Bot icon component
```

### **Layout and Navigation**
```
❌ components/ui/header.tsx              - App header with title
❌ components/ui/mobile-conversation-drawer.tsx - Mobile sidebar
❌ components/ui/status-indicator.tsx    - Connection status display
```

### **Settings and Help UI**
```
❌ components/ui/settings-modal.tsx      - Settings popup
❌ components/ui/settings-panel.tsx      - Settings form
❌ components/ui/help-modal.tsx          - Help documentation popup
❌ components/ui/language-selector.tsx   - Programming language picker
```

### **Code Editor UI**
```
❌ components/code-editor.tsx            - Code input interface
❌ components/code-editor-modal.tsx      - Code editor popup
❌ components/code-block.tsx             - Code display component
❌ utils/code-highlighting.ts            - Syntax highlighting
```

### **Content Display**
```
❌ components/content-segment.tsx        - Message content sections
❌ components/conversation-item.tsx      - Individual message display
❌ components/device-selector.tsx        - Audio device picker
```

### **Course/Learning UI**
```
❌ components/course-ui.tsx              - Course interface (unused)
❌ components/course-chapter-sidebar.tsx - Course navigation (unused)
❌ utils/course-structure.ts             - Course data (unused)
```

### **Visualization**
```
❌ components/visualization/             - Audio visualization components
❌ utils/html-entities.ts                - HTML entity handling
❌ utils/text-cleaning.ts                - Text processing utilities
❌ utils/theme-utils.ts                  - Theme helper functions
```

### **Configuration Files**
```
❌ next.config.js                        - Next.js configuration
❌ tailwind.config.ts                    - Tailwind CSS config
❌ tsconfig.json                         - TypeScript configuration
❌ package.json                          - Dependencies and scripts
❌ eslint.config.mjs                     - ESLint rules
❌ postcss.config.mjs                    - PostCSS configuration
```

### **Static Assets**
```
❌ app/globals.css                       - Global CSS styles
❌ app/light-theme.css                   - Light theme styles
❌ app/theme-script.js                   - Theme initialization script
❌ public/                               - Static images and assets
```

---

## 📊 **Priority for Technical Interviews**

### **🔥 HIGH PRIORITY** (Must understand deeply)
1. **Authentication System** (`use-auth.tsx`) - JWT, localStorage, security
2. **Real-time Communication** (`use-connection.tsx`, `room.tsx`) - WebRTC, LiveKit
3. **State Management** (`use-conversation.ts`, `use-settings.tsx`) - React Context, hooks
4. **Main Application Flow** (`app/page.tsx`, `playground.tsx`) - Provider hierarchy

### **🟡 MEDIUM PRIORITY** (Should understand concepts)
1. **Input Handling** (`text-input.tsx`) - Complex user interactions
2. **Message Display** (`typewriter.tsx`, `conversation-manager.tsx`) - Real-time updates
3. **API Integration** (`app/api/`) - Backend communication
4. **Utility Functions** (`utils/`) - Helper functions and data processing

### **🟢 LOW PRIORITY** (Basic understanding sufficient)
1. **UI Components** (`components/ui/`) - Standard React components
2. **Styling** (CSS files, theme utilities) - Visual presentation
3. **Configuration** (config files) - Build and development setup
4. **Static Assets** (images, icons) - Visual resources

---

## 🎯 **Interview Focus Areas**

### **Technical Concepts to Explain**
- React Context and custom hooks patterns
- WebRTC integration and real-time communication
- JWT authentication and security practices
- State management and data flow
- Error handling and user experience
- Performance optimization and memory management

### **Code Architecture to Discuss**
- Provider hierarchy and dependency injection
- Event-driven architecture for cross-component communication
- Separation of concerns between UI and business logic
- Type safety with TypeScript interfaces
- Async operations and loading states
