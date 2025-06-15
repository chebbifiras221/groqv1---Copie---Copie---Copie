"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { UserPlus, AlertCircle } from "lucide-react";

interface RegisterFormProps {
  onSuccess?: () => void;
  onLoginClick: () => void;
}

export function RegisterForm({ onSuccess, onLoginClick }: RegisterFormProps) {
  const { register, isLoading, error, errorType, clearError } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  const validateForm = () => {
    // Only set validation errors, don't clear them
    if (password !== confirmPassword) {
      setValidationError("Passwords do not match");
      return false;
    }

    if (password.length < 6) {
      setValidationError("Password must be at least 6 characters");
      return false;
    }

    // If we get here, validation passed
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Clear previous errors only when submitting the form
    clearError();
    setValidationError(null);

    if (!validateForm()) {
      return;
    }

    if (username.trim() && password) {
      console.log(`Submitting registration form with username: ${username}`);
      const success = await register(username, password);
      console.log(`Registration result: ${success}, Error: ${error}, ErrorType: ${errorType}`);
      if (success && onSuccess) {
        onSuccess();
      }
    }
  };

  return (
    <motion.div
      className="w-full max-w-md bg-bg-secondary p-6 rounded-lg shadow-lg"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-text-primary mb-2">Create Account</h2>
        <p className="text-text-secondary">Sign up to get started</p>
      </div>

      <form onSubmit={handleSubmit}>
        {(error || validationError) && (
          <div className="mb-4 p-3 bg-danger-DEFAULT/10 border border-danger-DEFAULT/30 rounded-md flex items-center text-danger-DEFAULT">
            <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0" />
            <span className="text-sm">
              {validationError ? validationError :
               errorType === 'username_exists' ? 'This username is already taken. Please choose another one.' :
               error}
            </span>
          </div>
        )}

        {/* Add debug info */}
        <div className="mb-4 p-2 bg-bg-tertiary/10 text-xs text-text-tertiary rounded">
          <p>Debug info - try username: "test", password: "password"</p>
        </div>

        <div className="mb-4">
          <label htmlFor="username" className="block text-sm font-medium text-text-secondary mb-1">
            Username
          </label>
          <input
            id="username"
            type="text"
            value={username}
            onChange={(e) => {
              setUsername(e.target.value);
              // Don't clear errors on typing
            }}
            className={`w-full p-2.5 bg-bg-primary border ${errorType === 'username_exists' ? 'border-danger-DEFAULT' : 'border-bg-tertiary/30'} rounded-md focus:outline-none focus:ring-2 focus:ring-primary-DEFAULT/50`}
            placeholder="Choose a username"
            required
          />
        </div>

        <div className="mb-4">
          <label htmlFor="password" className="block text-sm font-medium text-text-secondary mb-1">
            Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              // Don't clear errors on typing
            }}
            className="w-full p-2.5 bg-bg-primary border border-bg-tertiary/30 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-DEFAULT/50"
            placeholder="Create a password"
            required
          />
        </div>

        <div className="mb-6">
          <label htmlFor="confirmPassword" className="block text-sm font-medium text-text-secondary mb-1">
            Confirm Password
          </label>
          <input
            id="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(e) => {
              setConfirmPassword(e.target.value);
              // Don't clear errors on typing
            }}
            className="w-full p-2.5 bg-bg-primary border border-bg-tertiary/30 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-DEFAULT/50"
            placeholder="Confirm your password"
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
            <span>Create Account</span>
            <UserPlus className="w-4 h-4" />
          </span>
        </Button>

        <div className="text-center text-sm text-text-secondary">
          Already have an account?{" "}
          <button
            type="button"
            onClick={onLoginClick}
            className="text-primary-DEFAULT hover:underline focus:outline-none"
          >
            Sign In
          </button>
        </div>
      </form>
    </motion.div>
  );
}
