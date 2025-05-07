/**
 * Tracks AI queries for analytics purposes
 */
export function trackAIQuery(query, success = true) {
  try {
    // Log the query for analytics
    console.log(`[Docusaurus AI] Query: "${query}" (${success ? "success" : "failed"})`);

    // Example: track with a custom analytics event if you have analytics set up
    if (typeof window !== "undefined" && window.gtag) {
      window.gtag("event", "ai_search", {
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
export async function fetchDocumentContent(url) {
  try {
    // Convert absolute URL to relative path if it's from the same origin
    let path = url;

    if (typeof window !== "undefined") {
      // Check if it's from the same domain
      const urlObj = new URL(url, window.location.origin);

      if (urlObj.origin === window.location.origin) {
        // For same-origin URLs, we can just fetch the HTML file
        // Strip off origin and handle paths that end with / by adding index.html
        path = urlObj.pathname;

        // Handle typical Docusaurus routes - append index.html if needed
        if (path.endsWith("/")) {
          path = `${path}index.html`;
        } else if (!path.includes(".")) {
          // If there's no file extension, it's likely a route that needs /index.html
          path = `${path}/index.html`;
        }
      } else {
        // For external URLs, we can't fetch due to CORS, so just use what's available
        return "";
      }
    }

    try {
      const response = await fetch(path);

      if (!response.ok) {
        console.warn(`Failed to fetch content from ${path}: ${response.statusText}`);
        return "";
      }

      const html = await response.text();

      // Extract main content from the HTML
      const tempDiv = document.createElement("div");
      tempDiv.innerHTML = html;

      // Find the main content area (adjust selector based on your Docusaurus theme)
      const mainContent =
        tempDiv.querySelector(".markdown") ||
        tempDiv.querySelector("article") ||
        tempDiv.querySelector("main") ||
        tempDiv.querySelector(".container") ||
        tempDiv.querySelector('div[class*="docItemContainer"]') ||
        tempDiv.querySelector('div[class*="docMainContainer"]');

      if (mainContent) {
        // Strip navigation and sidebar elements that don't contain actual content
        const elementsToRemove = mainContent.querySelectorAll(
          "script, style, nav, .navbar, .sidebar, .pagination, .tocCollapsible, .tableOfContents",
        );
        elementsToRemove.forEach((node) => node.remove());

        // Extract code blocks specially - they're important for technical documentation
        const codeBlocks = [];

        // Find all code blocks with different selectors to ensure we get them all
        const codeElements = mainContent.querySelectorAll(
          'pre code, .codeBlock, .prism-code, code[class*="language-"], div[class*="codeBlockContainer"]',
        );

        codeElements.forEach((codeEl) => {
          const codeContent = codeEl.textContent || "";
          if (codeContent.trim()) {
            codeBlocks.push(codeContent);
          }
        });

        // Get the main text content
        let extractedText = mainContent.textContent || "";

        // Add extracted code blocks at the end with special markers if they exist
        if (codeBlocks.length > 0) {
          // Deduplicate code blocks
          const uniqueCodeBlocks = [...new Set(codeBlocks)];

          extractedText += "\n\nCODE EXAMPLES:\n";
          uniqueCodeBlocks.forEach((code, index) => {
            extractedText += `\n--- CODE BLOCK ${index + 1} ---\n${code}\n--- END CODE BLOCK ---\n`;
          });
        }

        return extractedText;
      }

      console.warn(`Could not find content in ${url}`);
      return "";
    } catch (fetchError) {
      console.error(`Error during fetch for ${path}:`, fetchError);
      return "";
    }
  } catch (error) {
    console.error(`Error fetching document content from ${url}:`, error);
    return "";
  }
}

/**
 * Chunks text into smaller segments to handle large documents
 */
export function chunkText(text, maxChunkSize = 1500) {
  if (!text || text.length <= maxChunkSize) {
    return [text];
  }

  const chunks = [];
  let currentIndex = 0;

  while (currentIndex < text.length) {
    // Find a good breakpoint (paragraph or sentence end)
    let endIndex = Math.min(currentIndex + maxChunkSize, text.length);

    // If we're not at the end of the text, find a good breaking point
    if (endIndex < text.length) {
      // Try to break at paragraph
      const paragraphBreak = text.lastIndexOf("\n\n", endIndex);
      if (paragraphBreak > currentIndex && paragraphBreak > endIndex - 200) {
        endIndex = paragraphBreak;
      } else {
        // Try to break at sentence
        const sentenceBreak = Math.max(
          text.lastIndexOf(". ", endIndex),
          text.lastIndexOf("! ", endIndex),
          text.lastIndexOf("? ", endIndex),
        );
        if (sentenceBreak > currentIndex && sentenceBreak > endIndex - 100) {
          endIndex = sentenceBreak + 1; // Include the period
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
export function processDocumentContent(content) {
  if (!content) return "";

  // Remove excess whitespace
  content = content.replace(/\s+/g, " ");

  // Extract code blocks - they're particularly important for technical documentation
  const codeBlocks = [];
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
export function rankSearchResultsByRelevance(query, searchResults) {
  if (!searchResults || searchResults.length === 0) {
    return [];
  }

  const queryWords = query
    .toLowerCase()
    .split(/\s+/)
    .filter((word) => word.length > 2);

  // Score each result based on multiple factors
  const scoredResults = searchResults.map((result) => {
    let score = 0;

    // Basic text matching in title
    if (result.hierarchy?.lvl0) {
      const title = result.hierarchy.lvl0.toLowerCase();
      queryWords.forEach((word) => {
        if (title.includes(word)) score += 2;
      });
    }

    // Basic text matching in subtitle
    if (result.hierarchy?.lvl1) {
      const subtitle = result.hierarchy.lvl1.toLowerCase();
      queryWords.forEach((word) => {
        if (subtitle.includes(word)) score += 1.5;
      });
    }

    // Text matching in content snippets
    if (result._snippetResult?.content?.value) {
      const snippet = result._snippetResult.content.value.toLowerCase();
      queryWords.forEach((word) => {
        if (snippet.includes(word)) score += 1;
      });

      // Bonus for highlighted matches in snippets (Algolia marks these with <em>)
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

  // Sort by score (highest first)
  return scoredResults.sort((a, b) => b.score - a.score).map((item) => item.result);
}

/**
 * Processes search results to retrieve actual document content
 */
export async function retrieveDocumentContent(searchResults, query) {
  if (!searchResults || searchResults.length === 0) {
    return [];
  }

  // Rank results by relevance to the query
  const rankedResults = rankSearchResultsByRelevance(query, searchResults);

  // Limit the number of documents to fetch to avoid performance issues
  const topResults = rankedResults.slice(0, 4);

  // Fetch content from each document URL in parallel
  const contentPromises = topResults.map((result) => fetchDocumentContent(result.url));
  const contents = await Promise.all(contentPromises);

  // Process and chunk the content
  return contents
    .filter((content) => content.trim() !== "")
    .map((content) => {
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
export function generateFallbackContent(searchResults, query) {
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