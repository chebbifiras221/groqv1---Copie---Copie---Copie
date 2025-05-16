"use client";

import React from 'react';
import { CodeBlock } from './code-block';
import { decodeHtmlEntities } from '@/utils/html-entities';
import { parseMarkdownTable } from '@/utils/markdown-formatter';

interface ContentSegmentProps {
  type: 'regular' | 'code' | 'explain' | 'code-section';
  content: string;
  id: string;
  language?: string;
  isVisible?: boolean;
  onToggleVisibility?: (id: string) => void;
}

export const ContentSegment: React.FC<ContentSegmentProps> = ({
  type,
  content,
  id,
  language = 'javascript',
  isVisible = false,
  onToggleVisibility
}) => {
  // Helper function to format regular content
  const formatRegularContent = (text: string) => {
    if (!text) return null;

    // Split the text by lines to process headers and lists
    const lines = text.split('\n');

    // Process the lines with special handling for tables
    const renderedElements = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Check for tables
      if (line.trim().startsWith('|')) {
        const { table, endIndex } = parseMarkdownTable(lines, i);
        if (table) {
          renderedElements.push(
            <div key={`table-${i}`} dangerouslySetInnerHTML={{ __html: table }} />
          );
          i = endIndex; // Skip the lines that were part of the table
          continue;
        }
      }

      // Process the line based on its content
      if (line.startsWith('# ')) {
        // Process title
        const title = decodeHtmlEntities(line.substring(2));
        renderedElements.push(
          <div key={`heading-${i}`} className="mt-8 mb-6">
            <h1 className="text-2xl md:text-3xl font-bold text-primary-DEFAULT pb-2 border-b border-primary-DEFAULT/20">
              {title}
            </h1>
          </div>
        );
      }
      // Process headings
      else if (line.startsWith('## ')) {
        // Decode HTML entities in the heading
        const heading = decodeHtmlEntities(line.substring(3));
        renderedElements.push(
          <div key={`heading2-${i}`} className="mt-6 mb-4">
            <h2 className="text-xl md:text-2xl font-bold text-text-primary">
              {heading}
            </h2>
            <div className="h-1 w-16 bg-primary-DEFAULT/50 rounded mt-2"></div>
          </div>
        );
      }
      // Process subheadings
      else if (line.startsWith('### ')) {
        // Decode HTML entities in the section title
        const sectionTitle = decodeHtmlEntities(line.substring(4));
        renderedElements.push(
          <div key={`section-${i}`} className="mt-6 mb-4 group">
            <h3 className="text-lg md:text-xl font-semibold text-text-primary bg-bg-tertiary/20 px-3 py-2 rounded-md border-l-2 border-primary-DEFAULT/50">
              {sectionTitle}
            </h3>
          </div>
        );
      }
      // Process lists
      else if (line.match(/^\s*[\-\*]\s/)) {
        // First decode HTML entities in the entire line
        const decodedLine = decodeHtmlEntities(line);
        const content = decodedLine.replace(/^\s*[\-\*]\s/, '');

        // Process any inline formatting in the content
        const formattedContent = content
          // Bold text
          .replace(/\*\*([^*]+)\*\*/g, (_, text) => {
            // Decode HTML entities in the text
            const decodedText = decodeHtmlEntities(text);
            return `<strong class="font-bold text-text-primary">${decodedText}</strong>`;
          })
          // Italic text
          .replace(/\*([^*]+)\*/g, (_, text) => {
            // Decode HTML entities in the text
            const decodedText = decodeHtmlEntities(text);
            return `<em class="text-primary-DEFAULT/90 font-medium not-italic">${decodedText}</em>`;
          })
          // Inline code
          .replace(/`([^`]+)`/g, (_, text) => {
            // Decode HTML entities in the text
            const decodedText = decodeHtmlEntities(text);
            return `<code class="px-1 py-0.5 bg-bg-tertiary rounded text-sm font-mono">${decodedText}</code>`;
          });

        renderedElements.push(
          <div key={`list-${i}`} className="my-2 flex items-start">
            <span className="text-primary-DEFAULT mr-2">•</span>
            <div className="flex-1" dangerouslySetInnerHTML={{ __html: formattedContent }} />
          </div>
        );
      }
      // Process regular paragraphs
      else if (line.trim() !== '') {
        // First decode HTML entities in the entire line
        const decodedLine = decodeHtmlEntities(line);

        // Process inline formatting (bold, italic, code)
        const formattedLine = decodedLine
          // Bold text
          .replace(/\*\*([^*]+)\*\*/g, (_, text) => {
            // Decode HTML entities in the text
            const decodedText = decodeHtmlEntities(text);
            return `<strong class="font-bold text-text-primary">${decodedText}</strong>`;
          })
          // Italic text
          .replace(/\*([^*]+)\*/g, (_, text) => {
            // Decode HTML entities in the text
            const decodedText = decodeHtmlEntities(text);
            return `<em class="text-primary-DEFAULT/90 font-medium not-italic">${decodedText}</em>`;
          })
          // Inline code
          .replace(/`([^`]+)`/g, (_, text) => {
            // Decode HTML entities in the text
            const decodedText = decodeHtmlEntities(text);
            return `<code class="px-1 py-0.5 bg-bg-tertiary rounded text-sm font-mono">${decodedText}</code>`;
          });

        renderedElements.push(
          <p key={`para-${i}`} className="my-3 leading-relaxed" dangerouslySetInnerHTML={{ __html: formattedLine }} />
        );
      }
      // Empty lines
      else {
        renderedElements.push(<div key={`empty-${i}`} className="h-2"></div>);
      }
    }

    // Wrap the rendered elements in a div with a unique key
    return <div key="regular-content-wrapper">{renderedElements}</div>;
  };

  // Render based on segment type
  if (type === 'code') {
    // Decode HTML entities in the code content
    let decodedCode = content;
    for (let i = 0; i < 3; i++) {
      decodedCode = decodeHtmlEntities(decodedCode);
    }

    return (
      <CodeBlock
        key={id}
        code={decodedCode}
        language={language}
      />
    );
  } else if (type === 'explain') {
    // If explanation is hidden, render a button to show just this explanation
    if (!isVisible) {
      return (
        <div key={id} className="my-2">
          <button
            onClick={() => onToggleVisibility && onToggleVisibility(id)}
            className="text-xs bg-primary-DEFAULT/10 text-primary-DEFAULT px-3 py-1.5 rounded-full hover:bg-primary-DEFAULT/20 border border-primary-DEFAULT/20 shadow-none flex items-center gap-1"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"></path>
            </svg>
            <span>Show Explanation</span>
          </button>
        </div>
      );
    }

    // If this explanation is visible, render the explanation block
    return (
      <div key={id} className="verbal-content p-4 my-4 bg-bg-secondary border border-dashed border-text-tertiary/30 rounded-md shadow-sm">
        <div className="flex items-center justify-end mb-2">
          <button
            onClick={() => onToggleVisibility && onToggleVisibility(id)}
            className="text-xs text-text-tertiary hover:text-text-secondary"
            title="Hide this explanation"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        </div>
        {formatRegularContent(content)}
      </div>
    );
  } else if (type === 'code-section') {
    // Extract code blocks from the content
    const codeBlockMatches = content.match(/```([\w-]*)\n([\s\S]*?)```/g);

    if (codeBlockMatches && codeBlockMatches.length > 0) {
      // Process each code block
      return (
        <div key={id} className="my-4">
          {codeBlockMatches.map((codeBlock, index) => {
            // Extract language and code content
            const match = codeBlock.match(/```([\w-]*)\n([\s\S]*?)```/);
            if (match) {
              const language = match[1] || 'text';
              let code = match[2];
              
              // Decode HTML entities
              for (let i = 0; i < 3; i++) {
                code = decodeHtmlEntities(code);
              }

              // Only render the code block if it has content
              if (code && code.trim() !== '') {
                return (
                  <CodeBlock
                    key={`${id}-code-${index}`}
                    code={code}
                    language={language}
                  />
                );
              }
            }
            return null;
          })}

          {/* Render any text that's not a code block */}
          {content.replace(/```([\w-]*)\n([\s\S]*?)```/g, '').trim() && (
            <div className="mt-2">
              {formatRegularContent(content.replace(/```([\w-]*)\n([\s\S]*?)```/g, '').trim())}
            </div>
          )}
        </div>
      );
    } else {
      // If no code blocks found or all are empty, check if there's any content to render
      const cleanContent = content.replace(/```([\w-]*)\n([\s\S]*?)```/g, '').trim();
      if (cleanContent) {
        return (
          <div key={id} className="my-4">
            {formatRegularContent(cleanContent)}
          </div>
        );
      }
      // If there's no content at all, don't render anything
      return null;
    }
  } else {
    // Regular content
    return <div key={id}>{formatRegularContent(content)}</div>;
  }
};
