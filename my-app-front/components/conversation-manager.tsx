"use client";

import { useState, useEffect } from "react";
import { useMaybeRoomContext } from "@livekit/components-react";
import { ConnectionState } from "livekit-client";
import { useConnectionState } from "@livekit/components-react";
import { Button } from "./ui/button";
import { Trash2, Edit, Check, X, Plus, MessageSquare, Calendar, Clock } from "lucide-react";
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
      // Format as MM/DD HH:MM
      return `${date.getMonth()+1}/${date.getDate()} ${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`;
    } catch (e) {
      return dateString;
    }
  };

  if (!isConnected) {
    return null;
  }

  return (
    <div className="w-full h-full flex flex-col">
      <div className="p-3">
        <div className="flex justify-between items-center mb-2">
          <Button
            onClick={createNewConversation}
            variant="primary"
            className="flex-1 py-1.5 flex items-center justify-center gap-1.5 text-sm bg-primary-DEFAULT hover:opacity-90 rounded-md"
            disabled={isLoading}
          >
            <Plus size={14} className="flex-shrink-0" />
            <span>New Chat</span>
          </Button>
          <Button
            onClick={clearAllConversations}
            variant="ghost"
            size="icon"
            className="ml-2 text-danger-DEFAULT hover:text-danger-hover"
            title="Clear All Conversations"
            disabled={isLoading || conversations.length === 0}
          >
            <Trash2 size={16} />
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="p-2">
          {isLoading && conversations.length === 0 && (
            <div className="flex flex-col items-center justify-center py-8 gap-4">
              <div className="w-10 h-10 rounded-full bg-bg-tertiary flex items-center justify-center animate-pulse">
                <MessageSquare className="w-5 h-5 text-text-secondary" />
              </div>
              <p className="text-text-secondary text-sm">Loading conversations...</p>
            </div>
          )}

          {!isLoading && conversations.length === 0 && (
            <div className="flex flex-col items-center justify-center py-8 gap-4">
              <div className="w-16 h-16 rounded-full bg-bg-tertiary flex items-center justify-center">
                <MessageSquare className="w-8 h-8 text-text-secondary" />
              </div>
              <div className="text-center">
                <p className="text-text-secondary text-sm mb-2">No conversations yet</p>
                <p className="text-text-tertiary text-xs">Start a new conversation to begin</p>
              </div>
            </div>
          )}

          {conversations.length > 0 && (
            <div className="space-y-1.5">
              {conversations.map((conversation) => (
                <motion.div
                  key={conversation.id}
                  className={`p-1.5 rounded-md ${currentConversation?.id === conversation.id
                    ? "bg-bg-tertiary/60 border-l-2 border-primary-DEFAULT/30"
                    : "hover:bg-bg-tertiary/30 hover:border-l-2 hover:border-primary-DEFAULT/20"}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.15, ease: "easeOut" }}
                  style={{ willChange: "opacity, transform" }}
                  onClick={() => fetchConversation(conversation.id)}
                >
                  {editingId === conversation.id ? (
                    <div className="flex flex-col gap-2">
                      <input
                        type="text"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        className="bg-bg-primary border-0 focus:ring-1 focus:ring-primary-DEFAULT rounded-md px-2 py-1 text-text-primary w-full text-sm shadow-sm"
                        autoFocus
                        onClick={(e) => e.stopPropagation()}
                      />
                      <div className="flex justify-end gap-2">
                        <Button
                          onClick={(e) => {
                            e.stopPropagation();
                            cancelEditing();
                          }}
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                        >
                          <X size={14} />
                        </Button>
                        <Button
                          onClick={(e) => {
                            e.stopPropagation();
                            saveTitle(conversation.id);
                          }}
                          variant="primary"
                          size="icon"
                          className="h-7 w-7"
                          disabled={!editTitle.trim()}
                        >
                          <Check size={14} />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="font-medium text-text-primary break-words pr-2 text-[11px]">{conversation.title}</h3>
                        <div className="flex gap-1">
                          <Button
                            onClick={(e) => {
                              e.stopPropagation();
                              startEditingTitle(conversation);
                            }}
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5 text-text-tertiary hover:text-text-primary"
                          >
                            <Edit size={10} />
                          </Button>
                          <Button
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteConversation(conversation.id);
                            }}
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5 text-danger-DEFAULT hover:text-danger-hover"
                          >
                            <Trash2 size={10} />
                          </Button>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 text-[8px] text-text-tertiary mb-0.5">
                        <Clock size={10} />
                        <span>{formatDate(conversation.updated_at)}</span>
                      </div>

                      {/* Message preview */}
                      {(currentConversation?.id === conversation.id && currentConversation.messages && currentConversation.messages.length > 0) ? (
                        <div className="mt-1 text-[9px] text-text-secondary bg-bg-primary/30 backdrop-blur-sm p-1 rounded-md shadow-sm">
                          <span className="font-medium">
                            {currentConversation.messages[currentConversation.messages.length - 1].type === 'user' ? 'You: ' : 'AI: '}
                          </span>
                          <span className="line-clamp-2">
                            {currentConversation.messages[currentConversation.messages.length - 1].content.substring(0, 80)}
                            {currentConversation.messages[currentConversation.messages.length - 1].content.length > 80 ? '...' : ''}
                          </span>
                        </div>
                      ) : conversation.messages && conversation.messages.length > 0 ? (
                        <div className="mt-1 text-[9px] text-text-secondary bg-bg-primary/30 backdrop-blur-sm p-1 rounded-md shadow-sm">
                          <span className="font-medium">
                            {conversation.messages[conversation.messages.length - 1].type === 'user' ? 'You: ' : 'AI: '}
                          </span>
                          <span className="line-clamp-2">
                            {conversation.messages[conversation.messages.length - 1].content.substring(0, 80)}
                            {conversation.messages[conversation.messages.length - 1].content.length > 80 ? '...' : ''}
                          </span>
                        </div>
                      ) : conversation.last_message ? (
                        <div className="mt-1 text-[9px] text-text-secondary bg-bg-primary/30 backdrop-blur-sm p-1 rounded-md shadow-sm">
                          <span className="font-medium">
                            {conversation.last_message.type === 'user' ? 'You: ' : 'AI: '}
                          </span>
                          <span className="line-clamp-2">
                            {conversation.last_message.content.substring(0, 80)}
                            {conversation.last_message.content.length > 80 ? '...' : ''}
                          </span>
                        </div>
                      ) : null}
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
