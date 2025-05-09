import { InternalDocSearchHit } from '@docsearch/react';
import { DocumentContent, RankedSearchResult } from './types';

/**
 * Tracks AI queries for analytics purposes
 */
export function trackAIQuery(query: string, success: boolean = true): void {
  console.log(`[AI Search] Query: "${query}" (${success ? "success" : "failed"})`);

  try {
    if (typeof window !== "undefined" && (window as any).gtag) {
      (window as any).gtag("event", "ai_search", {
        event_category: "search",
        event_label: query,
        value: success ? 1 : 0,
      });
    }
  } catch (e) {
    console.warn("Failed to track AI query:", e);
  }
}

/**
 * Fetches the content of a document from its URL
 */
export async function fetchDocumentContent(url: string): Promise<string> {
  try {
    // Convert absolute URL to relative path if it's from the same origin
    let path = url;

    if (typeof window !== "undefined") {
      const urlObj = new URL(url, window.location.origin);

      if (urlObj.origin === window.location.origin) {
        path = urlObj.pathname;

        // Handle typical Docusaurus routes
        if (path.endsWith("/")) {
          path = `${path}index.html`;
        } else if (!path.includes(".")) {
          path = `${path}/index.html`;
        }
      } else {
        return "";
      }
    }

    const response = await fetch(path);
    if (!response.ok) return "";

    const html = await response.text();
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = html;

    // Find the main content area
    const mainContent =
      tempDiv.querySelector(".markdown") ||
      tempDiv.querySelector("article") ||
      tempDiv.querySelector("main") ||
      tempDiv.querySelector(".container") ||
      tempDiv.querySelector('div[class*="docItemContainer"]') ||
      tempDiv.querySelector('div[class*="docMainContainer"]');

    if (mainContent) {
      // Remove non-content elements
      mainContent.querySelectorAll(
        "script, style, nav, .navbar, .sidebar, .pagination, .tocCollapsible, .tableOfContents"
      ).forEach(node => node.remove());

      // Extract code blocks
      const codeBlocks: string[] = [];
      mainContent.querySelectorAll(
        'pre code, .codeBlock, .prism-code, code[class*="language-"], div[class*="codeBlockContainer"]'
      ).forEach(codeEl => {
        const codeContent = codeEl.textContent || "";
        if (codeContent.trim()) {
          codeBlocks.push(codeContent);
        }
      });

      let extractedText = mainContent.textContent || "";

      // Add extracted code blocks if they exist
      if (codeBlocks.length > 0) {
        const uniqueCodeBlocks = [...new Set(codeBlocks)];
        extractedText += "\n\nCODE EXAMPLES:\n";
        uniqueCodeBlocks.forEach((code, index) => {
          extractedText += `\n--- CODE BLOCK ${index + 1} ---\n${code}\n--- END CODE BLOCK ---\n`;
        });
      }

      return extractedText;
    }

    return "";
  } catch (error) {
    console.error(`Error fetching document content from ${url}:`, error);
    return "";
  }
}

/**
 * Chunks text into smaller segments to handle large documents
 */
export function chunkText(text: string, maxChunkSize: number = 1500): string[] {
  if (!text || text.length <= maxChunkSize) return [text];

  const chunks: string[] = [];
  let currentIndex = 0;

  while (currentIndex < text.length) {
    let endIndex = Math.min(currentIndex + maxChunkSize, text.length);

    if (endIndex < text.length) {
      // Try to break at paragraph or sentence
      const paragraphBreak = text.lastIndexOf("\n\n", endIndex);
      if (paragraphBreak > currentIndex && paragraphBreak > endIndex - 200) {
        endIndex = paragraphBreak;
      } else {
        const sentenceBreak = Math.max(
          text.lastIndexOf(". ", endIndex),
          text.lastIndexOf("! ", endIndex),
          text.lastIndexOf("? ", endIndex)
        );
        if (sentenceBreak > currentIndex && sentenceBreak > endIndex - 100) {
          endIndex = sentenceBreak + 1;
        }
      }
    }

    chunks.push(text.substring(currentIndex, endIndex));
    currentIndex = endIndex;
  }

  return chunks;
}

/**
 * Enhances document content by processing and extracting key information
 */
export function processDocumentContent(content: string): string {
  if (!content) return "";

  // Remove excess whitespace
  content = content.replace(/\s+/g, " ");

  // Extract code blocks - they're particularly important for technical documentation
  const codeBlocks: string[] = [];
  const codeRegex = /```[\s\S]*?```|`[\s\S]*?`/g;
  let match;

  while ((match = codeRegex.exec(content)) !== null) {
    codeBlocks.push(match[0]);
  }

  // Process the regular text to ensure it's clean and structured
  const processedText = content.replace(/\s+/g, " ").replace(/\n{3,}/g, "\n\n");

  // If we found code blocks, highlight their importance
  if (codeBlocks.length > 0) {
    const codeSection = "Code examples:\n" + codeBlocks.join("\n\n");
    return processedText + "\n\n" + codeSection;
  }

  return processedText;
}

/**
 * Score and rank search results by relevance to the query
 */
export function rankSearchResultsByRelevance(
  query: string,
  searchResults: InternalDocSearchHit[]
): InternalDocSearchHit[] {
  if (!searchResults || searchResults.length === 0) return [];

  const queryWords = query
    .toLowerCase()
    .split(/\s+/)
    .filter(word => word.length > 2);

  const scoredResults = searchResults.map(result => {
    let score = 0;

    // Title matching
    if (result.hierarchy?.lvl0) {
      const title = result.hierarchy.lvl0.toLowerCase();
      queryWords.forEach(word => {
        if (title.includes(word)) score += 2;
      });
    }

    // Subtitle matching
    if (result.hierarchy?.lvl1) {
      const subtitle = result.hierarchy.lvl1.toLowerCase();
      queryWords.forEach(word => {
        if (subtitle.includes(word)) score += 1.5;
      });
    }

    // Content snippet matching
    if (result._snippetResult?.content?.value) {
      const snippet = result._snippetResult.content.value.toLowerCase();
      queryWords.forEach(word => {
        if (snippet.includes(word)) score += 1;
      });

      // Bonus for highlighted matches
      if (result._snippetResult.content.value.includes("<em>")) {
        score += 2;
      }
    }

    // Prefer specific pages over index pages
    if (result.url && !result.url.endsWith("/") && !result.url.endsWith("index.html")) {
      score += 0.5;
    }

    return { result, score };
  });

  return scoredResults
    .sort((a, b) => b.score - a.score)
    .map(item => item.result);
}

/**
 * Processes search results to retrieve actual document content
 */
export async function retrieveDocumentContent(
  searchResults: InternalDocSearchHit[],
  query: string,
  options?: { includeLlmsFile?: boolean }
): Promise<string[]> {
  if (!searchResults || searchResults.length === 0) return [];

  // Rank results by relevance
  const rankedResults = rankSearchResultsByRelevance(query, searchResults);
  const topResults = rankedResults.slice(0, 4);

  // Fetch content from each document URL in parallel
  const contentPromises = topResults.map(result => fetchDocumentContent(result.url));
  const contents = await Promise.all(contentPromises);

  // Check for llms.txt file if option is enabled (default to true)
  if (options?.includeLlmsFile !== false) {
    try {
      // Attempt to fetch the llms.txt file from the root of the site
      const llmsResponse = await fetch('/llms.txt');
      if (llmsResponse.ok) {
        const llmsContent = await llmsResponse.text();
        if (llmsContent.trim() !== '') {
          // Add the llms.txt content to the beginning for higher priority
          contents.unshift(`--- LLMS CONTEXT FILE ---\n${llmsContent}\n--- END LLMS CONTEXT ---`);
        }
      }
    } catch (error) {
      console.log('llms.txt file not found or cannot be loaded:', error);
      // Continue without the file if not available
    }
  }

  // Process and return non-empty content
  return contents
    .filter(content => content.trim() !== "")
    .map(content => {
      // Process the content to enhance the extraction of key information
      const processedContent = processDocumentContent(content);

      // Chunk longer content to handle large documents
      const chunks = chunkText(processedContent, 2000);

      // For simplicity, we'll use just the first chunk for now
      return chunks[0];
    });
}

/**
 * Fallback mechanism that provides search result information when document fetching fails
 */
export function generateFallbackContent(searchResults: InternalDocSearchHit[], query: string): string[] {
  if (!searchResults || searchResults.length === 0) {
    return [];
  }

  // Score and rank results by relevance first
  const rankedResults = rankSearchResultsByRelevance(query, searchResults);

  return rankedResults.slice(0, 5).map((result) => {
    // Create a structured representation of the search result
    let content = "";

    // Add the title and path information
    if (result.hierarchy) {
      const title = result.hierarchy.lvl0 || "";
      const subtitle = result.hierarchy.lvl1 || "";
      content += `# ${title}\n## ${subtitle}\n\n`;
    }

    // Add the URL
    content += `URL: ${result.url}\n\n`;

    // Add snippet if available - focus on extracting highlighted parts
    if (result._snippetResult?.content?.value) {
      const snippet = result._snippetResult.content.value;

      // Extract text surrounding the <em> highlighted parts for better context
      const highlights = snippet.split("<em>");
      if (highlights.length > 1) {
        content += "HIGHLIGHTED CONTENT:\n";
        for (let i = 1; i < highlights.length; i++) {
          const parts = highlights[i].split("</em>");
          if (parts.length > 0) {
            // Get the highlighted term and some context around it
            const highlightedTerm = parts[0];
            const contextAfter = parts[1]?.split(".")[0] || "";
            const contextBefore = highlights[i - 1]?.split(".").slice(-1)[0] || "";

            content += `- ${contextBefore} *${highlightedTerm}* ${contextAfter}.\n`;
          }
        }
        content += "\n";
      } else {
        // If no highlights, just use the whole snippet
        content += `${snippet}\n\n`;
      }
    }

    // Add text content if available
    if (result.content) {
      content += `${result.content}\n\n`;
    }

    return content;
  });
}

/**
 * Default response guidelines for markdown formatting
 */
export const DEFAULT_RESPONSE_GUIDELINES = `FORMAT YOUR RESPONSE AS MARKDOWN: Generate valid markdown that follows these guidelines:
 - Use ## and ### for section headings (not #)
 - Format your response for Docusaurus
 - For code blocks use triple backticks with language specification, e.g. \`\`\`javascript
 - Always specify the language for code blocks (javascript, jsx, typescript, bash, etc.)
 - For inline code, use single backticks
 - Use standard markdown for links: [text](url)
 - For admonitions/callouts, use blockquote style:
   > **Note**
   > 
   > This is a note

   > **Tip**
   > 
   > This is a tip

   > **Warning**
   > 
   > This is a warning

   > **Danger**
   > 
   > This is a danger warning
 - NEVER use HTML tags - use only pure markdown syntax
 - IMPORTANT: Always include proper language specifier for code blocks to ensure syntax highlighting works
 - Format tables using markdown table syntax
 - For complex layouts and formatting, rely on standard markdown features rather than HTML`;

/**
 * Creates a system prompt for use with OpenAI
 */
export function createSystemPrompt(options?: {
  systemPrompt?: string;
  siteName?: string;
  responseGuidelines?: string;
}): string {
  const responseGuidelines = options?.responseGuidelines || DEFAULT_RESPONSE_GUIDELINES;

  if (options?.systemPrompt) {
    return options.systemPrompt + `\n\n${responseGuidelines}`;
  }

  const siteName = options?.siteName || 'Documentation';
  
  // Use custom guidelines if provided, otherwise use defaults
  
  return `You are a helpful ${siteName} assistant. Your goal is to provide detailed, accurate information about ${siteName} based on the documentation provided.

RESPONSE GUIDELINES:
1. BE HELPFUL: Always try to provide SOME guidance, even when the documentation doesn't contain a perfect answer.
2. PRIORITIZE USER SUCCESS: Focus on helping the user accomplish their task.
3. USE DOCUMENTATION FIRST: Base your answers primarily on the provided documentation snippets.
4. CODE EXAMPLES ARE CRUCIAL: Always include code snippets from the documentation when available.
5. INFERENCE IS ALLOWED: When documentation contains related but not exact information, use reasonable inference to bridge gaps.
6. BE HONEST: If you truly can't provide an answer, suggest relevant concepts or documentation sections that might help instead.
7. ${responseGuidelines}
`;
}

/**
 * Creates a user prompt with the query and documentation content
 */
export function createUserPrompt(
  query: string, 
  documentContents: string[], 
  searchResults: InternalDocSearchHit[],
  options?: {
    userPrompt?: string;
    maxDocuments?: number;
    highlightCode?: boolean;
  }
): string {
  // Use custom prompt template if provided
  if (options?.userPrompt) {
    let customPrompt = options.userPrompt;
    const maxDocs = options.maxDocuments || 4;
    
    // Prepare document content for substitution
    const contextContent = documentContents
      .slice(0, maxDocs)
      .map((content, index) => {
        const result = searchResults[index];
        const title = result?.hierarchy?.lvl0 || "Document " + (index + 1);
        return `--- START OF DOCUMENT: ${title} ---\n${content}\n--- END OF DOCUMENT ---\n`;
      })
      .join("\n\n");
      
    // Prepare source references for substitution
    const formattedResults = searchResults
      .slice(0, maxDocs)
      .map((result, index) => {
        const title = result.hierarchy?.lvl0 || "Document";
        const subtitle = result.hierarchy?.lvl1 || "";
        return `Source ${index + 1}: ${title} > ${subtitle}: ${result.url}`;
      })
      .join("\n");
    
    // Replace tokens in the template
    return customPrompt
      .replace(/\{query\}/g, query)
      .replace(/\{context\}/g, contextContent)
      .replace(/\{sources\}/g, formattedResults);
  }

  // Use default prompt format
  const maxDocs = options?.maxDocuments || 4;
  
  // Format search results with titles and URLs
  const formattedResults = searchResults
    .slice(0, maxDocs)
    .map((result, index) => {
      const title = result.hierarchy?.lvl0 || "Document";
      const subtitle = result.hierarchy?.lvl1 || "";
      return `Source ${index + 1}: ${title} > ${subtitle}: ${result.url}`;
    })
    .join("\n");

  // Prepare the content with source information
  const contextContent = documentContents
    .slice(0, maxDocs)
    .map((content, index) => {
      const result = searchResults[index];
      const title = result?.hierarchy?.lvl0 || "Document " + (index + 1);
      return `--- START OF DOCUMENT: ${title} ---\n${content}\n--- END OF DOCUMENT ---\n`;
    })
    .join("\n\n");

  return `The user's question is: "${query}"

Here's content from the most relevant documentation sections:

${contextContent}

Source references:
${formattedResults}

Based on the above documentation, provide the most helpful answer you can to the user's question. Remember:
1. Include ALL relevant code examples from the documentation
2. If you can't find a direct answer, still provide guidance based on similar concepts
3. Suggest specific next steps the user could take
4. Keep your explanation concise but thorough
5. Link to specific documentation pages when relevant`;
} 