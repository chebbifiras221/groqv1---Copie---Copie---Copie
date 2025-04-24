"use client";

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, X } from 'lucide-react';
import { Button } from './button';
import { ConversationManager } from '../conversation-manager';

interface MobileConversationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function MobileConversationDrawer({ isOpen, onClose }: MobileConversationDrawerProps) {
  return (
    <>
      {/* Backdrop */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="fixed inset-0 bg-black/50 z-40 md:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{ willChange: 'opacity' }}
            onClick={onClose}
          />
        )}
      </AnimatePresence>

      {/* Drawer */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="fixed inset-y-0 left-0 w-[85%] max-w-xs bg-bg-secondary z-50 md:hidden flex flex-col shadow-xl"
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 350, mass: 0.8 }}
            style={{ willChange: 'transform' }}
          >
            <div className="flex items-center justify-between p-4 border-b border-bg-tertiary/30">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-primary-DEFAULT/10 flex items-center justify-center">
                  <MessageSquare className="w-4 h-4 text-primary-DEFAULT" />
                </div>
                <h2 className="font-medium text-text-primary text-lg">Conversations</h2>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="h-8 w-8 rounded-full text-text-secondary hover:text-text-primary hover:bg-bg-tertiary/50"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>
            <div className="flex-1 overflow-hidden">
              <ConversationManager />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
