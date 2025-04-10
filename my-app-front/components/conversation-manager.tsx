"use client";

import { useState, useEffect } from "react";
import { useMaybeRoomContext } from "@livekit/components-react";
import { ConnectionState } from "livekit-client";
import { useConnectionState } from "@livekit/components-react";
import { Button } from "./ui/button";
import { Trash2, Edit, Check, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface Conversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  message_count?: number;
}

interface ConversationMessage {
  id: string;
  conversation_id: string;
  type: string;
  content: string;
  timestamp: string;
}

interface ConversationData {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  messages: ConversationMessage[];
}

export function ConversationManager() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversation, setCurrentConversation] = useState<ConversationData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const room = useMaybeRoomContext();
  const connectionState = useConnectionState();
  const isConnected = connectionState === ConnectionState.Connected;

  // Fetch conversations when connected
  useEffect(() => {
    if (isConnected && room) {
      fetchConversations();
    }
  }, [isConnected, room]);

  // Listen for data messages from the server
  useEffect(() => {
    if (!room) return;

    const handleDataReceived = (payload: Uint8Array) => {
      try {
        const dataString = new TextDecoder().decode(payload);
        const data = JSON.parse(dataString);

        if (data.type === "conversations_list") {
          setConversations(data.conversations);

          // Automatically load the most recent conversation if we don't have one loaded
          if (data.conversations.length > 0 && !currentConversation) {
            // Sort by updated_at and get the most recent one
            const sortedConversations = [...data.conversations].sort(
              (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
            );
            fetchConversation(sortedConversations[0].id);
          }
        } else if (data.type === "conversation_data") {
          setCurrentConversation(data.conversation);
        } else if (data.type === "new_conversation_created") {
          // Refresh the conversation list
          fetchConversations();
          // Load the new conversation
          fetchConversation(data.conversation_id);
        } else if (data.type === "conversation_renamed") {
          // Update the conversation title in the list
          setConversations(prev =>
            prev.map(conv =>
              conv.id === data.conversation_id
                ? { ...conv, title: data.title }
                : conv
            )
          );

          // Update current conversation if it's the one being renamed
          if (currentConversation?.id === data.conversation_id) {
            setCurrentConversation(prev =>
              prev ? { ...prev, title: data.title } : null
            );
          }
        } else if (data.type === "conversation_deleted") {
          // Remove the conversation from the list
          setConversations(prev =>
            prev.filter(conv => conv.id !== data.conversation_id)
          );

          // If the current conversation was deleted, clear it
          if (currentConversation?.id === data.conversation_id) {
            setCurrentConversation(null);

            // If a new conversation was created, load it
            if (data.new_conversation_id) {
              fetchConversation(data.new_conversation_id);
            }
          }

          // Refresh the conversation list
          fetchConversations();
        } else if (data.type === "all_conversations_cleared") {
          // Clear the conversations list
          setConversations([]);
          setCurrentConversation(null);

          // Load the new conversation
          if (data.new_conversation_id) {
            fetchConversation(data.new_conversation_id);
          }

          // Refresh the conversation list
          fetchConversations();
        }
      } catch (e) {
        console.error("Error parsing data message:", e);
      }
    };

    room.on("dataReceived", handleDataReceived);
    return () => {
      room.off("dataReceived", handleDataReceived);
    };
  }, [room, currentConversation]);

  const fetchConversations = async () => {
    if (!room) return;

    setIsLoading(true);
    try {
      const message = {
        type: "list_conversations"
      };
      await room.localParticipant.publishData(
        new TextEncoder().encode(JSON.stringify(message))
      );
    } catch (error) {
      console.error("Error fetching conversations:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchConversation = async (conversationId: string) => {
    if (!room) return;

    setIsLoading(true);
    try {
      const message = {
        type: "get_conversation",
        conversation_id: conversationId
      };
      await room.localParticipant.publishData(
        new TextEncoder().encode(JSON.stringify(message))
      );
    } catch (error) {
      console.error("Error fetching conversation:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const createNewConversation = async () => {
    if (!room) return;

    setIsLoading(true);
    try {
      const message = {
        type: "new_conversation",
        title: `New Conversation`
      };
      await room.localParticipant.publishData(
        new TextEncoder().encode(JSON.stringify(message))
      );
    } catch (error) {
      console.error("Error creating new conversation:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const startEditingTitle = (conversation: Conversation) => {
    setEditingId(conversation.id);
    setEditTitle(conversation.title);
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditTitle("");
  };

  const saveTitle = async (conversationId: string) => {
    if (!room || !editTitle.trim()) return;

    setIsLoading(true);
    try {
      const message = {
        type: "rename_conversation",
        conversation_id: conversationId,
        title: editTitle.trim()
      };
      await room.localParticipant.publishData(
        new TextEncoder().encode(JSON.stringify(message))
      );
      setEditingId(null);
    } catch (error) {
      console.error("Error renaming conversation:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const deleteConversation = async (conversationId: string) => {
    if (!room) return;

    if (!window.confirm("Are you sure you want to delete this conversation?")) {
      return;
    }

    setIsLoading(true);
    try {
      const message = {
        type: "delete_conversation",
        conversation_id: conversationId
      };
      await room.localParticipant.publishData(
        new TextEncoder().encode(JSON.stringify(message))
      );
    } catch (error) {
      console.error("Error deleting conversation:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const clearAllConversations = async () => {
    if (!room) return;

    if (!window.confirm("Are you sure you want to clear all conversations? This cannot be undone.")) {
      return;
    }

    setIsLoading(true);
    try {
      const message = {
        type: "clear_all_conversations"
      };
      await room.localParticipant.publishData(
        new TextEncoder().encode(JSON.stringify(message))
      );
    } catch (error) {
      console.error("Error clearing conversations:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleString();
    } catch (e) {
      return dateString;
    }
  };

  if (!isConnected) {
    return null;
  }

  return (
    <div className="w-64 bg-accent-bg border-r border-white/10 h-full flex flex-col">
      <div className="p-4 border-b border-white/10">
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-lg font-semibold">Conversations</h2>
          <Button
            onClick={clearAllConversations}
            variant="ghost"
            size="sm"
            className="text-white/50 hover:text-white hover:bg-white/10 h-7 w-7 p-0"
            title="Clear All Conversations"
            disabled={isLoading || conversations.length === 0}
          >
            <Trash2 size={14} />
          </Button>
        </div>
        <Button
          onClick={createNewConversation}
          className="w-full"
          disabled={isLoading}
        >
          New Conversation
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="p-2">
          {conversations.length === 0 ? (
            <div className="text-white/50 text-sm p-2">No conversations yet</div>
          ) : (
            conversations.map((conversation) => (
              <motion.div
                key={conversation.id}
                className={`p-3 rounded-md mb-2 hover:bg-white/5 transition-colors border border-transparent ${
                  currentConversation?.id === conversation.id ? "bg-white/10 border-white/20" : "hover:border-white/10"
                }`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                onClick={() => fetchConversation(conversation.id)}
              >
                {editingId === conversation.id ? (
                  <div className="flex flex-col gap-1">
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className="w-full bg-black/30 border border-white/20 rounded-sm px-2 py-1 text-sm"
                      autoFocus
                    />
                    <div className="flex justify-end gap-1">
                      <Button
                        onClick={() => saveTitle(conversation.id)}
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        disabled={!editTitle.trim()}
                      >
                        <Check size={12} />
                      </Button>
                      <Button
                        onClick={cancelEditing}
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                      >
                        <X size={12} />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="text-sm font-medium truncate">
                      <motion.span
                        key={conversation.title}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.3 }}
                      >
                        {conversation.title}
                      </motion.span>
                    </div>
                    <div className="flex justify-between items-center mt-1">
                      <span className="text-xs text-white/50">{formatDate(conversation.updated_at)}</span>
                      <div className="flex gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            startEditingTitle(conversation);
                          }}
                          className="text-white/50 hover:text-white transition-colors p-1 rounded-full hover:bg-white/10"
                          title="Rename"
                        >
                          <Edit size={14} />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteConversation(conversation.id);
                          }}
                          className="text-white/50 hover:text-white transition-colors p-1 rounded-full hover:bg-white/10 hover:text-red-400"
                          title="Delete"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </motion.div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
