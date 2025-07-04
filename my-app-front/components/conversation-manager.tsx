"use client";

import { useState, useEffect } from "react";
import { useMaybeRoomContext } from "@livekit/components-react";
import { ConnectionState } from "livekit-client";
import { useConnectionState } from "@livekit/components-react";
import { Button } from "./ui/button";
import { Trash2, MessageSquare, BookOpen, HelpCircle } from "lucide-react";
import { useErrorHandler } from "@/hooks/use-error-handler";
import { useSettings } from "@/hooks/use-settings";
import { useAuth } from "@/hooks/use-auth";
import { ProgressBar } from "./ui/progress-bar";
import { ConversationItem } from "./conversation-item";
import {
  isRoomConnected,
  publishDataWithRetry,
  isConversationEmpty,
  waitForEvent
} from "@/utils/conversation-utils";

interface Conversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  teaching_mode?: 'teacher' | 'qa'; // Add teaching mode to the interface
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
  teaching_mode?: 'teacher' | 'qa'; // Add teaching mode to the interface
  messages: ConversationMessage[];
}

export function ConversationManager() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversation, setCurrentConversation] = useState<ConversationData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false); // Specific state for history loading
  const [initialLoadDone, setInitialLoadDone] = useState(false); // Flag to track initial load
  const [isCreatingNewConversation, setIsCreatingNewConversation] = useState(false); // Flag to prevent multiple creations
  const [isManuallySelecting, setIsManuallySelecting] = useState(false); // Flag to prevent auto-selection during manual selection
  const room = useMaybeRoomContext();
  const connectionState = useConnectionState();
  const isConnected = connectionState === ConnectionState.Connected;
  const { handleError } = useErrorHandler();
  const { settings } = useSettings(); // Get current settings including teaching mode
  const { user } = useAuth(); // Get current user information

  /**
   * Function to fetch the list of conversations from the server
   * Returns a promise that resolves when the conversations are actually loaded
   */
  const fetchConversations = async () => {
    if (!room) return Promise.resolve();

    setIsLoading(true);
    setIsLoadingHistory(true); // Set history loading state for progress bar

    try {
      // Always include user ID for data isolation
      const message = {
        type: "list_conversations",
        user_id: user?.id
      };

      // Use our utility to publish data with retry logic
      await publishDataWithRetry(room, message);

      // Wait for the conversations_list event
      await waitForEvent("conversations_list");

      return Promise.resolve();
    } catch (error) {
      handleError(error, 'conversation', 'Error loading conversations');
      return Promise.resolve(); // Resolve even on error
    } finally {
      setIsLoading(false);
      // Keep the history loading state active a bit longer for the progress bar
      // This ensures the progress bar completes its animation
      setTimeout(() => {
        setIsLoadingHistory(false);
      }, 500);
    }
  };

  /**
   * Function to fetch a specific conversation by ID
   */
  const fetchConversation = async (conversationId: string) => {
    if (!room) return;

    // Set flag to prevent automatic conversation selection
    setIsManuallySelecting(true);

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
        conversation_id: conversationId,
        user_id: user?.id
      };

      // Use our utility to publish data with retry logic
      await publishDataWithRetry(room, message);

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
      // Reset the manual selection flag after a delay to allow the conversation to load
      setTimeout(() => {
        setIsManuallySelecting(false);
      }, 1000);
    }
  };

  /**
   * Function to create a new conversation
   * Prevents creating multiple empty conversations
   */
  const createNewConversation = async () => {
    if (!room) return;

    // Prevent creating multiple empty conversations
    if (isCreatingNewConversation) {
      return;
    }

    // Check if we already have an empty conversation in the list
    const hasEmptyConversation = conversations.some(conv =>
      isConversationEmpty(currentConversation && currentConversation.id === conv.id
        ? currentConversation
        : conv)
    );

    if (hasEmptyConversation) {
      // Find the empty conversation and switch to it instead of creating a new one
      const emptyConversation = conversations.find(conv =>
        isConversationEmpty(currentConversation && currentConversation.id === conv.id
          ? currentConversation
          : conv)
      );

      if (emptyConversation && (!currentConversation || currentConversation.id !== emptyConversation.id)) {
        fetchConversation(emptyConversation.id);
      }

      return;
    }

    // Check if current conversation is empty and we're trying to create another one
    if (currentConversation && isConversationEmpty(currentConversation)) {
      return;
    }

    setIsLoading(true);
    setIsCreatingNewConversation(true);

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

      // Clear the current conversation in state to show loading state
      setCurrentConversation(null);

      // Create a message to request a new conversation with the current teaching mode
      // Always include user ID for data isolation
      const message = {
        type: "new_conversation",
        title: "New Conversation",
        teaching_mode: settings.teachingMode,
        user_id: user?.id
      };

      // Use our utility to publish data with retry logic
      await publishDataWithRetry(room, message);
    } catch (error) {
      handleError(error, 'conversation', 'Error creating new conversation');
    } finally {
      setIsLoading(false);
      // Reset the creating flag after a short delay
      setTimeout(() => {
        setIsCreatingNewConversation(false);
      }, 1000);
    }
  };

  /**
   * Handle initial conversation loading when connected
   * This ensures we IMMEDIATELY load the conversation list in the sidebar
   * and then create a new conversation by default only if needed
   */
  useEffect(() => {
    // Only run this effect when we first connect
    if (isConnected && room && !initialLoadDone) {
      // Mark initial load as done to prevent this from running again
      setInitialLoadDone(true);

      // Store in localStorage that we've done the initial load
      localStorage.setItem('initial-load-done', 'true');

      // Set loading state for the progress bar
      setIsLoadingHistory(true);

      const initializeConversations = async () => {
        try {
          // Load conversations first
          await fetchConversations();

          // Wait a moment for the conversations state to update
          setTimeout(() => {
            // Check if there's a current conversation ID in localStorage
            const currentId = localStorage.getItem('current-conversation-id');

            if (currentId && conversations.some(c => c.id === currentId)) {
              // Load the existing conversation
              fetchConversation(currentId);
              return;
            }

            // Look for an empty conversation for the current mode
            const emptyConversation = conversations.find(conv => {
              const conversationMode = conv.teaching_mode || 'teacher';
              const matchesMode = conversationMode === settings.teachingMode;
              const isEmpty = !conv.message_count || conv.message_count === 0;
              return matchesMode && isEmpty;
            });

            if (emptyConversation) {
              // Load the empty conversation
              localStorage.setItem('current-conversation-id', emptyConversation.id);
              fetchConversation(emptyConversation.id);
            } else {
              // Create a new conversation
              localStorage.removeItem('current-conversation-id');
              createNewConversation();
            }
          }, 100);

        } catch (error) {
          console.error("Error initializing conversations:", error);
          // Fallback: create a new conversation
          localStorage.removeItem('current-conversation-id');
          createNewConversation();
        }
      };

      // Start the initialization process
      initializeConversations();
    }
  }, [isConnected, room, initialLoadDone, settings.teachingMode]);

  // Check localStorage on component mount to see if we've already done the initial load
  useEffect(() => {
    const hasInitialLoadBeenDone = localStorage.getItem('initial-load-done') === 'true';
    if (hasInitialLoadBeenDone) {
      setInitialLoadDone(true);
    }
  }, []);

  // Function to select the latest empty conversation for the current mode - only used during initial load
  const selectLatestEmptyConversation = async () => {
    if (!room || !isConnected || isManuallySelecting || currentConversation) return;

    // Don't auto-select if there's already a conversation ID in localStorage
    const currentId = localStorage.getItem('current-conversation-id');
    if (currentId) {
      return;
    }

    // Find the latest empty conversation for the current mode - be strict about mode matching
    const emptyConversation = conversations.find(conv => {
      const conversationMode = conv.teaching_mode || 'teacher';
      const matchesMode = conversationMode === settings.teachingMode;
      const isEmpty = !conv.message_count || conv.message_count === 0;
      return matchesMode && isEmpty;
    });

    if (emptyConversation) {
      localStorage.setItem('current-conversation-id', emptyConversation.id);
      fetchConversation(emptyConversation.id);
    } else {
      createNewConversation();
    }
  };

  // Listen for the custom event to create a new conversation when switching modes
  useEffect(() => {
    if (!room) return;

    const handleCreateNewConversationForModeSwitch = async (event: Event) => {
      const customEvent = event as CustomEvent;
      const teachingMode = customEvent.detail?.teachingMode;

      // Clear the current conversation ID in localStorage
      localStorage.removeItem('current-conversation-id');

      // Clear the current conversation in state
      setCurrentConversation(null);

      // Set manual selection flag to prevent auto-selection interference
      setIsManuallySelecting(true);

      // First, refresh the conversation list to get the latest data
      try {
        await fetchConversations();

        // After fetching, look for conversations in the new mode - be strict about mode matching
        const conversationsForMode = conversations.filter(conv => {
          const conversationMode = conv.teaching_mode || 'teacher';
          return conversationMode === teachingMode;
        });

        // Always create a new conversation when switching modes
        // This ensures clean separation between teaching modes
        // Create a message to request a new conversation with the specified teaching mode
        const message = {
          type: "new_conversation",
          title: "New Conversation",
          teaching_mode: teachingMode,
          user_id: user?.id
        };

        // Set the creating flag to prevent duplicate creations
        setIsCreatingNewConversation(true);

        // Send the request to create a new conversation
        await room.localParticipant.publishData(
          new TextEncoder().encode(JSON.stringify(message))
        );

      } catch (error) {
        console.error("Error handling mode switch:", error);
      } finally {
        // Reset the creating flag after a short delay
        setTimeout(() => {
          setIsCreatingNewConversation(false);
          setIsManuallySelecting(false);
        }, 1000);
      }
    };

    window.addEventListener('create-new-conversation-for-mode-switch', handleCreateNewConversationForModeSwitch);

    return () => {
      window.removeEventListener('create-new-conversation-for-mode-switch', handleCreateNewConversationForModeSwitch);
    };
  }, [room, conversations, settings.teachingMode, user?.id, fetchConversations, createNewConversation, isManuallySelecting]);



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
          // If it's not valid JSON and not already identified as binary audio, return
          return;
        }

        if (data.type === "conversations_list") {
          // Sort conversations by updated_at (most recent first)
          const sortedConversations = [...data.conversations].sort(
            (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
          );

          // Update the conversations list in state with sorted conversations immediately
          setConversations(sortedConversations);

          // Dispatch a custom event that our promise can listen for
          if (typeof window !== 'undefined') {
            const event = new CustomEvent('data-message-received', {
              detail: JSON.stringify(data)
            });
            window.dispatchEvent(event);
          }

          // Get the current conversation ID from localStorage
          const currentId = localStorage.getItem('current-conversation-id');

          // If we have a specific conversation ID in localStorage, try to load it
          if (sortedConversations.length > 0 && currentId) {
            const requestedConversation = sortedConversations.find((c: Conversation) => c.id === currentId);

            if (requestedConversation) {
              // If the current conversation exists but isn't loaded, load it
              if (!currentConversation || currentConversation.id !== currentId) {
                fetchConversation(currentId);
              }
            } else {
              // Clear the invalid conversation ID
              localStorage.removeItem('current-conversation-id');
              setCurrentConversation(null);
            }
          } else if (!initialLoadDone && sortedConversations.length > 0 && !isManuallySelecting && !currentConversation) {
            // Only auto-select if we're in the initial loading phase AND don't have a current conversation
            selectLatestEmptyConversation();
          }
        } else if (data.type === "conversation_data") {
          // Update the current conversation in state
          setCurrentConversation(data.conversation);

          // Make sure localStorage is updated with the current conversation ID
          localStorage.setItem('current-conversation-id', data.conversation.id);

          // Reset manual selection flag when conversation data is received
          setIsManuallySelecting(false);

          // Dispatch event for other hooks to listen to (like TTS)
          if (typeof window !== 'undefined') {
            const event = new CustomEvent('data-message-received', {
              detail: JSON.stringify(data)
            });
            window.dispatchEvent(event);
          }
        } else if (data.type === "new_conversation_created") {
          // Handle new conversation creation
          // Update localStorage with the new conversation ID
          localStorage.setItem('current-conversation-id', data.conversation_id);

          // Reset the creating flag
          setIsCreatingNewConversation(false);

          // Load the new conversation immediately
          fetchConversation(data.conversation_id);

          // Also refresh the conversation list to ensure it's up-to-date
          // This will happen in the background and update the sidebar
          setTimeout(() => {
            fetchConversations();
          }, 100);
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
          // Remove the conversation from the list immediately
          setConversations(prev =>
            prev.filter(conv => conv.id !== data.conversation_id)
          );

          // If the current conversation was deleted, clear it
          if (currentConversation?.id === data.conversation_id) {
            setCurrentConversation(null);

            // If a new conversation was created, load it immediately
            if (data.new_conversation_id && data.new_conversation_id !== data.conversation_id) {
              localStorage.setItem('current-conversation-id', data.new_conversation_id);
              fetchConversation(data.new_conversation_id);
            }
          }
        } else if (data.type === "all_conversations_cleared") {
          const currentMode = settings.teachingMode;
          const responseMode = data.teaching_mode;

          // Only update UI if the response matches our current mode
          if (responseMode === currentMode) {
            // Filter out conversations with the cleared mode
            setConversations(prev =>
              prev.filter(conv => conv.teaching_mode && conv.teaching_mode !== responseMode)
            );

            // Clear current conversation if it was in the cleared mode
            if (currentConversation?.teaching_mode === responseMode) {
              setCurrentConversation(null);
            }

            // Load the new conversation
            if (data.new_conversation_id) {
              // Store the new conversation ID in localStorage first
              localStorage.setItem('current-conversation-id', data.new_conversation_id);

              // The backend already sent an updated conversation list, so we just need to load the conversation
              // Use a small delay to ensure all state updates are processed
              setTimeout(() => {
                fetchConversation(data.new_conversation_id);
              }, 200);
            } else {
              // If no new conversation was created, just refresh the list
              fetchConversations().catch(err =>
                console.error("Error refreshing conversation list:", err)
              );
            }
          } else {
            // Still refresh the list to get the updated state
            fetchConversations().catch(err =>
              console.error("Error refreshing conversation list:", err)
            );
          }
        }
      } catch (e) {
        handleError(e, 'conversation', 'Error processing conversation data');
      }
    };

    room.on("dataReceived", handleDataReceived);
    return () => {
      room.off("dataReceived", handleDataReceived);
    };
  }, [room, currentConversation, settings.teachingMode, initialLoadDone, isManuallySelecting]);

  const saveTitle = async (conversationId: string, newTitle: string) => {
    if (!room || !newTitle.trim()) return;

    setIsLoading(true);
    try {
      const message = {
        type: "rename_conversation",
        conversation_id: conversationId,
        title: newTitle.trim(),
        user_id: user?.id
      };
      await publishDataWithRetry(room, message);
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
        conversation_id: conversationId,
        user_id: user?.id
      };
      await publishDataWithRetry(room, message);
    } catch (error) {
      handleError(error, 'conversation', 'Error deleting conversation');
    } finally {
      setIsLoading(false);
    }
  };

  const clearAllConversations = async () => {
    if (!room) return;

    const currentMode = settings.teachingMode;
    const modeText = currentMode === 'teacher' ? 'Teacher' : 'Q&A';

    if (!window.confirm(`Are you sure you want to clear all ${modeText} mode conversations? This cannot be undone.`)) {
      return;
    }

    setIsLoading(true);
    try {
      const message = {
        type: "clear_all_conversations",
        teaching_mode: currentMode, // Include the current teaching mode
        user_id: user?.id // Include user ID for data isolation
      };
      await publishDataWithRetry(room, message);
    } catch (error) {
      handleError(error, 'conversation', `Error clearing ${modeText} mode conversations`);
    } finally {
      setIsLoading(false);
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
            disabled={isLoading || isCreatingNewConversation}
          >
            <span>+ &nbsp;New Chat</span>
          </Button>
          <Button
            onClick={clearAllConversations}
            variant="ghost"
            size="icon"
            className="h-10 w-10 rounded-full text-danger-DEFAULT hover:text-danger-hover hover:bg-danger-DEFAULT/10 transition-colors duration-200"
            title={`Clear All ${settings.teachingMode === 'teacher' ? 'Teacher' : 'Q&A'} Mode Conversations`}
            disabled={isLoading || conversations.filter(c => (c.teaching_mode || 'teacher') === settings.teachingMode).length === 0}
          >
            <Trash2 size={18} />
          </Button>
        </div>

        {/* Progress bar for loading history - only shows when loading history */}
        <ProgressBar
          isLoading={isLoadingHistory}
          duration={2000}
          className="mt-2"
        />

        {/* Loading indicator text - only shows when loading history */}
        {isLoadingHistory && (
          <div className="mt-1 text-center">
            <p className="text-xs text-text-tertiary">Loading conversation history...</p>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="p-4">
          {/* Mode information banner */}
          <div className="mb-4 p-3 bg-bg-tertiary/20 border border-bg-tertiary/30 rounded-lg text-sm text-text-secondary">
            <div className="flex items-center gap-2">
              {settings.teachingMode === 'qa' ? (
                <HelpCircle className="w-4 h-4 text-primary-DEFAULT" />
              ) : (
                <BookOpen className="w-4 h-4 text-primary-DEFAULT" />
              )}
              <p>
                You are in <span className="font-medium text-primary-DEFAULT">
                  {settings.teachingMode === 'qa' ? 'Q&A' : 'Teacher'}
                </span> mode. Only conversations in this mode are shown.
              </p>
            </div>
          </div>
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
              {/* Filter conversations based on current mode */}
              {conversations
                .filter(conversation => {
                  // Filter out conversations with null IDs
                  if (!conversation.id) return false;
                  // Filter based on teaching mode - be more strict about mode matching
                  // If conversation has no teaching_mode, treat it as 'teacher' mode (default)
                  const conversationMode = conversation.teaching_mode || 'teacher';
                  return conversationMode === settings.teachingMode;
                })
                .map((conversation) => (
                  <ConversationItem
                    key={conversation.id || `temp-${Date.now()}`}
                    conversation={conversation}
                    currentConversationId={currentConversation?.id || null}
                    onSelect={fetchConversation}
                    onEdit={saveTitle}
                    onDelete={deleteConversation}
                  />
                ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
