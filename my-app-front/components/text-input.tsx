"use client";

import { useState, KeyboardEvent } from "react";
import { useMaybeRoomContext } from "@livekit/components-react";
import { Button } from "@/components/ui/button";
import { Send } from "lucide-react";

export interface TextInputProps {
  isConnected: boolean;
}

export function TextInput({ isConnected }: TextInputProps) {
  const [inputText, setInputText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const room = useMaybeRoomContext();

  const handleSubmit = async () => {
    if (!inputText.trim() || !room || !isConnected) return;

    setIsSubmitting(true);

    try {
      // Send the text input to the backend via LiveKit data channel
      const message = {
        type: "text_input",
        text: inputText.trim()
      };

      await room.localParticipant.publishData(new TextEncoder().encode(JSON.stringify(message)));
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

  return (
    <div className="flex items-center gap-2 w-full px-2 py-2">
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
        className="bg-white text-black hover:bg-white/90 rounded-md p-2"
      >
        <Send size={18} />
      </Button>
    </div>
  );
}
