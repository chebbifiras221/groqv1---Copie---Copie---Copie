"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { LoginForm } from "./login-form";
import { RegisterForm } from "./register-form";
import { SimpleBotFace } from "@/components/ui/simple-bot-face";
import { useConnection } from "@/hooks/use-connection";
import { useAuth } from "@/hooks/use-auth";

interface AuthPageProps {
  onAuthSuccess?: () => void;
}

export function AuthPage({ onAuthSuccess }: AuthPageProps) {
  const [showLogin, setShowLogin] = useState(true);
  const { connect } = useConnection();
  const { logout } = useAuth();

  // Ensure user is fully logged out when this component mounts
  useEffect(() => {
    // Clear any existing auth state
    logout();

    // Listen for the user-logged-out event
    const handleUserLoggedOut = () => {
      // Show the login form when the user logs out
      setShowLogin(true);
    };

    window.addEventListener('user-logged-out', handleUserLoggedOut);

    return () => {
      window.removeEventListener('user-logged-out', handleUserLoggedOut);
    };
  }, [logout]);

  const handleAuthSuccess = async () => {
    try {
      // Connect to the assistant after successful authentication
      await connect();

      // Call the onAuthSuccess callback if provided
      if (onAuthSuccess) {
        onAuthSuccess();
      }
    } catch (error) {
      console.error("Error connecting after authentication:", error);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-bg-primary p-4">
      <motion.div
        className="mb-8 flex flex-col items-center"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <SimpleBotFace size={80} />
        <h1 className="text-3xl font-bold text-text-primary mt-4">Programming Teacher</h1>
        <p className="text-text-secondary mt-2">Your personal AI programming assistant</p>
      </motion.div>

      <AnimatePresence mode="wait">
        {showLogin ? (
          <motion.div
            key="login"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.3 }}
          >
            <LoginForm
              onSuccess={handleAuthSuccess}
              onRegisterClick={() => setShowLogin(false)}
            />
          </motion.div>
        ) : (
          <motion.div
            key="register"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
            <RegisterForm
              onSuccess={() => setShowLogin(true)}
              onLoginClick={() => setShowLogin(true)}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
