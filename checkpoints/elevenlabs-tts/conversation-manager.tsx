"use client";

import { useState, useEffect } from "react";
import { useMaybeRoomContext } from "@livekit/components-react";
import { ConnectionState } from "livekit-client";
import { useConnectionState } from "@livekit/components-react";
import { Button } from "./ui/button";
import { Trash2, Edit, Check, X, Plus } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface Conversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  message_count?: number;
  last_message?: {
    type: string;
    content: string;
  };
  messages?: Array<{
    id: string;
    type: string;
    content: string;
    timestamp: string;
  }>;
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

    const handleDataReceived = (payload: Uint8Array, topic?: string) => {
      // Skip binary audio data
      if (topic === "binary_audio" || payload[0] === 73 && payload[1] === 68 && payload[2] === 51) { // "ID3" header for MP3
        // This is binary audio data, not JSON - skip it
        return;
      }

      try {
        const dataString = new TextDecoder().decode(payload);
        let data;

        try {
          data = JSON.parse(dataString);
        } catch (e) {
          // If it's not valid JSON and not already identified as binary audio, log and return
          console.log("Received non-JSON data in ConversationManager");
          return;
        }

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
    <div className="w-72 bg-accent-bg border-r border-white/10 h-full flex flex-col">
      <div className="p-4 border-b border-white/10">
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-lg font-semibold">Conversations</h2>
          <Button
            onClick={clearAllConversations}
            variant="ghost"
            size="sm"
            className="text-white/50 hover:text-white hover:bg-white/10 h-10 w-10 p-0 rounded-full hover:bg-red-500/20 hover:text-red-400"
            title="Clear All Conversations"
            disabled={isLoading || conversations.length === 0}
          >
            <Trash2 size={22} />
          </Button>
        </div>
        <Button
          onClick={createNewConversation}
          className="w-full py-2 flex items-center justify-center gap-2"
          disabled={isLoading}
        >
          <Plus size={16} />
          <span>New Conversation</span>
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="p-3">
          {conversations.length === 0 ? (
            <div className="text-white/50 text-sm p-3 text-center">No conversations yet</div>
          ) : (
            conversations.map((conversation) => (
              <motion.div
                key={conversation.id}
                className={`p-4 rounded-md mb-3 hover:bg-white/5 transition-colors border border-transparent ${
                  currentConversation?.id === conversation.id ? "bg-white/10 border-white/20" : "hover:border-white/10"
                }`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                onClick={() => fetchConversation(conversation.id)}
              >
                {editingId === conversation.id ? (
                  <div className="flex flex-col gap-2">
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className="w-full bg-black/30 border border-white/20 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-white/50"
                      autoFocus
                      onClick={(e) => e.stopPropagation()}
                    />
                    <div className="flex justify-end gap-2">
                      <Button
                        onClick={(e) => {
                          e.stopPropagation();
                          saveTitle(conversation.id);
                        }}
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 hover:text-green-400 hover:bg-white/10 rounded-full"
                        disabled={!editTitle.trim()}
                        title="Save"
                      >
                        <Check size={16} />
                      </Button>
                      <Button
                        onClick={(e) => {
                          e.stopPropagation();
                          cancelEditing();
                        }}
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 hover:text-red-400 hover:bg-white/10 rounded-full"
                        title="Cancel"
                      >
                        <X size={16} />
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

                    {/* Add a preview of the conversation content */}
                    {/* Show last message from current conversation data if available */}
                    {currentConversation?.id === conversation.id && currentConversation.messages && currentConversation.messages.length > 0 ? (
                      <div className="mt-1 text-xs text-white/60 truncate">
                        <span className="font-medium">
                          {currentConversation.messages[currentConversation.messages.length - 1].type === 'user' ? 'You: ' : 'AI: '}
                        </span>
                        {currentConversation.messages[currentConversation.messages.length - 1].content.substring(0, 40)}
                        {currentConversation.messages[currentConversation.messages.length - 1].content.length > 40 ? '...' : ''}
                      </div>
                    ) : conversation.messages && conversation.messages.length > 0 ? (
                      <div className="mt-1 text-xs text-white/60 truncate">
                        <span className="font-medium">
                          {conversation.messages[conversation.messages.length - 1].type === 'user' ? 'You: ' : 'AI: '}
                        </span>
                        {conversation.messages[conversation.messages.length - 1].content.substring(0, 40)}
                        {conversation.messages[conversation.messages.length - 1].content.length > 40 ? '...' : ''}
                      </div>
                    ) : conversation.last_message ? (
                      <div className="mt-1 text-xs text-white/60 truncate">
                        <span className="font-medium">
                          {conversation.last_message.type === 'user' ? 'You: ' : 'AI: '}
                        </span>
                        {conversation.last_message.content.substring(0, 40)}
                        {conversation.last_message.content.length > 40 ? '...' : ''}
                      </div>
                    ) : null}

                    <div className="flex justify-between items-center mt-2">
                      <span className="text-xs text-white/50">{formatDate(conversation.updated_at)}</span>
                      <div className="flex gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            startEditingTitle(conversation);
                          }}
                          className="text-white/50 hover:text-white transition-colors p-1.5 rounded-full hover:bg-white/10"
                          title="Rename"
                        >
                          <Edit size={18} />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteConversation(conversation.id);
                          }}
                          className="text-white/50 hover:text-white transition-colors p-1.5 rounded-full hover:bg-white/10 hover:text-red-400"
                          title="Delete"
                        >
                          <Trash2 size={18} />
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
