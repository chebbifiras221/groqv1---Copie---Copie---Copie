import React from 'react';

interface Message {
  id: string;
  text: string;
  conversation_id: string;
}

interface ExplanationToggleButtonProps {
  messages: Message[];
  currentConversationId: string;
  visibleExplanations: Record<string, boolean>;
  setVisibleExplanations: (explanations: Record<string, boolean>) => void;
}

export const ExplanationToggleButton: React.FC<ExplanationToggleButtonProps> = ({
  messages,
  currentConversationId,
  visibleExplanations,
  setVisibleExplanations
}) => {
  const handleToggleAllExplanations = () => {
    // Get all explanation segments from the current messages
    const allSegments: string[] = [];
    messages
      .filter(item => item.conversation_id === currentConversationId)
      .forEach(item => {
        if (item.text) {
          // Extract all explanation blocks
          const explainBlockRegex = /\[\s*EXPLAIN\s*\]([\s\S]*?)\[\s*\/\s*EXPLAIN\s*\]/g;
          let index = 0;
          let match;
          while ((match = explainBlockRegex.exec(item.text)) !== null) {
            allSegments.push(`explain-${item.id}-${index++}`);
          }
        }
      });

    // Check if any explanations are currently visible
    const anyVisible = allSegments.some(id => visibleExplanations[id]);

    // Toggle all explanations based on current state
    const newState = !anyVisible;
    const newVisibleExplanations: Record<string, boolean> = {};
    allSegments.forEach(id => {
      newVisibleExplanations[id] = newState;
    });

    setVisibleExplanations(newVisibleExplanations);
  };

  const hasAnyVisibleExplanations = Object.values(visibleExplanations).some(v => v);

  return (
    <div className="flex justify-end mb-4 px-4">
      <button
        onClick={handleToggleAllExplanations}
        className={`text-xs px-3 py-1.5 rounded-full flex items-center gap-1 transition-colors ${
          hasAnyVisibleExplanations
            ? 'bg-primary-DEFAULT/20 text-primary-DEFAULT hover:bg-primary-DEFAULT/30 border border-primary-DEFAULT/20'
            : 'bg-bg-tertiary/50 text-text-tertiary hover:bg-bg-tertiary/70 border border-bg-tertiary/20'
        }`}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
        </svg>
        <span>{hasAnyVisibleExplanations ? 'Hide All Explanations' : 'Show All Explanations'}</span>
      </button>
    </div>
  );
};
