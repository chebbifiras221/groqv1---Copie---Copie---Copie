"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { LogIn, AlertCircle } from "lucide-react";

interface LoginFormProps {
  onSuccess?: () => void;
  onRegisterClick: () => void;
}

export function LoginForm({ onSuccess, onRegisterClick }: LoginFormProps) {
  const { login, isLoading, error, errorType, clearError } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  // Create a local error state to ensure errors persist
  const [localError, setLocalError] = useState<string | null>(null);
  const [localErrorType, setLocalErrorType] = useState<string | undefined>(undefined);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Clear previous errors only when submitting the form
    setLocalError(null);
    setLocalErrorType(undefined);
    clearError();

    if (username.trim() && password) {
      const success = await login(username, password);
      if (success && onSuccess) {
        onSuccess();
      }
    }
  };



  // Sync local error state with auth error state
  useEffect(() => {
    // Update local error state when auth error state changes
    if (error) {
      setLocalError(error);
      setLocalErrorType(errorType);
    }
  }, [error, errorType]);

  return (
    <motion.div
      className="w-full max-w-md bg-bg-secondary p-6 rounded-lg shadow-lg"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-text-primary mb-2">Welcome Back</h2>
        <p className="text-text-secondary">Sign in to access your conversations</p>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Always show a message box - either instructions or error */}
        <div
          className={`mb-4 p-3 ${localError ? 'bg-danger-DEFAULT/10 border-danger-DEFAULT/30 text-danger-DEFAULT' : 'bg-bg-tertiary/10 border-bg-tertiary/30 text-text-secondary'} border rounded-md flex items-center`}
        >
          {localError && <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0" />}
          <span className="text-sm">
            {localError ? (
              <strong>
                {localErrorType === 'username' ? 'User does not exist' :
                localErrorType === 'password' ? 'Password is incorrect' :
                localError}
              </strong>
            ) : (
              'Enter your credentials to login'
            )}
          </span>
        </div>



        <div className="mb-4">
          <label htmlFor="username" className="block text-sm font-medium text-text-secondary mb-1">
            Username
          </label>
          <input
            id="username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className={`w-full p-2.5 bg-bg-primary border ${localErrorType === 'username' ? 'border-danger-DEFAULT' : 'border-bg-tertiary/30'} rounded-md focus:outline-none focus:ring-2 focus:ring-primary-DEFAULT/50`}
            placeholder="Enter your username"
            required
          />

        </div>

        <div className="mb-6">
          <label htmlFor="password" className="block text-sm font-medium text-text-secondary mb-1">
            Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={`w-full p-2.5 bg-bg-primary border ${localErrorType === 'password' ? 'border-danger-DEFAULT' : 'border-bg-tertiary/30'} rounded-md focus:outline-none focus:ring-2 focus:ring-primary-DEFAULT/50`}
            placeholder="Enter your password"
            required
          />

        </div>

        <Button
          type="submit"
          variant="primary"
          size="lg"
          className="w-full mb-4"
          isLoading={isLoading}
          disabled={isLoading}
        >
          <span className="flex items-center justify-center gap-2">
            <span>Sign In</span>
            <LogIn className="w-4 h-4" />
          </span>
        </Button>

        <div className="text-center text-sm text-text-secondary">
          Don't have an account?{" "}
          <button
            type="button"
            onClick={onRegisterClick}
            className="text-primary-DEFAULT hover:underline focus:outline-none"
          >
            Register
          </button>
        </div>
      </form>
    </motion.div>
  );
}
