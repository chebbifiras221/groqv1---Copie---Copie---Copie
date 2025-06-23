"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useConnection } from "@/hooks/use-connection";
import { useAuth } from "@/hooks/use-auth";
import { Github, LogOut } from "lucide-react";
import { SimpleBotFace } from "@/components/ui/simple-bot-face";

export function ConnectionPage() {
  const { connect, disconnect } = useConnection();
  const { user, logout } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [connectionStep, setConnectionStep] = useState(0);

  // Simulate connection steps for better UX
  useEffect(() => {
    if (isLoading) {
      const stepTimer = setTimeout(() => {
        if (connectionStep < 3) {
          setConnectionStep(prev => prev + 1);
        }
      }, 800);
      return () => clearTimeout(stepTimer);
    } else {
      setConnectionStep(0);
    }
  }, [isLoading, connectionStep]);

  const handleConnect = async () => {
    setIsLoading(true);
    try {
      // Wait for the connection steps to complete for better UX
      setTimeout(async () => {
        try {
          await connect();
        } catch (error) {
          setIsLoading(false);
          setConnectionStep(0);
        }
      }, 2400); // Wait for the steps to complete
    } catch (error) {
      setIsLoading(false);
      setConnectionStep(0);
    }
  };

  const handleLogout = () => {
    if (confirm('Are you sure you want to log out? You will need to log in again to access your conversations.')) {
      // First disconnect from any active connections
      try {
        // Disconnect if connected
        disconnect();
      } catch (error) {
        // Silently handle disconnection errors
      }

      // Then log out the user
      logout();

      // Reload the page to ensure a clean state
      setTimeout(() => {
        window.location.reload();
      }, 300);
    }
  };

  const connectionSteps = [
    "Initializing connection...",
    "Establishing secure channel...",
    "Connecting to AI assistant...",
    "Almost ready..."
  ];

  return (
    <div className="flex flex-col items-center justify-center h-full w-full overflow-auto py-8 relative">
      <motion.div
        className="flex flex-col items-center gap-8 max-w-xl w-full text-center px-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        style={{ willChange: 'opacity, transform' }}
      >
        <div className="flex flex-col items-center gap-4">
          <SimpleBotFace size={80} />

          <motion.h1
            className="text-4xl font-bold text-primary-DEFAULT"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1, duration: 0.2 }}
            style={{ willChange: 'opacity' }}
          >
            Programming Teacher
          </motion.h1>

          <motion.p
            className="text-text-secondary text-lg max-w-md"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.2 }}
            style={{ willChange: 'opacity' }}
          >
            Connect to start a conversation with your programming teacher. Your voice will be transcribed in real-time.
          </motion.p>

          {user && (
            <motion.div
              className="flex items-center gap-2 bg-bg-tertiary/30 px-4 py-2 rounded-full text-text-secondary"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.2 }}
            >
              <div className="w-8 h-8 rounded-full bg-primary-DEFAULT/20 flex items-center justify-center text-primary-DEFAULT font-medium">
                {user.username.charAt(0).toUpperCase()}
              </div>
              <span>Logged in as <span className="font-medium text-text-primary">{user.username}</span></span>
              <Button
                variant="ghost"
                size="icon"
                className="ml-2 text-danger-DEFAULT hover:text-danger-DEFAULT/80"
                onClick={handleLogout}
                title="Log out"
              >
                <LogOut className="w-4 h-4" />
              </Button>
            </motion.div>
          )}
        </div>

        <motion.div
          className="w-full max-w-md"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.25, duration: 0.2 }}
          style={{ willChange: 'opacity' }}
        >
          <Button
            variant="primary"
            size="lg"
            className="w-full text-base font-medium rounded-full bg-primary-DEFAULT hover:opacity-90"
            onClick={handleConnect}
            isLoading={isLoading}
            disabled={isLoading}
          >
            {isLoading ? connectionSteps[connectionStep] : "Connect to Assistant"}
          </Button>
        </motion.div>

        <motion.div
          className="text-text-tertiary text-sm flex items-center gap-2 mt-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          style={{ willChange: 'opacity' }}
        >
          <Github className="w-4 h-4" />
          <span>Powered by LiveKit and Groq</span>
        </motion.div>
      </motion.div>
    </div>
  );
}
