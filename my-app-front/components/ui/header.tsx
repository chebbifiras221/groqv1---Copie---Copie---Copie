"use client";

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Settings, LogOut, HelpCircle, Moon, Sun, Menu, X, MessageSquare } from 'lucide-react';
import { Button } from './button';
import { StatusIndicator } from './status-indicator';
import { useConnection } from '@/hooks/use-connection';
import { ConversationManager } from '../conversation-manager';

interface HeaderProps {
  title?: string;
}

export function Header({ title = "AI Teacher Assistant" }: HeaderProps) {
  const { disconnect } = useConnection();
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleDisconnect = () => {
    if (confirm('Are you sure you want to disconnect?')) {
      disconnect();
    }
  };

  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode);
    // In a real implementation, this would toggle the theme
    // For now, we'll just toggle the state for the icon
  };

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  return (
    <>
      <header className="h-16 border-b border-border-DEFAULT bg-bg-secondary flex items-center justify-between px-4 z-20 relative">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden mr-1"
            onClick={toggleMobileMenu}
          >
            {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </Button>

          <motion.div
            className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-DEFAULT to-secondary-DEFAULT flex items-center justify-center"
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 260, damping: 20 }}
          >
            <span className="text-white font-bold text-sm">AI</span>
          </motion.div>
          <h1 className="text-lg font-semibold text-text-primary hidden sm:block">{title}</h1>
        </div>

        <div className="flex items-center gap-3">
          <StatusIndicator className="mr-2" />

          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            title={isDarkMode ? "Switch to light mode" : "Switch to dark mode"}
          >
            {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </Button>

          <Button
            variant="ghost"
            size="icon"
            title="Help"
          >
            <HelpCircle className="w-5 h-5" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            title="Settings"
          >
            <Settings className="w-5 h-5" />
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleDisconnect}
            className="text-danger-DEFAULT hover:text-danger-DEFAULT hover:border-danger-DEFAULT"
          >
            <LogOut className="w-4 h-4 mr-1" />
            <span className="hidden sm:inline">Disconnect</span>
          </Button>
        </div>
      </header>

      {/* Mobile Sidebar */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            className="fixed inset-0 bg-bg-primary bg-opacity-80 z-10 md:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsMobileMenuOpen(false)}
          >
            <motion.div
              className="absolute top-16 left-0 bottom-0 w-80 bg-bg-secondary border-r border-border-DEFAULT"
              initial={{ x: -320 }}
              animate={{ x: 0 }}
              exit={{ x: -320 }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-4 border-b border-border-DEFAULT flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-primary-DEFAULT" />
                <h2 className="text-lg font-semibold">Conversations</h2>
              </div>
              <div className="h-full overflow-y-auto">
                <ConversationManager />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
