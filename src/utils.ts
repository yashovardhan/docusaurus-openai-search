import { InternalDocSearchHit } from '@docsearch/react';
import { DocumentContent, RankedSearchResult } from './types';

/**
 * Tracks AI queries for analytics purposes
 */
export function trackAIQuery(query: string, success: boolean = true): void {
  try {
    if (typeof window !== "undefined" && (window as any).gtag) {
      (window as any).gtag("event", "ai_search", {
        event_category: "search",
        event_label: query,
        value: success ? 1 : 0,
      });
    }
  } catch (e) {
    // Silently handle error
  }
}

/**
 * Fetches the content of a document from its URL
 */
export async function fetchDocumentContent(url: string): Promise<string> {
  try {
    // First, try direct HTML extraction from search results
    // This will work even when paths don't match perfectly
    const directContent = await extractContentFromSearchResult(url);
    if (directContent && directContent.trim() !== "") {
      return directContent;
    }
    
    // Fall back to regular path-based fetching
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
        } else if (path.includes("#")) {
          // Strip hash/anchor fragments
          path = path.split("#")[0];
        }
        
        // Handle any query parameters
        if (path.includes("?")) {
          path = path.split("?")[0];
        }
      } else {
        return "";
      }
    }

    const response = await fetch(path);
    if (!response.ok) {
      // Try one more alternative approach - fetch without index.html
      if (path.endsWith('index.html')) {
        const altPath = path.replace('index.html', '');
        const altResponse = await fetch(altPath);
        if (!altResponse.ok) {
          return "";
        }
        return extractContentFromHTML(await altResponse.text());
      }
      
      return "";
    }

    return extractContentFromHTML(await response.text());
  } catch (error) {
    return "";
  }
}

/**
 * Extract content directly from HTML text
 */
function extractContentFromHTML(html: string): string {
  const tempDiv = document.createElement("div");
  tempDiv.innerHTML = html;

  // Find the main content area - try multiple selectors used by different Docusaurus themes
  const mainContent =
    tempDiv.querySelector("article") ||
    tempDiv.querySelector("main") ||
    tempDiv.querySelector('.markdown') ||
    tempDiv.querySelector('.theme-doc-markdown') ||
    tempDiv.querySelector('div[class*="docItemContainer"]') ||
    tempDiv.querySelector('div[class*="docMainContainer"]') ||
    tempDiv.querySelector('div[class*="prose"]') ||
    tempDiv.querySelector('div[class*="docusaurus-content"]') ||
    tempDiv.querySelector('div[class*="docs-content"]') ||
    tempDiv.querySelector('.container .row article') ||
    tempDiv.querySelector('div[class*="content"]') ||
    tempDiv.querySelector('.container');

  if (mainContent) {
    // Remove non-content elements
    mainContent.querySelectorAll(
      "script, style, nav, .navbar, .sidebar, .pagination, .tocCollapsible, .tableOfContents, footer, .footer"
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

    // Add extracted code blocks
    if (codeBlocks.length > 0) {
      const uniqueCodeBlocks = [...new Set(codeBlocks)];
      extractedText += "\n\nCODE EXAMPLES:\n";
      uniqueCodeBlocks.forEach((code, index) => {
        extractedText += `\n--- CODE BLOCK ${index + 1} ---\n${code}\n--- END CODE BLOCK ---\n`;
      });
    }

    return extractedText;
  } else {
    // Last resort fallback - just get the body text
    const bodyElement = tempDiv.querySelector('body');
    if (bodyElement) {
      return bodyElement.textContent || "";
    }
    
    return "";
  }
}

/**
 * Extract content directly from a search result without relying on URL fetching
 */
async function extractContentFromSearchResult(url: string): Promise<string> {
  // This is a fallback mechanism that works directly with search results
  // when we can't rely on URL fetching due to routing/path issues
  
  if (typeof window === 'undefined') {
    return "";
  }
  
  try {
    // Look for the element on the page that might match this URL
    // This works when the search is being done on the same page that contains the content
    const linkElements = Array.from(document.querySelectorAll('a[href]'));
    const matchingLinks = linkElements.filter(link => {
      const href = link.getAttribute('href');
      return href && (href === url || url.includes(href));
    });
    
    if (matchingLinks.length > 0) {
      // Try to find the closest article or content container
      let closestContent = null;
      for (const link of matchingLinks) {
        let parent = link.parentElement;
        while (parent) {
          if (parent.tagName === 'ARTICLE' || 
              parent.classList.contains('markdown') ||
              parent.classList.contains('docItemContainer') ||
              parent.classList.contains('theme-doc-markdown')) {
            closestContent = parent;
            break;
          }
          parent = parent.parentElement;
        }
        if (closestContent) break;
      }
      
      if (closestContent) {
        return closestContent.textContent || "";
      }
    }
    
    return "";
  } catch (e) {
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

  // Take top 5 results for better coverage
  const topResults = searchResults.slice(0, 5);
  
  // First attempt: Try to extract content directly from search results
  // This is more reliable as it doesn't depend on URL fetching
  const contents: string[] = [];
  
  // 1. Extract from search result data
  for (const result of topResults) {
    let content = "";
    
    // Add title and hierarchy info for context
    if (result.hierarchy) {
      if (result.hierarchy.lvl0) content += `# ${result.hierarchy.lvl0}\n`;
      if (result.hierarchy.lvl1) content += `## ${result.hierarchy.lvl1}\n`;
      if (result.hierarchy.lvl2) content += `### ${result.hierarchy.lvl2}\n`;
      if (result.hierarchy.lvl3) content += `#### ${result.hierarchy.lvl3}\n`;
      content += "\n";
    }
    
    // Add URL for reference
    content += `URL: ${result.url}\n\n`;
    
    // Extract content from snippets (most important for RAG)
    if (result._snippetResult?.content?.value) {
      // Format snippet content, converting emphasis tags to markdown
      const snippet = result._snippetResult.content.value
        .replace(/<em>/g, "**")
        .replace(/<\/em>/g, "**")
        .replace(/<(?:.|\n)*?>/g, "");
      
      content += `${snippet}\n\n`;
    }
    
    // Add full content if available
    if (result.content) {
      content += `${result.content}\n\n`;
    }
    
    // Detect if we're missing content
    if (!result._snippetResult?.content?.value && !result.content) {
      // Try to extract additional information from highlight results
      if (result._highlightResult) {
        if (result._highlightResult.content?.value) {
          const highlightContent = result._highlightResult.content.value
            .replace(/<em>/g, "**")
            .replace(/<\/em>/g, "**")
            .replace(/<(?:.|\n)*?>/g, "");
          content += `${highlightContent}\n\n`;
        }
      }
    }
    
    if (content.trim() !== "") {
      contents.push(content);
    }
  }
  
  // If content is still missing, try direct URL fetching
  if (contents.length === 0 || contents.some(content => 
      content.split('\n').filter(line => line.trim() !== '').length <= 3)) {
    
    // Fetch content from each document URL in parallel (fallback)
    const contentPromises = topResults.map(result => fetchDocumentContent(result.url));
    const fetchedContents = await Promise.all(contentPromises);
    
    // Process and combine fetched content with what we already have
    fetchedContents.forEach((fetchedContent, index) => {
      if (fetchedContent && fetchedContent.trim() !== "") {
        if (index < contents.length) {
          // We have some content but it might be minimal, so append fetched content
          const existingLines = contents[index].split('\n').filter(line => line.trim() !== '').length;
          if (existingLines <= 3) {
            contents[index] += `\nAdditional fetched content:\n${fetchedContent}`;
          }
        } else {
          // We don't have any content for this index yet
          let enhancedContent = "";
          
          // Add title and hierarchy if available
          const result = topResults[index];
          if (result.hierarchy) {
            if (result.hierarchy.lvl0) enhancedContent += `# ${result.hierarchy.lvl0}\n`;
            if (result.hierarchy.lvl1) enhancedContent += `## ${result.hierarchy.lvl1}\n`;
            if (result.hierarchy.lvl2) enhancedContent += `### ${result.hierarchy.lvl2}\n`;
            if (result.hierarchy.lvl3) enhancedContent += `#### ${result.hierarchy.lvl3}\n`;
            enhancedContent += "\n";
          }
          
          // Add URL for reference
          enhancedContent += `URL: ${result.url}\n\n`;
          
          // Add the fetched content
          enhancedContent += fetchedContent;
          
          contents.push(enhancedContent);
        }
      }
    });
  }
  
  // 3. Check for llms.txt file if option is enabled
  if (options?.includeLlmsFile === true) {
    try {
      const llmsResponse = await fetch('/llms.txt');
      if (llmsResponse.ok) {
        const llmsContent = await llmsResponse.text();
        if (llmsContent.trim() !== '') {
          // Add the llms.txt content to the beginning for higher priority
          contents.unshift(`--- LLMS CONTEXT FILE ---\n${llmsContent}\n--- END LLMS CONTEXT ---`);
        }
      }
    } catch (error) {
      // Silently handle error
    }
  }
  
  // Verify we have actual content
  let contentLengths = contents.map(content => {
    const lines = content.split('\n').filter(line => line.trim() !== '').length;
    return {length: content.length, lines: lines};
  });
  
  // Try direct page fetch if content still seems minimal
  if (contentLengths.some(stats => stats.lines <= 3 || stats.length < 100)) {
    
    // Set up more aggressive content extraction
    await Promise.all(topResults.map(async (result, index) => {
      try {
        // Only fetch for minimal content
        if (index < contentLengths.length && 
            (contentLengths[index].lines <= 3 || contentLengths[index].length < 100)) {
          const directResponse = await fetch(result.url);
          if (directResponse.ok) {
            const htmlText = await directResponse.text();
            const extractedContent = extractContentFromHTML(htmlText);
            
            if (extractedContent && extractedContent.trim() !== "") {
              // Replace or append?
              if (contentLengths[index].lines <= 3) {
                // Content is very minimal, replace it completely
                let enhancedContent = "";
                
                // Keep the header
                const headerLines = contents[index].split('\n').slice(0, 4).join('\n');
                enhancedContent = headerLines + "\n\n" + extractedContent;
                
                contents[index] = enhancedContent;
              } else {
                // Content has some substance, append the extracted content
                contents[index] += `\n\nAdditional content from direct fetch:\n${extractedContent}`;
              }
            }
          }
        }
      } catch (error) {
        // Silently handle error
      }
    }));
  }
  
  // Process and return non-empty content
  return contents.map(content => {
    // Chunk longer content to handle large documents
    const chunks = chunkText(content, 2000);
    return chunks[0]; // Use first chunk for simplicity
  });
}

/**
 * Fallback mechanism that provides search result information when document fetching fails
 */
export function generateFallbackContent(searchResults: InternalDocSearchHit[], query: string): string[] {
  if (!searchResults || searchResults.length === 0) {
    return [];
  }

  // Use the top 5 results
  const topResults = searchResults.slice(0, 5);

  return topResults.map((result) => {
    // Create a structured representation of the search result
    let content = "";

    // Add the title and hierarchy information
    if (result.hierarchy) {
      if (result.hierarchy.lvl0) content += `# ${result.hierarchy.lvl0}\n`;
      if (result.hierarchy.lvl1) content += `## ${result.hierarchy.lvl1}\n`;
      if (result.hierarchy.lvl2) content += `### ${result.hierarchy.lvl2}\n`;
      if (result.hierarchy.lvl3) content += `#### ${result.hierarchy.lvl3}\n`;
      content += "\n";
    }

    // Add the URL for reference
    content += `URL: ${result.url}\n\n`;

    // Extract the most relevant information from the search result
    
    // 1. Extract content from highlights in snippets
    if (result._snippetResult?.content?.value) {
      const snippet = result._snippetResult.content.value;
      
      // Convert HTML to Markdown format for better readability
      const markdownSnippet = snippet
        .replace(/<em>/g, "**")  // Convert emphasis to bold
        .replace(/<\/em>/g, "**")
        .replace(/<(?:.|\n)*?>/g, ""); // Remove other HTML tags
      
      content += `${markdownSnippet}\n\n`;
    }
    
    // 2. Add full content if available
    if (result.content) {
      content += `${result.content}\n\n`;
    }
    
    // 3. Add any available headings that might provide additional context
    const headings = [];
    if (result._highlightResult?.hierarchy) {
      // Check each heading level directly
      const hierarchy = result._highlightResult.hierarchy;
      
      // Safely access each level with proper type checking
      if (hierarchy.lvl1?.value) {
        headings.push(cleanHighlightHTML(hierarchy.lvl1.value));
      }
      if (hierarchy.lvl2?.value) {
        headings.push(cleanHighlightHTML(hierarchy.lvl2.value));
      }
      if (hierarchy.lvl3?.value) {
        headings.push(cleanHighlightHTML(hierarchy.lvl3.value));
      }
      if (hierarchy.lvl4?.value) {
        headings.push(cleanHighlightHTML(hierarchy.lvl4.value));
      }
    }
    
    if (headings.length > 0) {
      content += "Related headings:\n";
      headings.forEach(heading => {
        content += `- ${heading}\n`;
      });
      content += "\n";
    }

    return content;
  });
}

/**
 * Helper function to clean HTML from highlighted text
 */
function cleanHighlightHTML(text: string): string {
  return text
    .replace(/<em>/g, "**")
    .replace(/<\/em>/g, "**")
    .replace(/<(?:.|\n)*?>/g, "");
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
 - For complex layouts and formatting, rely on standard markdown features rather than HTML
 
CODE PRESERVATION RULES:
 - NEVER modify, edit, simplify, or reformat ANY code examples from the documentation
 - Include complete code snippets exactly as they appear in the documentation
 - Preserve all comments, indentation, and formatting in code examples
 - If documentation shows partial code with ellipses (...), maintain those indicators
 - Do not truncate or abbreviate code examples to save space`;

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
4. CODE EXAMPLES ARE CRUCIAL: Always include code snippets from the documentation when available. NEVER modify code examples - include them exactly as they appear in the documentation.
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
    const finalPrompt = customPrompt
      .replace(/\{query\}/g, query)
      .replace(/\{context\}/g, contextContent)
      .replace(/\{sources\}/g, formattedResults);
    
    return finalPrompt;
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

  const finalPrompt = `The user's question is: "${query}"

Here's content from the most relevant documentation sections:

${contextContent}

Source references:
${formattedResults}

Based on the above documentation, provide the most helpful answer you can to the user's question. Remember:
1. Include ALL relevant code examples from the documentation
2. IMPORTANT: Preserve ALL code snippets EXACTLY as they appear - do not modify, reformat, or simplify them
3. If you can't find a direct answer, still provide guidance based on similar concepts
4. Suggest specific next steps the user could take
5. Keep your explanation concise but thorough
6. Link to specific documentation pages when relevant`;
  
  return finalPrompt;
}

/**
 * Summarize document content using OpenAI to make it more focused on the query
 */
export async function summarizeContentWithAI(
  query: string,
  documentContents: string[],
  apiKey: string,
  options?: {
    model?: string;
    maxTokens?: number;
  }
): Promise<string[]> {
  if (!documentContents.length || !apiKey) {
    return documentContents;
  }
  
  try {
    // Import OpenAI dynamically to avoid server-side issues
    const { OpenAI } = await import('openai');
    
    const openai = new OpenAI({
      apiKey: apiKey,
      dangerouslyAllowBrowser: true,
    });
    
    const summarizedContents: string[] = [];
    
    // Process each document content separately to maintain context
    for (const content of documentContents) {
      // Skip empty content
      if (!content.trim()) {
        continue;
      }
      
      const systemPrompt = `You are a documentation summarizer that extracts the most relevant information for a user query.
Your task is to process documentation content and return a concise summary that:

IMPORTANT CODE PRESERVATION RULES:
1. ALL CODE BLOCKS AND SNIPPETS MUST BE PRESERVED EXACTLY AS THEY APPEAR - Do not modify, summarize, or reformat ANY code
2. Code enclosed in backticks (like \`code\` or \`\`\`javascript ... \`\`\`) must remain completely unchanged
3. If code contains comments, preserve them exactly as they appear

CONTENT SUMMARIZATION RULES:
1. Maintain all headings, structure, and formatting in the original document
2. Keep all URLs and references intact
3. Focus on information that specifically addresses the user query
4. Summarize explanatory text to be more concise while preserving meaning
5. Remove any irrelevant or redundant information
6. Preserve all technical details, parameters, and important specifications
7. Return ONLY the summarized content with no meta-commentary or introductions`;

      const userPrompt = `User query: "${query}"
      
Here is the documentation content to summarize:

${content}

Return a concise summary that focuses on information relevant to the user's query.
CRITICAL: Preserve ALL code blocks and snippets EXACTLY as they appear without any modifications.
If in doubt about whether something is code, preserve it exactly as written.
Preserve all headings, technical details, and URLs.`;

      const response = await openai.chat.completions.create({
        model: options?.model || 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: systemPrompt,
          },
          {
            role: 'user',
            content: userPrompt,
          },
        ],
        max_tokens: options?.maxTokens || 1000,
        temperature: 0.3, // Low temperature for faithful summarization
      });
      
      const summarizedContent = response.choices[0]?.message?.content?.trim();
      
      if (summarizedContent) {
        summarizedContents.push(summarizedContent);
      } else {
        // Fall back to original content if summarization fails
        summarizedContents.push(content);
      }
    }
    
    return summarizedContents;
  } catch (error) {
    // Fall back to original content on error
    return documentContents;
  }
} 