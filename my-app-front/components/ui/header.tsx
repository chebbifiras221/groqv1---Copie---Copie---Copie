"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Settings, LogOut, HelpCircle, Moon, Sun, Menu, X, MessageSquare, BookOpen, HelpCircle as HelpIcon } from 'lucide-react';
import { SimpleBotFace } from './simple-bot-face';
import { Button } from './button';
import { StatusIndicator } from './status-indicator';
import { useConnection } from '@/hooks/use-connection';
import { ConversationManager } from '../conversation-manager';
import { useTheme } from '@/hooks/use-theme';
import { useSettings } from '@/hooks/use-settings';
import { SettingsModal } from './settings-modal';
import { HelpModal } from './help-modal';

interface HeaderProps {
  title?: string;
}

export function Header({ title = "Programming Teacher" }: HeaderProps) {
  const { disconnect } = useConnection();
  const { theme, toggleTheme } = useTheme();
  const { settings, updateSettings } = useSettings();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [currentMode, setCurrentMode] = useState<'teacher' | 'qa'>(settings.teachingMode || 'teacher');

  // Update the current mode when settings change
  useEffect(() => {
    setCurrentMode(settings.teachingMode || 'teacher');
  }, [settings.teachingMode]);

  // Toggle between teacher and Q&A modes and create a new conversation
  const toggleTeachingMode = () => {
    const newMode = currentMode === 'teacher' ? 'qa' : 'teacher';

    // First update the teaching mode in settings
    updateSettings({ teachingMode: newMode });

    // Then create a new conversation with the new mode
    // This ensures the conversation uses the new teaching mode
    if (typeof window !== 'undefined') {
      // Create a custom event to trigger a new conversation creation
      // This is more reliable than directly manipulating localStorage
      const createNewConversationEvent = new CustomEvent('create-new-conversation-for-mode-switch', {
        detail: { teachingMode: newMode }
      });
      window.dispatchEvent(createNewConversationEvent);

      // Also dispatch a course UI reset event
      const resetEvent = new CustomEvent('course-ui-reset', {
        detail: { conversationId: 'new' }
      });
      window.dispatchEvent(resetEvent);
    }
  };

  const handleDisconnect = () => {
    if (confirm('Are you sure you want to disconnect?')) {
      disconnect();
    }
  };

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const openSettings = () => {
    setIsSettingsOpen(true);
  };

  const openHelp = () => {
    setIsHelpOpen(true);
  };

  return (
    <>
      <header className="h-16 bg-bg-secondary flex items-center justify-between px-4 z-20 relative overflow-hidden border-b border-bg-tertiary/30">
        <div className="absolute top-0 left-0 w-full h-0.5 bg-primary-DEFAULT/20"></div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden mr-1"
            onClick={toggleMobileMenu}
          >
            {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </Button>

          <SimpleBotFace size={32} />
          <h1 className="text-lg font-semibold text-text-primary hidden sm:block">{title}</h1>
        </div>

        <div className="flex items-center gap-3">
          <StatusIndicator className="mr-2" />

          {/* Mode toggle button */}
          <button
            onClick={toggleTeachingMode}
            className="teaching-mode-toggle flex items-center gap-2 px-3 py-1.5 rounded-md transition-all bg-secondary-DEFAULT/10 border border-secondary-DEFAULT text-secondary-DEFAULT hover:bg-secondary-DEFAULT/20"
            title={currentMode === 'teacher' ? 'Click to switch to Q&A Mode' : 'Click to switch to Teacher Mode'}
          >
            {currentMode === 'teacher' ? (
              <>
                <BookOpen size={16} className="teaching-mode-icon" />
                <span className="text-sm font-medium">Teacher Mode</span>
              </>
            ) : (
              <>
                <HelpIcon size={16} className="teaching-mode-icon" />
                <span className="text-sm font-medium">Q&A Mode</span>
              </>
            )}
          </button>

          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            className="w-10 h-10 rounded-full relative overflow-hidden"
          >
            <span className={`absolute inset-0 flex items-center justify-center transition-opacity duration-300 ${theme === 'dark' ? 'opacity-100' : 'opacity-0'}`}>
              <Sun className="w-5 h-5" />
            </span>
            <span className={`absolute inset-0 flex items-center justify-center transition-opacity duration-300 ${theme === 'light' ? 'opacity-100' : 'opacity-0'}`}>
              <Moon className="w-5 h-5" />
            </span>
          </Button>

          <Button
            variant="ghost"
            size="icon"
            title="Help"
            onClick={openHelp}
            className="w-10 h-10 rounded-full"
          >
            <HelpCircle className="w-5 h-5" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            title="Settings"
            onClick={openSettings}
            className="w-10 h-10 rounded-full"
          >
            <Settings className="w-5 h-5 text-text-secondary" />
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleDisconnect}
            className="text-danger-DEFAULT hover:text-danger-DEFAULT hover:border-danger-DEFAULT flex items-center justify-center"
            title="Disconnect"
          >
            <LogOut className="w-4 h-4" />
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
              className="absolute top-16 left-0 bottom-0 w-64 bg-bg-secondary shadow-md"

              initial={{ x: -320 }}
              animate={{ x: 0 }}
              exit={{ x: -320 }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-4 flex items-center gap-2">
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

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />

      {/* Help Modal */}
      <HelpModal
        isOpen={isHelpOpen}
        onClose={() => setIsHelpOpen(false)}
      />
    </>
  );
}
