import { InternalDocSearchHit } from '@docsearch/react';
import { DEFAULT_CONFIG } from '../config/defaults';
import { getLogger } from './logger';

/**
 * Default response guidelines for markdown formatting
 */
export const DEFAULT_RESPONSE_GUIDELINES = `FORMAT YOUR RESPONSE AS MARKDOWN:
- Use ## and ### for section headings (not #)
- For code blocks use triple backticks with language specification
- Always specify the language for code blocks (javascript, jsx, typescript, bash, etc.)
- Use standard markdown for links: [text](url)
- NEVER use HTML tags - use only pure markdown syntax
- Preserve code examples exactly as they appear in documentation`;

/**
 * Creates the system prompt for the AI
 */
export function createSystemPrompt(siteName?: string): string {
  const site = siteName || DEFAULT_CONFIG.prompts.siteName;
  return `You are a helpful AI assistant specialized in answering questions about ${site}. 
Your responses should be based solely on the documentation content provided to you.

Guidelines:
- Be concise but comprehensive
- Use markdown formatting for better readability
- Include code examples when relevant
- Cite specific sections or pages when possible
- If information is not available in the provided context, say so clearly

Remember: Only answer based on the provided documentation context. Do not make up information.`;
}

/**
 * Creates the user prompt with document context
 */
export function createUserPrompt(
  query: string, 
  documentContents: string[], 
  searchResults: InternalDocSearchHit[]
): string {
  const logger = getLogger();
  logger.log(`Creating user prompt for query: "${query}"`);
  
  // Build context from documents
  let context = "Here is the relevant documentation content:\n\n";
  
  documentContents.forEach((content, index) => {
    context += `--- Document ${index + 1} ---\n`;
    context += content;
    context += "\n\n";
  });
  
  // Add search result URLs for reference
  if (searchResults.length > 0) {
    context += "Reference URLs:\n";
    searchResults.slice(0, documentContents.length).forEach((result, index) => {
      const title = result.hierarchy?.lvl1 || result.hierarchy?.lvl0 || `Document ${index + 1}`;
      context += `- ${title}: ${result.url}\n`;
    });
  }
  
  return `${context}\n\nBased on the documentation above, please answer the following question:\n\n"${query}"`;
} 