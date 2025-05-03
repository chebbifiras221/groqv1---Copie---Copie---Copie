"use client";

import { useState, useEffect } from "react";
import { useMaybeRoomContext } from "@livekit/components-react";
import { ConnectionState, Room } from "livekit-client";
import { useConnectionState } from "@livekit/components-react";
import { Button } from "./ui/button";
import { Trash2, Edit, Check, X, MessageSquare, Clock } from "lucide-react";
import { motion } from "framer-motion";
import { useErrorHandler } from "@/hooks/use-error-handler";

// Helper function to check if a room is connected
// This avoids TypeScript errors with ConnectionState comparison
function isRoomConnected(room: Room): boolean {
  return room.state === ConnectionState.Connected;
}

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
  const [initialLoadDone, setInitialLoadDone] = useState(false); // Flag to track initial load
  const room = useMaybeRoomContext();
  const connectionState = useConnectionState();
  const isConnected = connectionState === ConnectionState.Connected;
  const { handleError } = useErrorHandler();

  /**
   * Function to fetch the list of conversations from the server
   * Returns a promise that resolves when the request is sent
   */
  const fetchConversations = async () => {
    if (!room) return Promise.resolve();

    setIsLoading(true);
    try {
      const message = {
        type: "list_conversations"
      };

      // Check if the room is connected before attempting to publish
      if (room.state !== ConnectionState.Connected) {
        console.warn('Room not connected, attempting to reconnect...');

        // Wait for the room to reconnect (up to 5 seconds)
        for (let i = 0; i < 5; i++) {
          await new Promise(resolve => setTimeout(resolve, 1000));

          // Need to check the current state each time
          // Using a function to check the state to avoid TypeScript errors
          if (isRoomConnected(room)) {
            console.log('Room reconnected successfully');
            break;
          }

          // If we've waited 5 seconds and still not connected, throw an error
          if (i === 4) {
            throw new Error('Room failed to reconnect after 5 seconds');
          }
        }
      }

      // Send the request to the server with retry logic
      let retryCount = 0;
      const maxRetries = 3;

      while (retryCount < maxRetries) {
        try {
          await room.localParticipant.publishData(
            new TextEncoder().encode(JSON.stringify(message))
          );
          console.log('Successfully requested conversation list');
          break; // Success, exit the loop
        } catch (publishError) {
          retryCount++;
          console.warn(`Publish attempt ${retryCount} failed:`, publishError);

          if (retryCount >= maxRetries) {
            throw publishError; // Rethrow after max retries
          }

          // Wait with exponential backoff before retrying
          const delay = 300 * Math.pow(2, retryCount - 1);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }

      // Return a promise that resolves after a short delay
      // This gives time for the server to respond and update the state
      return new Promise<void>(resolve => {
        setTimeout(resolve, 500);
      });
    } catch (error) {
      handleError(error, 'conversation', 'Error loading conversations');
      return Promise.resolve(); // Resolve even on error
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Function to fetch a specific conversation by ID
   */
  const fetchConversation = async (conversationId: string) => {
    if (!room) return;

    setIsLoading(true);
    try {
      // Reset any course UI state for the previous conversation
      if (typeof window !== 'undefined') {
        // Dispatch a custom event to notify components about the course reset
        const resetEvent = new CustomEvent('course-ui-reset', {
          detail: { conversationId }
        });
        window.dispatchEvent(resetEvent);
      }

      // Store the conversation ID in localStorage so the useConversation hook can pick it up
      localStorage.setItem('current-conversation-id', conversationId);

      // Prepare to load the conversation
      const message = {
        type: "get_conversation",
        conversation_id: conversationId
      };

      // Check if the room is connected before attempting to publish
      if (room.state !== ConnectionState.Connected) {
        console.warn('Room not connected, attempting to reconnect...');

        // Wait for the room to reconnect (up to 5 seconds)
        for (let i = 0; i < 5; i++) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          if (isRoomConnected(room)) {
            console.log('Room reconnected successfully');
            break;
          }

          // If we've waited 5 seconds and still not connected, throw an error
          if (i === 4) {
            throw new Error('Room failed to reconnect after 5 seconds');
          }
        }
      }

      // Send the request to the server with retry logic
      let retryCount = 0;
      const maxRetries = 3;

      while (retryCount < maxRetries) {
        try {
          await room.localParticipant.publishData(
            new TextEncoder().encode(JSON.stringify(message))
          );
          console.log(`Successfully requested conversation: ${conversationId}`);
          break; // Success, exit the loop
        } catch (publishError) {
          retryCount++;
          console.warn(`Publish attempt ${retryCount} failed:`, publishError);

          if (retryCount >= maxRetries) {
            throw publishError; // Rethrow after max retries
          }

          // Wait with exponential backoff before retrying
          const delay = 300 * Math.pow(2, retryCount - 1);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }

      // Store the current conversation ID in memory for better state tracking
      // This helps with UI updates and prevents loading issues
      setCurrentConversation(prev => {
        if (prev?.id === conversationId) return prev;
        return null; // Clear current conversation while loading the new one
      });
    } catch (error) {
      handleError(error, 'conversation', 'Error loading conversation');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Function to create a new conversation
   */
  const createNewConversation = async () => {
    if (!room) return;

    setIsLoading(true);
    try {
      // Reset any course UI state for the previous conversation
      if (typeof window !== 'undefined') {
        // Dispatch a custom event to notify components about the course reset
        const resetEvent = new CustomEvent('course-ui-reset', {
          detail: { conversationId: 'new' }
        });
        window.dispatchEvent(resetEvent);
      }

      // Clear the current conversation ID in localStorage
      // The server will assign a new ID when it creates the conversation
      localStorage.removeItem('current-conversation-id');

      const message = {
        type: "new_conversation",
        title: `New Conversation`
      };

      // Send the request to create a new conversation
      await room.localParticipant.publishData(
        new TextEncoder().encode(JSON.stringify(message))
      );
    } catch (error) {
      handleError(error, 'conversation', 'Error creating new conversation');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Handle initial conversation loading when connected
   * This ensures we load the conversation list as soon as the connection is established
   * and create exactly one new conversation if none exist
   */
  useEffect(() => {
    // Only run this effect when we first connect
    if (isConnected && room && !initialLoadDone) {
      console.log("Initial connection detected, loading conversations");

      // Mark initial load as done to prevent this from running again
      setInitialLoadDone(true);

      // Store in localStorage that we've done the initial load
      localStorage.setItem('initial-load-done', 'true');

      // Fetch conversations
      fetchConversations().then(() => {
        // After fetching, check if we need to create a new conversation
        // This will run after the state has been updated with the fetched conversations
        setTimeout(() => {
          if (conversations.length === 0) {
            console.log("No conversations found on initial load, creating one automatically");
            createNewConversation();
          } else {
            console.log(`Found ${conversations.length} existing conversations, not creating a new one`);
          }
        }, 1000);
      });
    }
  }, [isConnected, room, initialLoadDone]);

  // Check localStorage on component mount to see if we've already done the initial load
  useEffect(() => {
    const hasInitialLoadBeenDone = localStorage.getItem('initial-load-done') === 'true';
    if (hasInitialLoadBeenDone) {
      setInitialLoadDone(true);
    }
  }, []);

  // Listen for data messages from the server
  useEffect(() => {
    if (!room) return;

    // Using any for the parameters to avoid TypeScript errors with LiveKit's event handler
    // The actual implementation only uses the payload and topic
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const handleDataReceived = (payload: any, _participant?: any, _kind?: any, topic?: any) => {
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
          // Update the conversations list in state
          setConversations(data.conversations);

          // Get the current conversation ID from localStorage
          const currentId = localStorage.getItem('current-conversation-id');

          // Automatically load the most recent conversation if we don't have one loaded
          if (data.conversations.length > 0) {
            // Sort by updated_at and get the most recent one
            const sortedConversations = [...data.conversations].sort(
              (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
            );

            // If we have a current ID, check if it exists in the conversations list
            if (currentId) {
              const conversationExists = data.conversations.some((c: Conversation) => c.id === currentId);

              if (conversationExists) {
                // If the current conversation exists but isn't loaded, load it
                if (!currentConversation || currentConversation.id !== currentId) {
                  // Load the conversation from localStorage
                  fetchConversation(currentId);
                }
              } else {
                // If the current conversation doesn't exist, load the most recent one
                // Current ID not found, load the most recent conversation
                fetchConversation(sortedConversations[0].id);
              }
            } else if (!currentConversation) {
              // If we don't have a current ID and no conversation is loaded, load the most recent one
              // No current conversation, load the most recent one
              fetchConversation(sortedConversations[0].id);
            }
          }
        } else if (data.type === "conversation_data") {
          // Update the current conversation in state
          setCurrentConversation(data.conversation);

          // Make sure localStorage is updated with the current conversation ID
          localStorage.setItem('current-conversation-id', data.conversation.id);
        } else if (data.type === "new_conversation_created") {
          // Handle new conversation creation

          // Update localStorage with the new conversation ID
          localStorage.setItem('current-conversation-id', data.conversation_id);

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
        handleError(e, 'conversation', 'Error processing conversation data');
      }
    };

    room.on("dataReceived", handleDataReceived);
    return () => {
      room.off("dataReceived", handleDataReceived);
    };
  }, [room, currentConversation]);



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
      handleError(error, 'conversation', 'Error renaming conversation');
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
      handleError(error, 'conversation', 'Error deleting conversation');
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
      handleError(error, 'conversation', 'Error clearing all conversations');
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      const now = new Date();
      const isToday = date.getDate() === now.getDate() &&
                     date.getMonth() === now.getMonth() &&
                     date.getFullYear() === now.getFullYear();

      // Format hours and minutes with leading zeros
      const hours = date.getHours();
      const minutes = date.getMinutes().toString().padStart(2, '0');
      const ampm = hours >= 12 ? 'PM' : 'AM';
      const hour12 = hours % 12 || 12; // Convert 0 to 12 for 12 AM

      // If today, show only time, otherwise show date and time
      if (isToday) {
        return `Today at ${hour12}:${minutes} ${ampm}`;
      } else {
        // Format as MM/DD/YY, HH:MM AM/PM
        return `${date.getMonth()+1}/${date.getDate()}/${date.getFullYear().toString().slice(-2)} · ${hour12}:${minutes} ${ampm}`;
      }
    } catch (e) {
      return dateString;
    }
  };

  if (!isConnected) {
    return null;
  }

  return (
    <div className="w-full h-full flex flex-col">
      <div className="p-4 border-b border-bg-tertiary/30">
        <div className="flex justify-between items-center gap-3">
          <Button
            onClick={createNewConversation}
            variant="primary"
            className="flex-1 py-2.5 flex items-center justify-center gap-2 text-sm font-medium bg-primary-DEFAULT hover:bg-primary-hover rounded-md shadow-sm transition-all duration-200 hover:shadow"
            disabled={isLoading}
          >
            <span>+ &nbsp;New Chat</span>
          </Button>
          <Button
            onClick={clearAllConversations}
            variant="ghost"
            size="icon"
            className="h-10 w-10 rounded-full text-danger-DEFAULT hover:text-danger-hover hover:bg-danger-DEFAULT/10 transition-colors duration-200"
            title="Clear All Conversations"
            disabled={isLoading || conversations.length === 0}
          >
            <Trash2 size={18} />
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="p-4">
          {isLoading && conversations.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 gap-5">
              <div className="w-14 h-14 rounded-full bg-bg-tertiary/50 flex items-center justify-center shadow-inner">
                <div className="animate-pulse">
                  <MessageSquare className="w-6 h-6 text-primary-DEFAULT/70" />
                </div>
              </div>
              <div className="text-center">
                <p className="text-text-secondary text-sm font-medium">Loading conversations...</p>
                <p className="text-text-tertiary text-xs mt-1">Please wait a moment</p>
              </div>
            </div>
          )}

          {!isLoading && conversations.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 gap-5">
              <div className="w-16 h-16 rounded-full bg-bg-tertiary/40 flex items-center justify-center shadow-sm border border-bg-tertiary/50">
                <MessageSquare className="w-8 h-8 text-primary-DEFAULT/60" />
              </div>
              <div className="text-center max-w-xs">
                <p className="text-text-primary text-base font-medium mb-2">No conversations yet</p>
                <p className="text-text-secondary text-sm">Start a new chat to begin your conversation with the AI assistant</p>
              </div>
            </div>
          )}

          {conversations.length > 0 && (
            <div className="space-y-1.5">
              {conversations.map((conversation) => (
                <motion.div
                  key={conversation.id}
                  className={`p-3 rounded-lg mb-2 shadow-sm border group cursor-pointer transition-all duration-200 ${currentConversation?.id === conversation.id
                    ? "bg-bg-tertiary/30 border-primary-DEFAULT/30"
                    : "hover:bg-bg-tertiary/10 border-bg-tertiary/30 hover:shadow-md hover:-translate-y-0.5"}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.2, ease: "easeOut" }}
                  style={{ willChange: "opacity, transform" }}
                  onClick={() => fetchConversation(conversation.id)}
                >
                  {editingId === conversation.id ? (
                    <div className="flex flex-col gap-2">
                      <input
                        type="text"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        className="bg-bg-primary border-0 focus:ring-1 focus:ring-primary-DEFAULT rounded-md px-2 py-1 text-text-primary w-full text-sm"
                        style={{ boxShadow: 'var(--shadow-sm)' }}
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
                      <div className="flex justify-between items-start mb-3">
                        <h3 className="font-medium text-text-primary break-words pr-2 text-sm">{conversation.title}</h3>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            onClick={(e) => {
                              e.stopPropagation();
                              startEditingTitle(conversation);
                            }}
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-text-tertiary hover:text-text-primary hover:bg-bg-tertiary/50 rounded-full"
                          >
                            <Edit size={12} />
                          </Button>
                          <Button
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteConversation(conversation.id);
                            }}
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-danger-DEFAULT hover:text-danger-hover hover:bg-danger-DEFAULT/10 rounded-full"
                          >
                            <Trash2 size={12} />
                          </Button>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 text-xs text-text-tertiary mb-2">
                        <Clock size={12} className="flex-shrink-0" />
                        <span>{formatDate(conversation.updated_at)}</span>
                      </div>

                      {/* Message preview */}
                      {(currentConversation?.id === conversation.id && currentConversation.messages && currentConversation.messages.length > 0) ? (
                        <div className="text-xs text-text-secondary bg-bg-tertiary/20 p-2.5 rounded-md border border-bg-tertiary/30 shadow-sm">
                          <span className="font-medium text-primary-DEFAULT">
                            {currentConversation.messages[currentConversation.messages.length - 1].type === 'user' ? 'You: ' : 'AI: '}
                          </span>
                          <span className="line-clamp-2">
                            {currentConversation.messages[currentConversation.messages.length - 1].content.substring(0, 100)}
                            {currentConversation.messages[currentConversation.messages.length - 1].content.length > 100 ? '...' : ''}
                          </span>
                        </div>
                      ) : conversation.messages && conversation.messages.length > 0 ? (
                        <div className="text-xs text-text-secondary bg-bg-tertiary/20 p-2.5 rounded-md border border-bg-tertiary/30 shadow-sm">
                          <span className="font-medium text-primary-DEFAULT">
                            {conversation.messages[conversation.messages.length - 1].type === 'user' ? 'You: ' : 'AI: '}
                          </span>
                          <span className="line-clamp-2">
                            {conversation.messages[conversation.messages.length - 1].content.substring(0, 100)}
                            {conversation.messages[conversation.messages.length - 1].content.length > 100 ? '...' : ''}
                          </span>
                        </div>
                      ) : conversation.last_message ? (
                        <div className="text-xs text-text-secondary bg-bg-tertiary/20 p-2.5 rounded-md border border-bg-tertiary/30 shadow-sm">
                          <span className="font-medium text-primary-DEFAULT">
                            {conversation.last_message.type === 'user' ? 'You: ' : 'AI: '}
                          </span>
                          <span className="line-clamp-2">
                            {conversation.last_message.content.substring(0, 100)}
                            {conversation.last_message.content.length > 100 ? '...' : ''}
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
