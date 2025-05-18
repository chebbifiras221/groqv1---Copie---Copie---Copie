"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "./ui/button";
import { Edit, Trash2, Check, X, Clock, BookOpen, HelpCircle } from "lucide-react";
import { formatDate } from "@/utils/conversation-utils";

interface ConversationItemProps {
  conversation: any;
  currentConversationId: string | null;
  onSelect: (id: string) => void;
  onEdit: (id: string, title: string) => void;
  onDelete: (id: string) => void;
}

export function ConversationItem({
  conversation,
  currentConversationId,
  onSelect,
  onEdit,
  onDelete
}: ConversationItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(conversation.title);

  const startEditing = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(true);
    setEditTitle(conversation.title);
  };

  const cancelEditing = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(false);
    setEditTitle(conversation.title);
  };

  const saveTitle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (editTitle.trim()) {
      onEdit(conversation.id, editTitle);
      setIsEditing(false);
    }
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete(conversation.id);
  };

  // Get the last message for preview
  const getLastMessage = () => {
    // If we have the full conversation data
    if (conversation.messages && conversation.messages.length > 0) {
      const lastMessage = conversation.messages[conversation.messages.length - 1];
      return {
        type: lastMessage.type,
        content: lastMessage.content
      };
    }
    
    // If we have a last_message property
    if (conversation.last_message) {
      return conversation.last_message;
    }
    
    return null;
  };

  const lastMessage = getLastMessage();

  return (
    <motion.div
      className={`p-3 rounded-lg mb-2 shadow-sm border group cursor-pointer transition-all duration-200 ${
        currentConversationId === conversation.id
          ? "bg-bg-tertiary/30 border-primary-DEFAULT/30"
          : "hover:bg-bg-tertiary/10 border-bg-tertiary/30 hover:shadow-md hover:-translate-y-0.5"
      }`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      style={{ willChange: "opacity, transform" }}
      onClick={() => conversation.id && onSelect(conversation.id)}
    >
      {isEditing ? (
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
              onClick={cancelEditing}
              variant="ghost"
              size="icon"
              className="h-7 w-7"
            >
              <X size={14} />
            </Button>
            <Button
              onClick={saveTitle}
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
            <div className="flex items-center gap-1.5">
              {/* Mode indicator icon */}
              {conversation.teaching_mode === 'qa' ? (
                <HelpCircle className="w-3.5 h-3.5 text-primary-DEFAULT flex-shrink-0" />
              ) : (
                <BookOpen className="w-3.5 h-3.5 text-primary-DEFAULT flex-shrink-0" />
              )}
              <h3 className="font-medium text-text-primary break-words pr-2 text-sm">
                {conversation.title}
              </h3>
            </div>
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button
                onClick={startEditing}
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-text-tertiary hover:text-text-primary hover:bg-bg-tertiary/50 rounded-full"
              >
                <Edit size={12} />
              </Button>
              <Button
                onClick={handleDelete}
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
          {lastMessage && (
            <div className="text-xs text-text-secondary bg-bg-tertiary/20 p-2.5 rounded-md border border-bg-tertiary/30 shadow-sm">
              <span className="font-medium text-primary-DEFAULT">
                {lastMessage.type === 'user' ? 'You: ' : 'AI: '}
              </span>
              <span className="line-clamp-2">
                {lastMessage.content.substring(0, 100)}
                {lastMessage.content.length > 100 ? '...' : ''}
              </span>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}
