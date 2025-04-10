"use client";

import { useState, KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { Send, Trash2, Plus } from "lucide-react";
import { useConversation } from "@/hooks/use-conversation";
import { useMaybeRoomContext } from "@livekit/components-react";

export interface TextInputProps {
  isConnected: boolean;
}

export function TextInput({ isConnected }: TextInputProps) {
  const [inputText, setInputText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { addUserMessage, clearMessages } = useConversation();
  const room = useMaybeRoomContext();

  const handleSubmit = async () => {
    if (!inputText.trim() || !isConnected) return;

    setIsSubmitting(true);

    try {
      // Send the message to the backend
      console.log('Sending text input:', inputText.trim());
      await addUserMessage(inputText.trim());

      // Clear the input field immediately for better UX
      setInputText("");
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

  const handleClearMessages = () => {
    if (window.confirm('Are you sure you want to clear all messages?')) {
      clearMessages();
    }
  };

  const createNewConversation = async () => {
    if (!room || !isConnected) return;

    try {
      const message = {
        type: "new_conversation",
        title: `Conversation-${new Date().toISOString()}`
      };
      await room.localParticipant.publishData(
        new TextEncoder().encode(JSON.stringify(message))
      );
    } catch (error) {
      console.error("Error creating new conversation:", error);
    }
  };

  return (
    <div className="flex flex-col w-full px-2 py-2 gap-2">
      <div className="flex justify-between">
        <Button
          onClick={createNewConversation}
          variant="ghost"
          size="sm"
          disabled={!isConnected}
          className="text-white/50 hover:text-white hover:bg-white/10 flex items-center gap-1"
        >
          <Plus size={14} />
          <span>New Conversation</span>
        </Button>
        <Button
          onClick={handleClearMessages}
          variant="ghost"
          size="sm"
          className="text-white/50 hover:text-white hover:bg-white/10 flex items-center gap-1"
        >
          <Trash2 size={14} />
          <span>Clear Chat</span>
        </Button>
      </div>
      <div className="flex items-center gap-2 w-full">
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={isConnected ? "Type your message here..." : "Connect to start chatting"}
          disabled={!isConnected || isSubmitting}
          className="flex-1 bg-black/30 border border-white/20 rounded-md px-3 py-2 text-white placeholder:text-white/50 focus:outline-none focus:ring-1 focus:ring-white/50"
        />
        <Button
          onClick={handleSubmit}
          disabled={!isConnected || !inputText.trim() || isSubmitting}
          className="bg-black border border-white/30 text-white hover:bg-white/10 rounded-md p-2 transition-colors"
        >
          <Send size={18} />
        </Button>
      </div>
    </div>
  );
}
