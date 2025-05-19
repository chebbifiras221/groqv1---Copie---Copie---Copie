"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { LogIn, AlertCircle } from "lucide-react";

interface LoginFormProps {
  onSuccess?: () => void;
  onRegisterClick: () => void;
}

export function LoginForm({ onSuccess, onRegisterClick }: LoginFormProps) {
  const { login, isLoading, error, clearError } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (username.trim() && password) {
      const success = await login(username, password);
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
        <h2 className="text-2xl font-bold text-text-primary mb-2">Welcome Back</h2>
        <p className="text-text-secondary">Sign in to access your conversations</p>
      </div>

      <form onSubmit={handleSubmit}>
        {error && (
          <div className="mb-4 p-3 bg-danger-DEFAULT/10 border border-danger-DEFAULT/30 rounded-md flex items-center text-danger-DEFAULT">
            <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0" />
            <span className="text-sm">{error}</span>
          </div>
        )}

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
              clearError();
            }}
            className="w-full p-2.5 bg-bg-primary border border-bg-tertiary/30 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-DEFAULT/50"
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
            onChange={(e) => {
              setPassword(e.target.value);
              clearError();
            }}
            className="w-full p-2.5 bg-bg-primary border border-bg-tertiary/30 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-DEFAULT/50"
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
          <LogIn className="w-4 h-4 mr-2" />
          Sign In
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
