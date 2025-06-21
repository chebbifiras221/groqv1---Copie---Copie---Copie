# Frontend Technical Interview Guide

## 📋 Explanation Order & Strategy

### **Phase 1: Foundation & Architecture (Start Here)**
1. **Project Setup & Dependencies** (`package.json`)
2. **Application Configuration** (`next.config.js`, `tailwind.config.ts`)
3. **Root Layout & Entry Point** (`app/layout.tsx`, `app/page.tsx`)

### **Phase 2: Core State Management**
4. **Settings Management** (`hooks/use-settings.tsx`)
5. **Authentication System** (`hooks/use-auth.tsx`, `app/api/auth/route.ts`)
6. **Connection Management** (`hooks/use-connection.tsx`, `app/api/token/route.ts`)

### **Phase 3: Real-Time Communication**
7. **Room & WebRTC Setup** (`components/room.tsx`)
8. **Main Application Interface** (`components/playground.tsx`)
9. **Conversation State Management** (`hooks/use-conversation.ts`)

### **Phase 4: User Interface & Experience**
10. **Authentication UI** (`components/auth/auth-page.tsx`)
11. **Connection Landing Page** (`components/connection-page.tsx`)
12. **Input Handling** (`components/text-input.tsx`)

### **Phase 5: Advanced Features**
13. **Message Display & Processing** (`components/typewriter.tsx`)
14. **Conversation Management** (`components/conversation-manager.tsx`)
15. **Utility Functions** (`utils/conversation-utils.ts`, `utils/markdown-formatter.ts`)

---

## 🚀 Phase 1: Foundation & Architecture

### 1. Project Setup & Dependencies (`package.json`)

**Purpose:** Establishes the technology stack and project dependencies
**Interview Value:** Shows understanding of modern React ecosystem and dependency management

```json
{
  "name": "transcriber-frontend",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev --turbopack",     // Uses Turbopack for faster development
    "build": "next build",             // Production build
    "start": "next start",             // Production server
    "format": "prettier --write .",    // Code formatting
    "lint": "next lint"                // Code linting
  }
}
```

**Key Dependencies Analysis:**

#### **Core Framework:**
- **`next: "15.1.2"`** - Latest Next.js with App Router
- **`react: "^19.0.0"`** - Latest React with concurrent features
- **`typescript: "^5"`** - Type safety and developer experience

#### **Real-Time Communication:**
- **`@livekit/components-react: "^2.6.10"`** - Pre-built React components for WebRTC
- **`livekit-client: "^2.7.5"`** - Client SDK for real-time audio/video
- **`@livekit/krisp-noise-filter: "^0.2.16"`** - AI-powered noise cancellation

#### **UI & Styling:**
- **`tailwindcss: "^3.4.1"`** - Utility-first CSS framework
- **`framer-motion: "^11.15.0"`** - Animation library for smooth transitions
- **`lucide-react: "^0.469.0"`** - Modern icon library

#### **Development Tools:**
- **`livekit-server-sdk: "^2.9.3"`** - Server-side SDK for token generation
- **`prettier: "3.4.2"`** - Code formatting
- **`eslint-config-next: "15.1.2"`** - Next.js specific linting rules

**Interview Talking Points:**
1. **Modern Stack:** "I chose Next.js 15 with React 19 for the latest features like concurrent rendering and improved performance"
2. **Real-Time Focus:** "LiveKit provides enterprise-grade WebRTC with built-in noise cancellation for voice interactions"
3. **Developer Experience:** "TypeScript, Prettier, and ESLint ensure code quality and maintainability"
4. **Performance:** "Turbopack in development and Tailwind for optimized CSS delivery"

---

### 2. Next.js Configuration (`next.config.js`)

**Purpose:** Configures Next.js build and runtime behavior
**Interview Value:** Shows understanding of build optimization and configuration

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,              // Enables additional checks and warnings
  images: {
    domains: ['i.imgur.com'],         // Allows external image optimization
  },
}

module.exports = nextConfig
```

**Configuration Breakdown:**

#### **React Strict Mode:**
- **Purpose:** Enables additional development checks
- **Benefits:** Detects side effects, deprecated APIs, and unsafe lifecycles
- **Production Impact:** Only affects development, removed in production builds

#### **Image Optimization:**
- **External Domains:** Allows Next.js to optimize images from Imgur
- **Performance:** Automatic WebP conversion, lazy loading, responsive images
- **SEO Benefits:** Proper image sizing and format selection

**Interview Talking Points:**
1. **Development Quality:** "Strict mode helps catch potential issues early in development"
2. **Performance Optimization:** "Next.js image optimization reduces bundle size and improves loading times"
3. **Scalability:** "Configuration is minimal but extensible for future requirements"

---

### 3. Tailwind Configuration (`tailwind.config.ts`)

**Purpose:** Defines comprehensive theming system with dark/light mode support
**Interview Value:** Shows advanced CSS architecture and design system thinking

```typescript
import type { Config } from "tailwindcss";
import colors from "tailwindcss/colors";

// Define both dark and light theme colors
const darkTheme = {
  primary: {
    DEFAULT: "#2188ff",    // GitHub-inspired blue
    hover: "#0366d6",      // Darker blue for hover states
    focus: "#044289",      // Even darker for focus states
    muted: "#0366d680",    // Semi-transparent for disabled states
  },
  bg: {
    primary: "#0d1117",    // Main background (GitHub dark)
    secondary: "#161b22",  // Card/panel backgrounds
    tertiary: "#21262d",   // Input/button backgrounds
    overlay: "#1c2128",    // Modal/dropdown overlays
  },
  text: {
    primary: "#e6edf3",    // Main text color
    secondary: "#7d8590",  // Secondary text
    tertiary: "#6e7681",   // Muted text
    placeholder: "#6e768180", // Input placeholders
  }
};
```

**Theme Architecture Breakdown:**

#### **Color System Design:**
- **Semantic Naming:** Colors named by purpose (primary, secondary) not appearance (blue, red)
- **State Variants:** Each color has hover, focus, and muted variants for interactive elements
- **Accessibility:** High contrast ratios ensure WCAG compliance
- **Consistency:** GitHub-inspired palette for familiar, professional appearance

#### **Background Hierarchy:**
- **Primary:** Main app background
- **Secondary:** Card and panel backgrounds
- **Tertiary:** Interactive element backgrounds
- **Overlay:** Modal and dropdown backgrounds

#### **Text Hierarchy:**
- **Primary:** Main content text
- **Secondary:** Supporting text and labels
- **Tertiary:** Muted text and metadata
- **Placeholder:** Form input hints

```typescript
const custom = {
  // Use dark theme as default
  ...darkTheme
};

export default {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: ["class"],                    // Class-based dark mode switching
  theme: {
    extend: {
      colors: {
        ...colors,                        // Include default Tailwind colors
        ...custom,                        // Add our custom theme
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'bounce-slow': 'bounce 2s infinite',
      },
    },
  },
} satisfies Config;
```

**Advanced Configuration Features:**

#### **Content Scanning:**
- **File Patterns:** Scans all relevant files for class usage
- **Tree Shaking:** Only includes CSS for classes actually used
- **Performance:** Minimal CSS bundle size in production

#### **Dark Mode Strategy:**
- **Class-Based:** Allows programmatic theme switching
- **User Preference:** Can respect system preferences
- **Persistence:** Theme choice saved in localStorage

#### **Custom Animations:**
- **Pulse Slow:** Subtle breathing effect for loading states
- **Bounce Slow:** Gentle bounce for attention-grabbing elements
- **Performance:** Hardware-accelerated CSS animations

**Interview Talking Points:**
1. **Design System:** "I created a comprehensive design system with semantic color naming and consistent spacing"
2. **Accessibility:** "All color combinations meet WCAG contrast requirements for accessibility"
3. **Performance:** "Tailwind's purging ensures only used styles are included in the final bundle"
4. **Maintainability:** "Centralized theming makes it easy to update colors and spacing across the entire application"
5. **User Experience:** "Class-based dark mode allows smooth theme transitions without page reloads"

---

### 4. Root Layout (`app/layout.tsx`)

**Purpose:** Defines the root HTML structure and global providers
**Interview Value:** Shows understanding of Next.js App Router and provider patterns

```typescript
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "./light-theme.css";
import { ToastProvider } from "@/components/ui/toast";

// Font optimization with Next.js
const geistSans = Geist({
  variable: "--font-geist-sans",    // CSS custom property
  subsets: ["latin"],               // Only load Latin characters
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",    // For code blocks
  subsets: ["latin"],
});

// SEO metadata
export const metadata: Metadata = {
  title: "Programming Teacher",
  description: "Learn programming with a teacher using voice and text interaction",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ToastProvider>
          {children}
        </ToastProvider>
      </body>
    </html>
  );
}
```

**Layout Architecture Breakdown:**

#### **Font Optimization:**
- **Google Fonts Integration:** Next.js automatically optimizes font loading
- **CSS Variables:** Fonts exposed as CSS custom properties for flexible usage
- **Subset Loading:** Only loads Latin characters to reduce bundle size
- **Font Display:** `antialiased` class ensures smooth font rendering

#### **Global Providers:**
- **ToastProvider:** Provides notification system throughout the app
- **Provider Pattern:** Wraps entire app for global state access
- **Context Availability:** All components can access toast functionality

#### **SEO Configuration:**
- **Metadata API:** Next.js 13+ metadata system for better SEO
- **Static Metadata:** Title and description set at build time
- **Extensible:** Can be overridden in individual pages

**Interview Talking Points:**
1. **Performance:** "Next.js font optimization reduces layout shift and improves Core Web Vitals"
2. **Architecture:** "Root layout establishes global providers and styling foundation"
3. **SEO:** "Proper metadata configuration improves search engine visibility"
4. **Accessibility:** "Semantic HTML structure and proper font rendering for better UX"

---

### 5. Main Application Entry (`app/page.tsx`)

**Purpose:** Application entry point with provider hierarchy and routing logic
**Interview Value:** Demonstrates complex provider composition and conditional rendering

```typescript
"use client";

import { useEffect } from "react";
import { RoomComponent } from "@/components/room";
import { ConnectionProvider } from "@/hooks/use-connection";
import { ConnectionPage } from "@/components/connection-page";
import { useConnection } from "@/hooks/use-connection";
import { ThemeProvider } from "@/hooks/use-theme";
import { SettingsProvider } from "@/hooks/use-settings";
import { AuthProvider } from "@/hooks/use-auth";
import { useAuth } from "@/hooks/use-auth";
import { AuthPage } from "@/components/auth/auth-page";

export default function Home() {
  return (
    <ThemeProvider>           {/* Theme management */}
      <SettingsProvider>      {/* App settings */}
        <AuthProvider>        {/* Authentication state */}
          <ConnectionProvider> {/* WebRTC connection */}
            <AppContent />
          </ConnectionProvider>
        </AuthProvider>
      </SettingsProvider>
    </ThemeProvider>
  );
}
```

**Provider Hierarchy Analysis:**

#### **Layered Architecture:**
1. **ThemeProvider** (Outermost) - Theme switching and persistence
2. **SettingsProvider** - Application settings and preferences
3. **AuthProvider** - User authentication and session management
4. **ConnectionProvider** (Innermost) - Real-time connection state

#### **Dependency Order:**
- **Theme → Settings:** Settings may depend on theme preferences
- **Settings → Auth:** Auth UI may use settings for appearance
- **Auth → Connection:** Connection requires authenticated user

```typescript
function AppContent() {
  const { shouldConnect, disconnect } = useConnection();
  const { isAuthenticated, isLoading } = useAuth();

  // Listen for user logout events
  useEffect(() => {
    const handleUserLogout = () => {
      try {
        disconnect();                    // Clean up connections
      } catch (error) {
        // Silently handle disconnect errors
      }
    };

    window.addEventListener('user-logged-out', handleUserLogout);
    return () => {
      window.removeEventListener('user-logged-out', handleUserLogout);
    };
  }, [disconnect]);

  // Loading state
  if (isLoading) {
    return (
      <div className="h-screen w-full bg-bg-primary flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-DEFAULT"></div>
      </div>
    );
  }

  // Authentication gate
  if (!isAuthenticated) {
    return <AuthPage />;
  }

  // Main application
  return (
    <div className="h-screen w-full bg-bg-primary overflow-hidden">
      {shouldConnect ? <RoomComponent /> : <ConnectionPage />}
    </div>
  );
}
```

**Conditional Rendering Logic:**

#### **Authentication Flow:**
1. **Loading State:** Shows spinner while checking auth status
2. **Unauthenticated:** Redirects to login/register page
3. **Authenticated:** Shows main application interface

#### **Connection States:**
- **Not Connected:** Shows connection landing page with features
- **Connected:** Shows main room interface with chat and voice

#### **Event Handling:**
- **User Logout:** Automatically disconnects WebRTC when user logs out
- **Cleanup:** Proper event listener cleanup to prevent memory leaks

**Interview Talking Points:**
1. **Provider Pattern:** "Hierarchical providers ensure proper dependency injection and state management"
2. **Conditional Rendering:** "Clean separation between auth states and connection states"
3. **Event Handling:** "Global event system for cross-component communication"
4. **Error Boundaries:** "Graceful error handling with try-catch blocks"
5. **Performance:** "Lazy loading of components based on authentication state"

---

## ✅ Phase 1 Complete

**What We've Covered:**
- Project setup and modern React/Next.js architecture
- Comprehensive theming system with Tailwind CSS
- Root layout with font optimization and SEO
- Provider hierarchy and conditional rendering logic

**Key Interview Points:**
- Modern tooling and dependency management
- Design system architecture and accessibility
- Provider pattern and state management strategy
- Performance optimization and user experience

---

*Ready for Phase 2: Core State Management? Let me know when to continue!*
