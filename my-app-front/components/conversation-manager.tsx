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
  const [modeWarning, setModeWarning] = useState<string | null>(null); // Warning message for mode mismatch
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
      console.log('Successfully requested conversation list');

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
        console.log("History loading complete");
      }, 500);
    }
  };

  /**
   * Function to fetch a specific conversation by ID
   */
  const fetchConversation = async (conversationId: string) => {
    if (!room) return;

    // Clear any previous mode warning
    setModeWarning(null);

    // Find the conversation in our list to check its teaching mode
    const conversation = conversations.find(c => c.id === conversationId);

    // Check if the conversation's teaching mode matches the current mode
    if (conversation && conversation.teaching_mode) {
      const currentMode = settings.teachingMode;

      // If the modes don't match, show a warning and don't switch
      if (conversation.teaching_mode !== currentMode) {
        console.log(`Mode mismatch: Conversation is in ${conversation.teaching_mode} mode, but current mode is ${currentMode}`);

        // Set a warning message
        setModeWarning(
          `This conversation is in ${conversation.teaching_mode === 'teacher' ? 'Teacher' : 'Q&A'} mode. ` +
          `Please switch to ${conversation.teaching_mode === 'teacher' ? 'Teacher' : 'Q&A'} mode to access it.`
        );

        // Don't proceed with loading the conversation
        return;
      }
    }

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
      console.log(`Successfully requested conversation: ${conversationId}`);

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
   * Prevents creating multiple empty conversations
   */
  const createNewConversation = async () => {
    if (!room) return;

    // Prevent creating multiple empty conversations
    if (isCreatingNewConversation) {
      console.log("Already creating a new conversation, ignoring request");
      return;
    }

    // Check if we already have an empty conversation in the list
    const hasEmptyConversation = conversations.some(conv =>
      isConversationEmpty(currentConversation && currentConversation.id === conv.id
        ? currentConversation
        : conv)
    );

    if (hasEmptyConversation) {
      console.log("An empty conversation already exists, not creating a new one");

      // Find the empty conversation and switch to it instead of creating a new one
      const emptyConversation = conversations.find(conv =>
        isConversationEmpty(currentConversation && currentConversation.id === conv.id
          ? currentConversation
          : conv)
      );

      if (emptyConversation && (!currentConversation || currentConversation.id !== emptyConversation.id)) {
        console.log("Switching to existing empty conversation:", emptyConversation.id);
        fetchConversation(emptyConversation.id);
      }

      return;
    }

    // Check if current conversation is empty and we're trying to create another one
    if (currentConversation && isConversationEmpty(currentConversation)) {
      console.log("Current conversation is empty (no user messages), not creating a new one");
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

      console.log("Creating new conversation...");

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
      console.log("Initial connection detected, IMMEDIATELY loading conversations");

      // Mark initial load as done to prevent this from running again
      setInitialLoadDone(true);

      // Store in localStorage that we've done the initial load
      localStorage.setItem('initial-load-done', 'true');

      // Set loading state for the progress bar
      setIsLoadingHistory(true);

      // IMMEDIATELY request the conversation list from the server
      // This will populate the sidebar without waiting
      // Always include user ID for data isolation
      const message = {
        type: "list_conversations",
        user_id: user?.id
      };

      // Send the request directly
      try {
        console.log("Directly requesting conversation list");
        room.localParticipant.publishData(
          new TextEncoder().encode(JSON.stringify(message))
        );
      } catch (error) {
        console.error("Error requesting conversation list:", error);
      }

      // Also start a more robust loading process with retries as a backup
      const loadConversationsWithRetry = async (retryCount = 0) => {
        try {
          console.log(`Attempting to load conversation history (attempt ${retryCount + 1})`);

          // Wait for the conversations to be fetched
          await fetchConversations();

          // Check if we already have conversations
          if (conversations.length > 0) {
            console.log("Conversations loaded, checking for empty conversations");

            // Check if there's already an empty conversation
            const emptyConversation = conversations.find(conv =>
              !conv.message_count || conv.message_count === 0
            );

            if (emptyConversation) {
              console.log("Found existing empty conversation, loading it:", emptyConversation.id);
              // Load the empty conversation instead of creating a new one
              localStorage.setItem('current-conversation-id', emptyConversation.id);
              fetchConversation(emptyConversation.id);
              return;
            }

            // If there's a current conversation ID in localStorage, try to load it
            const currentId = localStorage.getItem('current-conversation-id');
            if (currentId) {
              const conversationExists = conversations.some(c => c.id === currentId);
              if (conversationExists) {
                console.log("Loading existing conversation from localStorage:", currentId);
                fetchConversation(currentId);
                return;
              }
            }
          }



          // Only create a new conversation if we don't have any or don't have an empty one
          console.log("No empty conversations found, creating a new one");

          // Clear any existing conversation ID from localStorage
          localStorage.removeItem('current-conversation-id');

          // Create a new conversation by default
          // This ensures we're in a new conversation when connecting
          createNewConversation();

        } catch (error) {
          console.error("Error loading conversations:", error);
          if (retryCount < 3) {
            // Retry with exponential backoff
            const delay = 1000 * Math.pow(2, retryCount);
            console.log(`Retrying in ${delay}ms...`);
            setTimeout(() => loadConversationsWithRetry(retryCount + 1), delay);
          } else {
            // After several retries, just create a new conversation
            console.log("Failed to load conversations after retries, creating a new conversation");
            localStorage.removeItem('current-conversation-id');
            createNewConversation();
          }
        }
      };

      // Start the loading process after a short delay
      // This gives the direct request a chance to complete first
      setTimeout(() => loadConversationsWithRetry(), 500);
    }
  }, [isConnected, room, initialLoadDone, conversations]);

  // Check localStorage on component mount to see if we've already done the initial load
  useEffect(() => {
    const hasInitialLoadBeenDone = localStorage.getItem('initial-load-done') === 'true';
    if (hasInitialLoadBeenDone) {
      setInitialLoadDone(true);
    }
  }, []);

  // Listen for the custom event to create a new conversation when switching modes
  useEffect(() => {
    if (!room) return;

    const handleCreateNewConversationForModeSwitch = (event: Event) => {
      const customEvent = event as CustomEvent;
      const teachingMode = customEvent.detail?.teachingMode;

      console.log(`Creating new conversation for mode switch to: ${teachingMode}`);

      // Clear the current conversation ID in localStorage
      localStorage.removeItem('current-conversation-id');

      // Clear the current conversation in state
      setCurrentConversation(null);

      // Clear any existing conversations from the UI that don't match the new mode
      setConversations(prev =>
        prev.filter(conv => conv.teaching_mode === teachingMode)
      );

      // Create a message to request a new conversation with the specified teaching mode
      // Always include user ID for data isolation
      const message = {
        type: "new_conversation",
        title: "New Conversation",
        teaching_mode: teachingMode,
        user_id: user?.id
      };

      // Set the creating flag to prevent duplicate creations
      setIsCreatingNewConversation(true);

      // Send the request to create a new conversation
      room.localParticipant.publishData(
        new TextEncoder().encode(JSON.stringify(message))
      ).catch(error => {
        console.error("Error creating new conversation for mode switch:", error);
      }).finally(() => {
        // Reset the creating flag after a short delay
        setTimeout(() => {
          setIsCreatingNewConversation(false);
        }, 1000);
      });

      // Also refresh the conversation list to ensure we have the latest data
      fetchConversations().catch(err =>
        console.error("Error refreshing conversation list after mode switch:", err)
      );
    };

    window.addEventListener('create-new-conversation-for-mode-switch', handleCreateNewConversationForModeSwitch);

    return () => {
      window.removeEventListener('create-new-conversation-for-mode-switch', handleCreateNewConversationForModeSwitch);
    };
  }, [room]);

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
          console.log(`Received conversation list with ${data.conversations.length} conversations`);

          // Sort conversations by updated_at (most recent first)
          const sortedConversations = [...data.conversations].sort(
            (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
          );

          // Update the conversations list in state with sorted conversations
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
          if (sortedConversations.length > 0) {
            if (currentId) {
              // Check if the requested conversation exists
              const conversationExists = sortedConversations.some((c: Conversation) => c.id === currentId);

              if (conversationExists) {
                console.log(`Loading existing conversation: ${currentId}`);
                // If the current conversation exists but isn't loaded, load it
                if (!currentConversation || currentConversation.id !== currentId) {
                  // Load the conversation from localStorage
                  fetchConversation(currentId);
                }
              } else {
                console.log(`Conversation ${currentId} not found in history`);
                // The conversation ID in localStorage doesn't exist
                // This could happen if conversations were deleted on another device
                // We'll let the createNewConversation flow handle this case
              }
            } else if (!initialLoadDone) {
              // If we're in the initial loading phase and don't have a current ID,
              // we'll create a new conversation after a short delay
              // This ensures the history is loaded and visible first
              console.log("Conversation list loaded, will create new conversation shortly");

              // We don't need to do anything here - the useEffect will handle creating a new conversation
            }
          }
        } else if (data.type === "conversation_data") {
          // Update the current conversation in state
          setCurrentConversation(data.conversation);

          // Make sure localStorage is updated with the current conversation ID
          localStorage.setItem('current-conversation-id', data.conversation.id);
        } else if (data.type === "new_conversation_created") {
          // Handle new conversation creation
          console.log("New conversation created with ID:", data.conversation_id);

          // Check if we already have an empty conversation in the list
          const hasEmptyConversation = conversations.some(conv => {
            // Skip the newly created conversation
            if (conv.id === data.conversation_id) return false;

            // If we have the full conversation data in currentConversation
            if (currentConversation && currentConversation.id === conv.id) {
              // Check if it has no user messages or meaningful AI messages
              const hasUserMessages = currentConversation.messages?.some(
                msg => msg.type === 'user' || (msg.type === 'ai' && msg.content.trim().length > 0)
              );
              return !hasUserMessages;
            }

            // If we don't have full data, check if it has any messages at all
            return !conv.message_count || conv.message_count === 0;
          });

          if (hasEmptyConversation && !isCreatingNewConversation) {
            console.log("Ignoring new conversation creation as we already have an empty one");
            // Don't update localStorage or load the new conversation
            // This prevents having multiple empty conversations

            // Reset the creating flag
            setIsCreatingNewConversation(false);

            // Refresh the conversation list to include the new conversation
            // but don't switch to it
            fetchConversations();

            return;
          }

          // Update localStorage with the new conversation ID
          localStorage.setItem('current-conversation-id', data.conversation_id);

          // Reset the creating flag
          setIsCreatingNewConversation(false);

          // Refresh the conversation list first to include the new conversation
          // This ensures the sidebar is up-to-date
          fetchConversations().then(() => {
            // Then load the new conversation
            console.log("Loading newly created conversation");
            fetchConversation(data.conversation_id);
          });
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

            // If a new conversation was created, load it after a short delay
            // This ensures state updates are processed in the correct order
            if (data.new_conversation_id && data.new_conversation_id !== data.conversation_id) {
              setTimeout(() => {
                fetchConversation(data.new_conversation_id);
              }, 100);
            }
          }

          // Refresh the conversation list
          fetchConversations().catch(err =>
            console.error("Error refreshing conversation list:", err)
          );
        } else if (data.type === "all_conversations_cleared") {
          const currentMode = settings.teachingMode;
          const responseMode = data.teaching_mode;

          // Only update UI if the response matches our current mode
          if (responseMode === currentMode) {
            console.log(`Cleared ${data.deleted_count} conversations in ${responseMode} mode`);

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
              console.log(`Stored new conversation ID after clearing: ${data.new_conversation_id}`);

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
            console.log(`Received clear confirmation for ${responseMode} mode, but we're in ${currentMode} mode. Ignoring.`);
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
  }, [room, currentConversation]);



  const saveTitle = async (conversationId: string, newTitle: string) => {
    if (!room || !newTitle.trim()) return;

    setIsLoading(true);
    try {
      const message = {
        type: "rename_conversation",
        conversation_id: conversationId,
        title: newTitle.trim()
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
            disabled={isLoading || conversations.filter(c => !c.teaching_mode || c.teaching_mode === settings.teachingMode).length === 0}
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

          {/* Warning message for mode mismatch */}
          {modeWarning && (
            <div className="mb-4 p-3 bg-warning-light border border-warning-DEFAULT rounded-lg text-sm text-warning-dark">
              <p>{modeWarning}</p>
            </div>
          )}

          {conversations.length > 0 && (
            <div className="space-y-1.5">
              {/* Filter conversations based on current mode */}
              {conversations
                .filter(conversation => {
                  // Filter out conversations with null IDs
                  if (!conversation.id) return false;
                  // Filter based on teaching mode
                  return !conversation.teaching_mode || conversation.teaching_mode === settings.teachingMode;
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
