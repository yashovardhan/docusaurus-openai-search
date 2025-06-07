import { InternalDocSearchHit } from '@docsearch/react';
import { getLogger } from './logger';

/**
 * Fetches the content of a document from its URL
 */
export async function fetchDocumentContent(url: string): Promise<string> {
  const logger = getLogger();
  
  try {
    logger.log(`Fetching document content from: ${url}`);
    
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
        logger.log(`External URL detected, skipping: ${url}`);
        return "";
      }
    }

    const response = await fetch(path);
    if (!response.ok) {
      logger.log(`Fetch failed with status: ${response.status}`);
      return "";
    }

    const html = await response.text();
    return extractContentFromHTML(html);
  } catch (error) {
    logger.logError('fetchDocumentContent', error);
    return "";
  }
}

/**
 * Extract content from HTML
 */
function extractContentFromHTML(html: string): string {
  const tempDiv = document.createElement("div");
  tempDiv.innerHTML = html;

  // Find the main content area
  const mainContent =
    tempDiv.querySelector("article") ||
    tempDiv.querySelector("main") ||
    tempDiv.querySelector('.markdown') ||
    tempDiv.querySelector('.theme-doc-markdown') ||
    tempDiv.querySelector('div[class*="docItemContainer"]');

  if (mainContent) {
    // Remove non-content elements
    mainContent.querySelectorAll(
      "script, style, nav, .navbar, .sidebar, .pagination, .tocCollapsible, .tableOfContents, footer"
    ).forEach(node => node.remove());

    return mainContent.textContent || "";
  }

  return "";
}

/**
 * Retrieves document content from search results
 */
export async function retrieveDocumentContent(
  searchResults: InternalDocSearchHit[],
  maxResults: number = 5
): Promise<string[]> {
  const logger = getLogger();
  
  if (!searchResults || searchResults.length === 0) {
    logger.log('No search results provided');
    return [];
  }

  const topResults = searchResults.slice(0, maxResults);
  const contents: string[] = [];
  
  // First try to extract content from search result data
  for (const result of topResults) {
    let content = "";
    
    // Add hierarchy info for context
    if (result.hierarchy) {
      const levels = ['lvl0', 'lvl1', 'lvl2', 'lvl3', 'lvl4', 'lvl5'] as const;
      levels.forEach(level => {
        const value = result.hierarchy[level];
        if (value) {
          content += `${value}\n`;
        }
      });
    }
    
    // Add URL for reference
    content += `URL: ${result.url}\n\n`;
    
    // Extract content from snippets
    if (result._snippetResult?.content?.value) {
      const snippet = result._snippetResult.content.value
        .replace(/<em>/g, "")
        .replace(/<\/em>/g, "")
        .replace(/<[^>]*>/g, "");
      content += `${snippet}\n\n`;
    }
    
    // Add full content if available
    if (result.content) {
      content += `${result.content}\n\n`;
    }
    
    contents.push(content);
  }
  
  // If content is minimal, try fetching from URLs
  const hasMinimalContent = contents.some(content => 
    content.split('\n').filter(line => line.trim() !== '').length <= 5
  );
  
  if (hasMinimalContent) {
    logger.log('Content seems minimal, attempting URL fetching...');
    const fetchPromises = topResults.map(result => fetchDocumentContent(result.url));
    const fetchedContents = await Promise.all(fetchPromises);
    
    fetchedContents.forEach((fetchedContent, index) => {
      if (fetchedContent && fetchedContent.trim() !== "") {
        contents[index] = contents[index] + "\n" + fetchedContent;
      }
    });
  }
  
  return contents.filter(content => content.trim() !== '');
} 