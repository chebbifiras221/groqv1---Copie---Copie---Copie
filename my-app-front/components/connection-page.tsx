"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useConnection } from "@/hooks/use-connection";
import { Mic, Code, MessageSquare, Github } from "lucide-react";

export function ConnectionPage() {
  const { connect } = useConnection();
  const [isLoading, setIsLoading] = useState(false);
  const [connectionStep, setConnectionStep] = useState(0);
  const [showFeatures, setShowFeatures] = useState(false);

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

  // Show features after a delay
  useEffect(() => {
    const featuresTimer = setTimeout(() => {
      setShowFeatures(true);
    }, 500);
    return () => clearTimeout(featuresTimer);
  }, []);

  const handleConnect = async () => {
    setIsLoading(true);
    try {
      // Wait for the connection steps to complete for better UX
      setTimeout(async () => {
        try {
          await connect();
        } catch (error) {
          console.error('Connection error:', error);
          setIsLoading(false);
          setConnectionStep(0);
        }
      }, 2400); // Wait for the steps to complete
    } catch (error) {
      console.error('Connection error:', error);
      setIsLoading(false);
      setConnectionStep(0);
    }
  };

  const connectionSteps = [
    "Initializing connection...",
    "Establishing secure channel...",
    "Connecting to AI assistant...",
    "Almost ready..."
  ];

  const features = [
    {
      icon: <Mic className="w-6 h-6 text-primary-DEFAULT" />,
      title: "Voice Interaction",
      description: "Speak naturally with the AI assistant using your microphone."
    },
    {
      icon: <Code className="w-6 h-6 text-secondary-DEFAULT" />,
      title: "Code Highlighting",
      description: "View and write code with syntax highlighting in a VS Code-like interface."
    },
    {
      icon: <MessageSquare className="w-6 h-6 text-success-DEFAULT" />,
      title: "Conversation History",
      description: "Access and manage your past conversations with the AI assistant."
    }
  ];

  return (
    <div className="flex flex-col items-center justify-center h-full w-full overflow-auto py-8">
      <motion.div
        className="flex flex-col items-center gap-8 max-w-xl w-full text-center px-4"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="flex flex-col items-center gap-4">
          <motion.div
            className="w-16 h-16 rounded-full bg-gradient-to-br from-primary-DEFAULT to-secondary-DEFAULT flex items-center justify-center shadow-lg"
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            transition={{
              type: "spring",
              stiffness: 260,
              damping: 20,
              delay: 0.1
            }}
          >
            <Mic className="w-8 h-8 text-white" />
          </motion.div>

          <motion.h1
            className="text-4xl font-bold bg-gradient-to-r from-primary-DEFAULT to-secondary-DEFAULT text-transparent bg-clip-text"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            AI Teacher Assistant
          </motion.h1>

          <motion.p
            className="text-text-secondary text-lg max-w-md"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            Connect to start a conversation with your AI teaching assistant. Your voice will be transcribed in real-time.
          </motion.p>
        </div>

        <motion.div
          className="w-full max-w-md"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Button
            variant="primary"
            size="lg"
            className="w-full text-base font-medium"
            onClick={handleConnect}
            isLoading={isLoading}
            disabled={isLoading}
          >
            {isLoading ? connectionSteps[connectionStep] : "Connect to Assistant"}
          </Button>
        </motion.div>

        <AnimatePresence>
          {showFeatures && (
            <motion.div
              className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full mt-4"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, staggerChildren: 0.1 }}
            >
              {features.map((feature, index) => (
                <motion.div
                  key={index}
                  className="bg-bg-secondary border border-border-muted rounded-lg p-6 flex flex-col items-center text-center gap-3 hover:border-border-DEFAULT transition-colors"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 + (index * 0.1) }}
                >
                  <div className="p-3 rounded-full bg-bg-tertiary">
                    {feature.icon}
                  </div>
                  <h3 className="text-lg font-medium text-text-primary">{feature.title}</h3>
                  <p className="text-text-secondary text-sm">{feature.description}</p>
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        <motion.div
          className="text-text-tertiary text-sm flex items-center gap-2 mt-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
        >
          <Github className="w-4 h-4" />
          <span>Powered by LiveKit and Groq</span>
        </motion.div>
      </motion.div>
    </div>
  );
}
