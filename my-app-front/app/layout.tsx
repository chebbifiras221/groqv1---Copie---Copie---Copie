import type { Metadata } from "next";                            // TypeScript type for page metadata
import { Geist, Geist_Mono } from "next/font/google";            // Google Fonts for the app
import "./globals.css";                                          // Global CSS styles
import "./light-theme.css";                                      // Light theme specific styles
import { ToastProvider } from "@/components/ui/toast";           // Toast notification provider

const geistSans = Geist({                                        // Configure main sans-serif font
  variable: "--font-geist-sans",                                 // CSS variable name for the font
  subsets: ["latin"],                                            // Character subset to load
});

const geistMono = Geist_Mono({                                   // Configure monospace font for code
  variable: "--font-geist-mono",                                 // CSS variable name for the mono font
  subsets: ["latin"],                                            // Character subset to load
});

export const metadata: Metadata = {                             // Page metadata for SEO and browser
  title: "Programming Teacher",                                 // Browser tab title
  description: "Learn programming with a teacher using voice and text interaction", // Page description for search engines
};

export default function RootLayout({                             // Root layout component that wraps all pages
  children,                                                      // Child components (pages) to render
}: Readonly<{                                                    // TypeScript props definition
  children: React.ReactNode;                                     // Any valid React content
}>) {
  return (
    <html lang="en" className="dark">                           {/* HTML root with English language and dark theme class */}
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`} {/* Body with font variables and smooth text rendering */}
      >
        <ToastProvider>                                          {/* Provider for toast notifications throughout the app */}
          {children}                                             {/* Render the page content */}
        </ToastProvider>
      </body>
    </html>
  );
}
