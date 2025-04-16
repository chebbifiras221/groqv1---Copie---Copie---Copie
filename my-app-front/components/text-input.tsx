"use client";

import { useState, KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { Send, Trash2, Code } from "lucide-react";
import { useConversation } from "@/hooks/use-conversation";
import { useMaybeRoomContext } from "@livekit/components-react";
import { CodeEditor } from "./code-editor";
import { motion, AnimatePresence } from "framer-motion";

export interface TextInputProps {
  isConnected: boolean;
}

export function TextInput({ isConnected }: TextInputProps) {
  const [inputText, setInputText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCodeEditor, setShowCodeEditor] = useState(false);
  const [codeText, setCodeText] = useState("");
  const [codeLanguage, setCodeLanguage] = useState("javascript");
  const { addUserMessage, clearMessages } = useConversation();
  const room = useMaybeRoomContext();

  const handleSubmit = async () => {
    if ((!inputText.trim() && !codeText.trim()) || !isConnected) return;

    setIsSubmitting(true);

    try {
      // Determine what to send based on which input is active
      let messageToSend = showCodeEditor
        ? `\`\`\`${codeLanguage}\n${codeText}\n\`\`\``
        : inputText.trim();

      console.log('Sending text input:', messageToSend);
      await addUserMessage(messageToSend);

      // Clear the input fields immediately for better UX
      if (showCodeEditor) {
        setCodeText("");
      } else {
        setInputText("");
      }
    } catch (error) {
      console.error("Error sending text input:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const toggleCodeEditor = () => {
    setShowCodeEditor(!showCodeEditor);
  };

  const handleCodeChange = (code: string) => {
    setCodeText(code);
  };

  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setCodeLanguage(e.target.value);
  };

  const handleClearMessages = () => {
    if (window.confirm('Are you sure you want to clear all messages?')) {
      clearMessages();
    }
  };

  // Removed createNewConversation function as it's already in ConversationManager

  return (
    <div className="flex flex-col w-full px-4 py-3 gap-3">
      <div className="flex justify-between">
        <Button
          onClick={toggleCodeEditor}
          variant="ghost"
          size="sm"
          className={`text-white/50 hover:text-white hover:bg-white/10 flex items-center gap-2 px-3 py-2 rounded-md ${showCodeEditor ? 'bg-white/10 text-white' : ''}`}
        >
          <Code size={20} />
          <span>{showCodeEditor ? 'Switch to Text' : 'Switch to Code'}</span>
        </Button>
        <Button
          onClick={handleClearMessages}
          variant="ghost"
          size="sm"
          className="text-white/50 hover:text-white hover:bg-white/10 flex items-center gap-2 px-3 py-2 rounded-md"
        >
          <Trash2 size={20} />
          <span>Clear Chat</span>
        </Button>
      </div>

      <AnimatePresence mode="wait">
        {showCodeEditor ? (
          <motion.div
            key="code-editor"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.2 }}
            className="flex flex-col gap-3"
          >
            <div className="flex items-center gap-2 mb-2">
              <label htmlFor="language-select" className="text-white/70 text-sm">Language:</label>
              <select
                id="language-select"
                value={codeLanguage}
                onChange={handleLanguageChange}
                className="bg-black/30 border border-white/20 rounded-md px-2 py-1 text-white text-sm focus:outline-none focus:ring-1 focus:ring-white/50"
              >
                <option value="javascript">JavaScript</option>
                <option value="typescript">TypeScript</option>
                <option value="python">Python</option>
                <option value="html">HTML</option>
                <option value="css">CSS</option>
                <option value="jsx">JSX</option>
                <option value="tsx">TSX</option>
                <option value="json">JSON</option>
              </select>
            </div>
            <div className="w-full">
              <CodeEditor
                initialCode={codeText}
                language={codeLanguage}
                placeholder="Write your code here..."
                onChange={handleCodeChange}
              />
            </div>
            <div className="flex justify-end">
              <Button
                onClick={handleSubmit}
                disabled={!isConnected || !codeText.trim() || isSubmitting}
                className="bg-black border border-white/30 text-white hover:bg-white/10 rounded-md px-4 py-2 transition-colors flex items-center gap-2"
                title="Send code"
              >
                <Send size={16} />
                <span>Send Code</span>
              </Button>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="text-input"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.2 }}
            className="flex items-center gap-3 w-full"
          >
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={isConnected ? "Type your message here..." : "Connect to start chatting"}
              disabled={!isConnected || isSubmitting}
              className="flex-1 bg-black/30 border border-white/20 rounded-md px-4 py-3 text-white placeholder:text-white/50 focus:outline-none focus:ring-1 focus:ring-white/50"
            />
            <Button
              onClick={handleSubmit}
              disabled={!isConnected || !inputText.trim() || isSubmitting}
              className="bg-black border border-white/30 text-white hover:bg-white/10 rounded-md p-3 transition-colors"
              title="Send message"
            >
              <Send size={20} />
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
