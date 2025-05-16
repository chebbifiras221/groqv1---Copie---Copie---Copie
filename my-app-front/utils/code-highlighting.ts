import { decodeHtmlEntities } from "./html-entities";

/**
 * Detects the language from code if not provided
 */
export const detectLanguage = (code: string, defaultLanguage: string = 'javascript'): string => {
  if (code.includes('import React') || code.includes('export default') || code.includes('const [')) {
    return 'jsx';
  }
  if (code.includes('function') || code.includes('const ') || code.includes('let ')) {
    return 'javascript';
  }
  if (code.includes('import ') && code.includes('from ')) {
    return 'typescript';
  }
  if (code.includes('<html>') || code.includes('<div>')) {
    return 'html';
  }
  if (code.includes('.class') || code.includes('#id') || code.includes('@media')) {
    return 'css';
  }
  if (code.includes('def ') || code.includes('import ') && !code.includes('from ')) {
    return 'python';
  }
  return defaultLanguage;
};

/**
 * Gets language-specific colors for syntax highlighting
 */
export const getLanguageColors = (lang: string) => {
  const colors = {
    javascript: { primary: '#f7df1e', secondary: '#323330', text: '#323330' },
    typescript: { primary: '#3178c6', secondary: '#235a97', text: '#ffffff' },
    python: { primary: '#3776ab', secondary: '#ffd343', text: '#ffffff' },
    html: { primary: '#e34c26', secondary: '#f06529', text: '#ffffff' },
    css: { primary: '#264de4', secondary: '#2965f1', text: '#ffffff' },
    jsx: { primary: '#61dafb', secondary: '#282c34', text: '#ffffff' },
    tsx: { primary: '#3178c6', secondary: '#61dafb', text: '#ffffff' },
    json: { primary: '#000000', secondary: '#8bc34a', text: '#ffffff' },
    default: { primary: '#6e40c9', secondary: '#5a32a3', text: '#ffffff' }
  };

  return colors[lang as keyof typeof colors] || colors.default;
};

/**
 * Token type for syntax highlighting
 */
export type Token = {
  text: string;
  type: string;
};

/**
 * Tokenizes JavaScript/TypeScript code for syntax highlighting
 */
export const tokenizeJavaScript = (code: string): Token[] => {
  const tokens: Token[] = [];
  const patterns = [
    { type: 'keyword', regex: /\b(const|let|var|function|return|if|else|for|while|class|import|export|from|default|async|await)\b/g },
    { type: 'boolean', regex: /\b(true|false|null|undefined)\b/g },
    { type: 'string', regex: /(".*?"|'.*?'|`.*?`)/g },
    { type: 'number', regex: /\b(\d+)\b/g },
    { type: 'comment', regex: /(\/\/.*|\/\*[\s\S]*?\*\/)/g }
  ];

  let remainingCode = code;

  while (remainingCode.length > 0) {
    let earliestMatch = { index: Infinity, length: 0, type: '' };

    // Find the earliest match among all patterns
    for (const pattern of patterns) {
      pattern.regex.lastIndex = 0;
      const match = pattern.regex.exec(remainingCode);
      if (match && match.index < earliestMatch.index) {
        earliestMatch = {
          index: match.index,
          length: match[0].length,
          type: pattern.type
        };
      }
    }

    if (earliestMatch.index < Infinity) {
      // Add any text before the match as plain text
      if (earliestMatch.index > 0) {
        tokens.push({
          text: remainingCode.substring(0, earliestMatch.index),
          type: 'plain'
        });
      }

      // Add the matched token
      tokens.push({
        text: remainingCode.substring(earliestMatch.index, earliestMatch.index + earliestMatch.length),
        type: earliestMatch.type
      });

      // Update the remaining code
      remainingCode = remainingCode.substring(earliestMatch.index + earliestMatch.length);
    } else {
      // No more matches, add the rest as plain text
      tokens.push({ text: remainingCode, type: 'plain' });
      break;
    }
  }

  return tokens;
};

/**
 * Tokenizes Python code for syntax highlighting
 */
export const tokenizePython = (code: string): Token[] => {
  const tokens: Token[] = [];
  const patterns = [
    { type: 'keyword', regex: /\b(def|class|import|from|return|if|elif|else|for|while|try|except|finally|with|as|lambda|None|True|False)\b/g },
    { type: 'string', regex: /(".*?"|'.*?'|"""[\s\S]*?"""|'''[\s\S]*?''')/g },
    { type: 'number', regex: /\b(\d+)\b/g },
    { type: 'comment', regex: /(#.*)/g }
  ];

  let remainingCode = code;

  while (remainingCode.length > 0) {
    let earliestMatch = { index: Infinity, length: 0, type: '' };

    // Find the earliest match among all patterns
    for (const pattern of patterns) {
      pattern.regex.lastIndex = 0;
      const match = pattern.regex.exec(remainingCode);
      if (match && match.index < earliestMatch.index) {
        earliestMatch = {
          index: match.index,
          length: match[0].length,
          type: pattern.type
        };
      }
    }

    if (earliestMatch.index < Infinity) {
      // Add any text before the match as plain text
      if (earliestMatch.index > 0) {
        tokens.push({
          text: remainingCode.substring(0, earliestMatch.index),
          type: 'plain'
        });
      }

      // Add the matched token
      tokens.push({
        text: remainingCode.substring(earliestMatch.index, earliestMatch.index + earliestMatch.length),
        type: earliestMatch.type
      });

      // Update the remaining code
      remainingCode = remainingCode.substring(earliestMatch.index + earliestMatch.length);
    } else {
      // No more matches, add the rest as plain text
      tokens.push({ text: remainingCode, type: 'plain' });
      break;
    }
  }

  return tokens;
};

/**
 * Tokenizes HTML code for syntax highlighting
 */
export const tokenizeHTML = (code: string): Token[] => {
  const tokens: Token[] = [];
  const patterns = [
    { type: 'keyword', regex: /(&lt;[\/]?[a-zA-Z0-9]+(&gt;)?)/g },
    { type: 'string', regex: /("[^"]*")/g },
    { type: 'comment', regex: /(&lt;!--[\s\S]*?--&gt;)/g }
  ];

  let remainingCode = code;

  while (remainingCode.length > 0) {
    let earliestMatch = { index: Infinity, length: 0, type: '' };

    // Find the earliest match among all patterns
    for (const pattern of patterns) {
      pattern.regex.lastIndex = 0;
      const match = pattern.regex.exec(remainingCode);
      if (match && match.index < earliestMatch.index) {
        earliestMatch = {
          index: match.index,
          length: match[0].length,
          type: pattern.type
        };
      }
    }

    if (earliestMatch.index < Infinity) {
      // Add any text before the match as plain text
      if (earliestMatch.index > 0) {
        tokens.push({
          text: remainingCode.substring(0, earliestMatch.index),
          type: 'plain'
        });
      }

      // Add the matched token
      tokens.push({
        text: remainingCode.substring(earliestMatch.index, earliestMatch.index + earliestMatch.length),
        type: earliestMatch.type
      });

      // Update the remaining code
      remainingCode = remainingCode.substring(earliestMatch.index + earliestMatch.length);
    } else {
      // No more matches, add the rest as plain text
      tokens.push({ text: remainingCode, type: 'plain' });
      break;
    }
  }

  return tokens;
};

/**
 * Tokenizes CSS code for syntax highlighting
 */
export const tokenizeCSS = (code: string): Token[] => {
  const tokens: Token[] = [];
  const patterns = [
    { type: 'comment', regex: /(\/\*[\s\S]*?\*\/)/g },
    { type: 'selector', regex: /([.#][a-zA-Z0-9_-]+)/g },
    { type: 'bracket', regex: /(\{|\})/g },
    { type: 'property', regex: /([a-zA-Z-]+)(?=\s*:)/g },
    { type: 'colon', regex: /(:)/g },
    { type: 'semicolon', regex: /(;)/g },
  ];

  let remainingCode = code;
  let lastTokenType = '';

  while (remainingCode.length > 0) {
    let earliestMatch = { index: Infinity, length: 0, type: '' };

    // Find the earliest match among all patterns
    for (const pattern of patterns) {
      pattern.regex.lastIndex = 0;
      const match = pattern.regex.exec(remainingCode);
      if (match && match.index < earliestMatch.index) {
        earliestMatch = {
          index: match.index,
          length: match[0].length,
          type: pattern.type
        };
      }
    }

    if (earliestMatch.index < Infinity) {
      // Add any text before the match as plain text or as a value if after a colon
      if (earliestMatch.index > 0) {
        const textBefore = remainingCode.substring(0, earliestMatch.index);

        // If the last token was a colon and the next token is a semicolon,
        // then this text is a CSS value
        if (lastTokenType === 'colon' && earliestMatch.type === 'semicolon') {
          tokens.push({ text: textBefore, type: 'value' });
        } else {
          tokens.push({ text: textBefore, type: 'plain' });
        }
      }

      // Add the matched token
      tokens.push({
        text: remainingCode.substring(earliestMatch.index, earliestMatch.index + earliestMatch.length),
        type: earliestMatch.type
      });

      // Remember the type of this token for context
      lastTokenType = earliestMatch.type;

      // Update the remaining code
      remainingCode = remainingCode.substring(earliestMatch.index + earliestMatch.length);
    } else {
      // No more matches, add the rest as plain text
      tokens.push({ text: remainingCode, type: 'plain' });
      break;
    }
  }

  return tokens;
};

/**
 * Tokenizes code based on language
 */
export const tokenizeCode = (code: string, language: string): Token[] => {
  // First decode HTML entities in the code
  let decodedCode = code;
  for (let i = 0; i < 3; i++) {
    decodedCode = decodeHtmlEntities(decodedCode);
  }

  // Tokenize based on language
  if (['javascript', 'typescript', 'jsx', 'tsx'].includes(language)) {
    return tokenizeJavaScript(decodedCode);
  } else if (language === 'python') {
    return tokenizePython(decodedCode);
  } else if (language === 'html') {
    return tokenizeHTML(decodedCode);
  } else if (language === 'css') {
    return tokenizeCSS(decodedCode);
  } else {
    // For any other language, just add the entire code as plain text
    return [{ text: decodedCode, type: 'plain' }];
  }
};
