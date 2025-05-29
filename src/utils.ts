import { InternalDocSearchHit } from '@docsearch/react';
import { DocumentContent, RankedSearchResult, QueryAnalysis } from './types';
import { getLogger } from './utils/logger';

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
  const logger = getLogger();
  const startTime = Date.now();
  
  try {
    logger.log(`Fetching document content from: ${url}`);
    
    // First, try direct HTML extraction from search results
    // This will work even when paths don't match perfectly
    const directContent = await extractContentFromSearchResult(url);
    if (directContent && directContent.trim() !== "") {
      logger.logContentRetrieval(url, true, directContent);
      logger.logPerformance(`fetchDocumentContent(${url})`, startTime);
      return directContent;
    }
    
    // Fall back to regular path-based fetching
    // Convert absolute URL to relative path if it's from the same origin
    let path = url;

    if (typeof window !== "undefined") {
      const urlObj = new URL(url, window.location.origin);

      if (urlObj.origin === window.location.origin) {
        path = urlObj.pathname;
        logger.log(`Converted URL to path: ${path}`);

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
        
        logger.log(`Final path for fetching: ${path}`);
      } else {
        logger.log(`External URL detected, skipping: ${url}`);
        return "";
      }
    }

    const response = await fetch(path);
    if (!response.ok) {
      logger.log(`Initial fetch failed with status: ${response.status}`);
      
      // Try one more alternative approach - fetch without index.html
      if (path.endsWith('index.html')) {
        const altPath = path.replace('index.html', '');
        logger.log(`Trying alternative path: ${altPath}`);
        const altResponse = await fetch(altPath);
        if (!altResponse.ok) {
          logger.logContentRetrieval(url, false);
          return "";
        }
        const content = extractContentFromHTML(await altResponse.text());
        logger.logContentRetrieval(url, true, content);
        logger.logPerformance(`fetchDocumentContent(${url})`, startTime);
        return content;
      }
      
      logger.logContentRetrieval(url, false);
      return "";
    }

    const content = extractContentFromHTML(await response.text());
    logger.logContentRetrieval(url, true, content);
    logger.logPerformance(`fetchDocumentContent(${url})`, startTime);
    return content;
  } catch (error) {
    logger.logError('fetchDocumentContent', error);
    logger.logContentRetrieval(url, false);
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

  const logger = getLogger();
  logger.log(`Ranking ${searchResults.length} search results for query: "${query}"`);

  // Normalize and analyze the query
  const normalizedQuery = query.toLowerCase().trim();
  const queryWords = normalizedQuery
    .split(/\s+/)
    .filter(word => word.length > 1);
  
  // Extract key concepts from query
  const queryAnalysis = analyzeQuery(normalizedQuery, queryWords);
  logger.log('Query analysis:', queryAnalysis);

  const scoredResults = searchResults.map((result, index) => {
    let score = 0;
    const scoreBreakdown: Record<string, number> = {};

    // 1. URL and path analysis
    const urlScore = scoreUrl(result.url, queryAnalysis);
    score += urlScore;
    scoreBreakdown.url = urlScore;

    // 2. Hierarchy matching with context awareness
    const hierarchyScore = scoreHierarchy(result.hierarchy, queryAnalysis, normalizedQuery);
    score += hierarchyScore;
    scoreBreakdown.hierarchy = hierarchyScore;

    // 3. Content matching with emphasis detection
    const contentScore = scoreContent(result, queryAnalysis, normalizedQuery);
    score += contentScore;
    scoreBreakdown.content = contentScore;

    // 4. Technology-specific matching
    const techScore = scoreTechnologyMatch(result, queryAnalysis);
    score += techScore;
    scoreBreakdown.technology = techScore;

    // 5. Document type relevance
    const docTypeScore = scoreDocumentType(result, queryAnalysis);
    score += docTypeScore;
    scoreBreakdown.docType = docTypeScore;

    // 6. Boost for exact or near-exact matches
    const exactMatchBonus = scoreExactMatches(result, normalizedQuery, queryWords);
    score += exactMatchBonus;
    scoreBreakdown.exactMatch = exactMatchBonus;

    // 7. Penalty for mismatched technologies
    const mismatchPenalty = calculateMismatchPenalty(result, queryAnalysis);
    score += mismatchPenalty;
    scoreBreakdown.mismatchPenalty = mismatchPenalty;

    // Log detailed scoring for top results
    if (index < 10) {
      logger.log(`Score for result ${index} (${result.url}):`, {
        totalScore: score,
        breakdown: scoreBreakdown,
        title: result.hierarchy?.lvl1 || result.hierarchy?.lvl0
      });
    }

    return { result, score };
  });

  // Sort by score (descending) and return results
  const rankedResults = scoredResults
    .sort((a, b) => b.score - a.score)
    .map(item => item.result);

  logger.log(`Ranking complete. Top result score: ${scoredResults[0]?.score || 0}`);
  return rankedResults;
}

/**
 * Analyzes the query to extract key concepts and intent
 */
function analyzeQuery(query: string, queryWords: string[]): QueryAnalysis {
  const analysis: QueryAnalysis = {
    technologies: [],
    actions: [],
    documentTypes: [],
    isHowTo: false,
    isIntegration: false,
    isAPI: false,
    platform: null,
    language: null
  };

  // Common technology keywords and their variations
  const techPatterns = {
    react: /\breact(?![\s-]native)\b/i,
    reactNative: /\breact[\s-]native\b/i,
    vue: /\bvue(?:\.?js)?\b/i,
    angular: /\bangular(?:\.?js)?\b/i,
    javascript: /\b(?:javascript|js)\b/i,
    typescript: /\b(?:typescript|ts)\b/i,
    node: /\bnode(?:\.?js)?\b/i,
    python: /\bpython\b/i,
    java: /\bjava\b(?!script)/i,
    swift: /\bswift\b/i,
    kotlin: /\bkotlin\b/i,
    flutter: /\bflutter\b/i,
    android: /\bandroid\b/i,
    ios: /\bios\b/i,
    web: /\bweb\b/i,
    mobile: /\bmobile\b/i,
    unity: /\bunity\b/i,
    unreal: /\bunreal\b/i
  };

  // Check for technologies
  Object.entries(techPatterns).forEach(([tech, pattern]) => {
    if (pattern.test(query)) {
      analysis.technologies.push(tech);
      
      // Set platform based on technology
      if (['react', 'vue', 'angular', 'javascript', 'typescript'].includes(tech)) {
        analysis.platform = 'web';
      } else if (['reactNative', 'flutter', 'android', 'ios', 'swift', 'kotlin'].includes(tech)) {
        analysis.platform = 'mobile';
      } else if (['unity', 'unreal'].includes(tech)) {
        analysis.platform = 'gaming';
      }
      
      // Set language
      if (['react', 'reactNative', 'vue', 'angular', 'javascript', 'typescript', 'node'].includes(tech)) {
        analysis.language = 'javascript';
      } else if (['swift', 'ios'].includes(tech)) {
        analysis.language = 'swift';
      } else if (['kotlin', 'android'].includes(tech)) {
        analysis.language = 'kotlin';
      } else if (tech === 'python') {
        analysis.language = 'python';
      } else if (tech === 'java') {
        analysis.language = 'java';
      }
    }
  });

  // Action words that indicate what the user wants to do
  const actionPatterns = {
    integrate: /\b(?:integrate|integration|integrating|setup|install|add)\b/i,
    implement: /\b(?:implement|implementation|implementing|create|build)\b/i,
    use: /\b(?:use|using|usage)\b/i,
    configure: /\b(?:configure|configuration|config|setting)\b/i,
    authenticate: /\b(?:authenticate|authentication|auth|login|signin)\b/i,
    connect: /\b(?:connect|connection|connecting)\b/i,
    debug: /\b(?:debug|debugging|troubleshoot|fix|error)\b/i,
    migrate: /\b(?:migrate|migration|upgrade|update)\b/i
  };

  Object.entries(actionPatterns).forEach(([action, pattern]) => {
    if (pattern.test(query)) {
      analysis.actions.push(action);
    }
  });

  // Document type indicators
  if (/\b(?:guide|tutorial|how[\s-]?to|example|quickstart|getting[\s-]?started)\b/i.test(query)) {
    analysis.documentTypes.push('guide');
    analysis.isHowTo = true;
  }
  if (/\b(?:api|reference|method|function|class|interface)\b/i.test(query)) {
    analysis.documentTypes.push('api');
    analysis.isAPI = true;
  }
  if (/\b(?:sdk|library|package|module)\b/i.test(query)) {
    analysis.documentTypes.push('sdk');
  }
  if (/\b(?:example|demo|sample|code)\b/i.test(query)) {
    analysis.documentTypes.push('example');
  }

  // Check for integration queries
  if (analysis.actions.includes('integrate') || analysis.actions.includes('connect') || 
      /\b(?:with|into|to)\b/i.test(query)) {
    analysis.isIntegration = true;
  }

  return analysis;
}

/**
 * Scores the URL based on query analysis
 */
function scoreUrl(url: string, analysis: QueryAnalysis): number {
  if (!url) return 0;
  
  let score = 0;
  const lowerUrl = url.toLowerCase();

  // Technology matching in URL
  analysis.technologies.forEach(tech => {
    if (tech === 'react' && lowerUrl.includes('react') && !lowerUrl.includes('react-native')) {
      score += 3; // Strong match for React (not React Native)
    } else if (tech === 'reactNative' && lowerUrl.includes('react-native')) {
      score += 3; // Strong match for React Native
    } else if (lowerUrl.includes(tech.toLowerCase())) {
      score += 2;
    }
  });

  // Platform matching
  if (analysis.platform) {
    if (lowerUrl.includes(analysis.platform)) {
      score += 2;
    }
  }

  // Document type matching
  if (analysis.isHowTo && lowerUrl.includes('guide')) {
    score += 1.5;
  }
  if (analysis.isAPI && lowerUrl.includes('api')) {
    score += 1.5;
  }
  if (analysis.documentTypes.includes('sdk') && lowerUrl.includes('sdk')) {
    score += 2;
  }

  // Prefer specific pages over index pages
  if (!lowerUrl.endsWith('/') && !lowerUrl.endsWith('index')) {
    score += 0.5;
  }

  return score;
}

/**
 * Scores the hierarchy (titles) based on query analysis
 */
function scoreHierarchy(
  hierarchy: any,
  analysis: QueryAnalysis,
  normalizedQuery: string
): number {
  if (!hierarchy) return 0;
  
  let score = 0;

  // Check each hierarchy level
  const levels = ['lvl0', 'lvl1', 'lvl2', 'lvl3', 'lvl4', 'lvl5'];
  const weights = [3, 2.5, 2, 1.5, 1, 0.5]; // Higher levels get more weight

  levels.forEach((level, index) => {
    if (hierarchy[level]) {
      const text = hierarchy[level].toLowerCase();
      
      // Exact match bonus
      if (text === normalizedQuery) {
        score += weights[index] * 2;
      }
      
      // Technology matching with context
      analysis.technologies.forEach(tech => {
        if (tech === 'react' && /\breact(?![\s-]native)\b/i.test(hierarchy[level])) {
          score += weights[index] * 1.5;
        } else if (tech === 'reactNative' && /\breact[\s-]native\b/i.test(hierarchy[level])) {
          score += weights[index] * 1.5;
        } else if (new RegExp(`\\b${tech}\\b`, 'i').test(hierarchy[level])) {
          score += weights[index];
        }
      });

      // Action and document type matching
      analysis.actions.forEach(action => {
        if (text.includes(action)) {
          score += weights[index] * 0.5;
        }
      });

      // SDK/API/Guide indicators
      if (analysis.documentTypes.includes('sdk') && /\bsdk\b/i.test(hierarchy[level])) {
        score += weights[index];
      }
      if (analysis.isAPI && /\bapi\b/i.test(hierarchy[level])) {
        score += weights[index];
      }
      if (analysis.isHowTo && /\b(?:guide|tutorial|how[\s-]?to)\b/i.test(hierarchy[level])) {
        score += weights[index];
      }
    }
  });

  return score;
}

/**
 * Scores content and snippets
 */
function scoreContent(
  result: InternalDocSearchHit,
  analysis: QueryAnalysis,
  normalizedQuery: string
): number {
  let score = 0;

  // Check snippet content
  if (result._snippetResult?.content?.value) {
    const snippet = result._snippetResult.content.value.toLowerCase();
    
    // Highlighted matches (from Algolia)
    const highlightCount = (result._snippetResult.content.value.match(/<em>/g) || []).length;
    score += highlightCount * 1.5;

    // Technology-specific content matching
    analysis.technologies.forEach(tech => {
      if (tech === 'react' && /\breact(?![\s-]native)\b/i.test(result._snippetResult.content.value)) {
        score += 2;
      } else if (tech === 'reactNative' && /\breact[\s-]native\b/i.test(result._snippetResult.content.value)) {
        score += 2;
      } else if (new RegExp(`\\b${tech}\\b`, 'i').test(result._snippetResult.content.value)) {
        score += 1.5;
      }
    });

    // Code example detection
    if (/```|<code>|\bimport\b|\bconst\b|\bfunction\b|\bclass\b/i.test(result._snippetResult.content.value)) {
      if (analysis.documentTypes.includes('example') || analysis.isHowTo) {
        score += 1.5; // Boost code examples for how-to queries
      }
    }
  }

  // Check full content if available
  if (result.content) {
    const content = result.content.toLowerCase();
    
    // Phrase matching
    if (content.includes(normalizedQuery)) {
      score += 2;
    }
    
    // Keyword density (but not too much to avoid keyword stuffing)
    const keywordMatches = analysis.technologies.concat(analysis.actions)
      .filter(keyword => content.includes(keyword.toLowerCase())).length;
    score += Math.min(keywordMatches * 0.5, 3);
  }

  return score;
}

/**
 * Scores technology-specific matches
 */
function scoreTechnologyMatch(result: InternalDocSearchHit, analysis: QueryAnalysis): number {
  if (analysis.technologies.length === 0) return 0;
  
  let score = 0;
  const resultText = JSON.stringify(result).toLowerCase();

  // Special handling for React vs React Native disambiguation
  if (analysis.technologies.includes('react') && !analysis.technologies.includes('reactNative')) {
    // User wants React, not React Native
    if (/\breact(?![\s-]native)\b/.test(resultText) && !/\breact[\s-]native\b/.test(resultText)) {
      score += 3; // Bonus for React-only content
    }
  } else if (analysis.technologies.includes('reactNative')) {
    // User wants React Native
    if (/\breact[\s-]native\b/.test(resultText)) {
      score += 3; // Bonus for React Native content
    }
  }

  // Platform-specific boosting
  if (analysis.platform === 'web' && /\b(?:web|browser|dom|html|css)\b/.test(resultText)) {
    score += 1;
  } else if (analysis.platform === 'mobile' && /\b(?:mobile|ios|android|app)\b/.test(resultText)) {
    score += 1;
  } else if (analysis.platform === 'gaming' && /\b(?:game|gaming|unity|unreal)\b/.test(resultText)) {
    score += 1;
  }

  return score;
}

/**
 * Scores based on document type relevance
 */
function scoreDocumentType(result: InternalDocSearchHit, analysis: QueryAnalysis): number {
  let score = 0;
  const resultText = JSON.stringify(result).toLowerCase();

  // Match document type with user intent
  if (analysis.isHowTo || analysis.documentTypes.includes('guide')) {
    if (/\b(?:guide|tutorial|quickstart|getting[\s-]?started|example|how[\s-]?to)\b/.test(resultText)) {
      score += 2;
    }
  }

  if (analysis.isAPI || analysis.documentTypes.includes('api')) {
    if (/\b(?:api|reference|method|function|endpoint|parameter)\b/.test(resultText)) {
      score += 2;
    }
  }

  if (analysis.documentTypes.includes('sdk')) {
    if (/\b(?:sdk|library|package|installation|npm|yarn|pip|gradle|cocoapods)\b/.test(resultText)) {
      score += 2;
    }
  }

  if (analysis.isIntegration) {
    if (/\b(?:integration|integrate|connect|setup|configure|implementation)\b/.test(resultText)) {
      score += 1.5;
    }
  }

  return score;
}

/**
 * Scores exact and near-exact matches
 */
function scoreExactMatches(
  result: InternalDocSearchHit,
  normalizedQuery: string,
  queryWords: string[]
): number {
  let score = 0;
  
  // Check for exact query match in title
  if (result.hierarchy) {
    Object.values(result.hierarchy).forEach((value: any) => {
      if (typeof value === 'string' && value.toLowerCase() === normalizedQuery) {
        score += 5; // High bonus for exact match
      }
    });
  }

  // Check for all query words in order (phrase match)
  const resultText = JSON.stringify(result).toLowerCase();
  const queryPhrase = queryWords.join('\\s+');
  if (new RegExp(queryPhrase).test(resultText)) {
    score += 3;
  }

  // Check for all query words present (any order)
  const allWordsPresent = queryWords.every(word => resultText.includes(word));
  if (allWordsPresent) {
    score += 1;
  }

  return score;
}

/**
 * Calculates penalties for mismatched content
 */
function calculateMismatchPenalty(result: InternalDocSearchHit, analysis: QueryAnalysis): number {
  let penalty = 0;
  const resultText = JSON.stringify(result).toLowerCase();

  // Penalize React Native results when user wants React
  if (analysis.technologies.includes('react') && !analysis.technologies.includes('reactNative')) {
    if (/\breact[\s-]native\b/.test(resultText)) {
      penalty -= 5; // Significant penalty
    }
  }

  // Penalize wrong platform
  if (analysis.platform === 'web' && /\b(?:mobile|ios|android|native)\b/.test(resultText) && 
      !/\b(?:web|browser)\b/.test(resultText)) {
    penalty -= 2;
  } else if (analysis.platform === 'mobile' && /\b(?:web|browser|dom)\b/.test(resultText) && 
      !/\b(?:mobile|ios|android|native)\b/.test(resultText)) {
    penalty -= 2;
  }

  // Penalize wrong language
  if (analysis.language === 'javascript' && /\b(?:swift|kotlin|java|python)\b/.test(resultText) &&
      !/\b(?:javascript|js|typescript|ts)\b/.test(resultText)) {
    penalty -= 1;
  }

  return penalty;
}

/**
 * Processes search results to retrieve actual document content
 */
export async function retrieveDocumentContent(
  searchResults: InternalDocSearchHit[],
  query: string,
  options?: { includeLlmsFile?: boolean }
): Promise<string[]> {
  const logger = getLogger();
  const startTime = Date.now();
  
  logger.log(`Starting document content retrieval for query: "${query}"`);
  logger.logQuery(query, searchResults);
  
  if (!searchResults || searchResults.length === 0) {
    logger.log('No search results provided');
    return [];
  }

  // Take top 5 results for better coverage
  const topResults = searchResults.slice(0, 5);
  logger.log(`Processing top ${topResults.length} search results`);
  
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
      if (result.hierarchy.lvl4) content += `##### ${result.hierarchy.lvl4}\n`;
      if (result.hierarchy.lvl5) content += `###### ${result.hierarchy.lvl5}\n`;
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
    
    // Extract additional content from highlight results
    if (result._highlightResult) {
      // Extract highlighted content
      if (result._highlightResult.content?.value) {
        const highlightContent = result._highlightResult.content.value
          .replace(/<em>/g, "**")
          .replace(/<\/em>/g, "**")
          .replace(/<(?:.|\n)*?>/g, "");
        
        // Only add if it's different from snippet
        if (!result._snippetResult?.content?.value || 
            highlightContent !== result._snippetResult.content.value) {
          content += `${highlightContent}\n\n`;
        }
      }
      
      // Extract hierarchical content that might contain useful information
      if (result._highlightResult.hierarchy) {
        Object.entries(result._highlightResult.hierarchy).forEach(([level, data]: [string, any]) => {
          if (data?.value && !content.includes(data.value)) {
            const cleanValue = data.value
              .replace(/<em>/g, "**")
              .replace(/<\/em>/g, "**")
              .replace(/<(?:.|\n)*?>/g, "");
            content += `${cleanValue}\n`;
          }
        });
      }
    }
    
    if (content.trim() !== "") {
      contents.push(content);
      logger.log(`Extracted content from search result ${result.url} (${content.length} chars)`);
    }
  }
  
  logger.log(`Initial content extraction: ${contents.length} documents with content`);
  
  // Check if we have meaningful content
  const hasMinimalContent = contents.length === 0 || contents.some(content => {
    const lines = content.split('\n').filter(line => line.trim() !== '').length;
    return lines <= 5; // Just URL and title, no actual content
  });
  
  if (hasMinimalContent) {
    logger.log('Content seems minimal, attempting direct URL fetching...');
    
    // Fetch content from each document URL in parallel (fallback)
    const contentPromises = topResults.map(result => fetchDocumentContent(result.url));
    const fetchedContents = await Promise.all(contentPromises);
    
    // Process fetched content
    fetchedContents.forEach((fetchedContent, index) => {
      if (fetchedContent && fetchedContent.trim() !== "") {
        // Check if the fetched content is actually the homepage (common issue with Docusaurus)
        const isHomepage = fetchedContent.includes("Web3Auth Documentation") && 
                          fetchedContent.includes("Effortless Social Logins") &&
                          fetchedContent.includes("What is Web3Auth?");
        
        if (!isHomepage) {
          // We got real content, use it
          if (index < contents.length) {
            contents[index] += `\nAdditional fetched content:\n${fetchedContent}`;
            logger.log(`Appended fetched content to document ${index} (${fetchedContent.length} chars)`);
          } else {
            // Create new content entry
            let enhancedContent = "";
            const result = topResults[index];
            
            if (result.hierarchy) {
              if (result.hierarchy.lvl0) enhancedContent += `# ${result.hierarchy.lvl0}\n`;
              if (result.hierarchy.lvl1) enhancedContent += `## ${result.hierarchy.lvl1}\n`;
              if (result.hierarchy.lvl2) enhancedContent += `### ${result.hierarchy.lvl2}\n`;
              enhancedContent += "\n";
            }
            
            enhancedContent += `URL: ${result.url}\n\n`;
            enhancedContent += fetchedContent;
            
            contents.push(enhancedContent);
            logger.log(`Added new fetched content for document ${index} (${enhancedContent.length} chars)`);
          }
        } else {
          logger.log(`Skipping homepage content for document ${index}`);
          
          // If we don't have any content yet, generate fallback
          if (index >= contents.length || contents[index].split('\n').filter(l => l.trim()).length <= 5) {
            const fallbackContent = generateEnhancedFallbackForResult(topResults[index]);
            if (index < contents.length) {
              contents[index] = fallbackContent;
            } else {
              contents.push(fallbackContent);
            }
            logger.log(`Generated enhanced fallback for document ${index}`);
          }
        }
      }
    });
  }
  
  // 3. Check for llms.txt file if option is enabled
  if (options?.includeLlmsFile === true) {
    logger.log('Checking for llms.txt file...');
    try {
      const llmsResponse = await fetch('/llms.txt');
      if (llmsResponse.ok) {
        const llmsContent = await llmsResponse.text();
        if (llmsContent.trim() !== '') {
          // Add the llms.txt content to the beginning for higher priority
          contents.unshift(`--- LLMS CONTEXT FILE ---\n${llmsContent}\n--- END LLMS CONTEXT ---`);
          logger.log(`Added llms.txt content (${llmsContent.length} chars)`);
        }
      } else {
        logger.log('llms.txt file not found or not accessible');
      }
    } catch (error) {
      logger.logError('Failed to fetch llms.txt', error);
    }
  }
  
  // Final verification and enhancement
  const finalContents = contents.map((content, index) => {
    const lines = content.split('\n').filter(line => line.trim() !== '').length;
    
    // If content is still too minimal, enhance it with all available search data
    if (lines <= 5 && index < topResults.length) {
      logger.log(`Enhancing minimal content for document ${index}`);
      return generateEnhancedFallbackForResult(topResults[index]);
    }
    
    return content;
  });
  
  // Process and return non-empty content
  const processedContents = finalContents
    .filter(content => content.trim() !== '')
    .map(content => {
      // Chunk longer content to handle large documents
      const chunks = chunkText(content, 2000);
      return chunks[0]; // Use first chunk for simplicity
    });
  
  logger.logRAGContent(processedContents);
  logger.logPerformance('retrieveDocumentContent', startTime);
  
  return processedContents;
}

/**
 * Generates enhanced fallback content for a single search result
 */
function generateEnhancedFallbackForResult(result: InternalDocSearchHit): string {
  let content = "";
  
  // Build comprehensive content from all available data
  if (result.hierarchy) {
    if (result.hierarchy.lvl0) content += `# ${result.hierarchy.lvl0}\n`;
    if (result.hierarchy.lvl1) content += `## ${result.hierarchy.lvl1}\n`;
    if (result.hierarchy.lvl2) content += `### ${result.hierarchy.lvl2}\n`;
    if (result.hierarchy.lvl3) content += `#### ${result.hierarchy.lvl3}\n`;
    if (result.hierarchy.lvl4) content += `##### ${result.hierarchy.lvl4}\n`;
    if (result.hierarchy.lvl5) content += `###### ${result.hierarchy.lvl5}\n`;
    content += "\n";
  }
  
  content += `URL: ${result.url}\n\n`;
  
  // Add type information if available
  if (result.type) {
    content += `Type: ${result.type}\n\n`;
  }
  
  // Extract all available content
  const contentPieces: string[] = [];
  
  // Snippet content (usually the most relevant)
  if (result._snippetResult?.content?.value) {
    const snippet = result._snippetResult.content.value
      .replace(/<em>/g, "**")
      .replace(/<\/em>/g, "**")
      .replace(/<(?:.|\n)*?>/g, "");
    contentPieces.push(snippet);
  }
  
  // Full content
  if (result.content && !contentPieces.includes(result.content)) {
    contentPieces.push(result.content);
  }
  
  // Highlight content
  if (result._highlightResult?.content?.value) {
    const highlight = result._highlightResult.content.value
      .replace(/<em>/g, "**")
      .replace(/<\/em>/g, "**")
      .replace(/<(?:.|\n)*?>/g, "");
    
    if (!contentPieces.some(piece => piece.includes(highlight))) {
      contentPieces.push(highlight);
    }
  }
  
  // Add all unique content pieces
  if (contentPieces.length > 0) {
    content += "Content:\n";
    contentPieces.forEach((piece, idx) => {
      if (idx > 0) content += "\n";
      content += piece + "\n";
    });
  }
  
  // Add any additional metadata that might be useful
  const metadata: string[] = [];
  
  // Check for any other useful fields in the result
  Object.entries(result).forEach(([key, value]) => {
    if (
      !['hierarchy', 'url', 'content', '_snippetResult', '_highlightResult', 
       'objectID', 'type', '_rankingInfo', '_distinctSeqID'].includes(key) &&
      value && typeof value === 'string'
    ) {
      metadata.push(`${key}: ${value}`);
    }
  });
  
  if (metadata.length > 0) {
    content += "\nAdditional Information:\n";
    metadata.forEach(meta => content += `- ${meta}\n`);
  }
  
  return content;
}

/**
 * Fallback mechanism that provides search result information when document fetching fails
 */
export function generateFallbackContent(searchResults: InternalDocSearchHit[], query: string): string[] {
  const logger = getLogger();
  logger.log(`Generating fallback content for query: "${query}" with ${searchResults.length} search results`);
  
  if (!searchResults || searchResults.length === 0) {
    logger.log('No search results available for fallback content');
    return [];
  }

  // Use the top 5 results
  const topResults = searchResults.slice(0, 5);
  logger.log(`Using top ${topResults.length} results for fallback content`);

  const fallbackContents = topResults.map((result, index) => {
    const content = generateEnhancedFallbackForResult(result);
    logger.log(`Generated fallback content for result ${index + 1} (${result.url}): ${content.length} chars`);
    return content;
  });

  logger.log(`Generated ${fallbackContents.length} fallback content pieces`);
  return fallbackContents;
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
 * Creates the system prompt for the AI
 */
export function createSystemPrompt(options?: {
  systemPrompt?: string;
  siteName?: string;
  responseGuidelines?: string;
}): string {
  const logger = getLogger();
  
  // If a custom system prompt is provided, use it directly
  if (options?.systemPrompt) {
    logger.log('Using custom system prompt');
    return options.systemPrompt;
  }
  
  const siteName = options?.siteName || 'this documentation';
  const responseGuidelines = options?.responseGuidelines || `
- Be concise but comprehensive
- Use markdown formatting for better readability
- Include code examples when relevant
- Cite specific sections or pages when possible
- If information is not available in the provided context, say so clearly`;

  const systemPrompt = `You are a helpful AI assistant specialized in answering questions about ${siteName}. 
Your responses should be based solely on the documentation content provided to you.

Guidelines for your responses:
${responseGuidelines}

Remember: Only answer based on the provided documentation context. Do not make up information.`;

  logger.log('Generated system prompt with default template', { siteName, promptLength: systemPrompt.length });
  return systemPrompt;
}

/**
 * Creates the user prompt with document context
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
  const logger = getLogger();
  logger.log(`Creating user prompt for query: "${query}"`);
  
  // If a custom user prompt is provided, use it directly
  if (options?.userPrompt) {
    logger.log('Using custom user prompt template');
    return options.userPrompt
      .replace('{query}', query)
      .replace('{context}', documentContents.join('\n\n---\n\n'));
  }
  
  const maxDocs = options?.maxDocuments || 5;
  const relevantDocs = documentContents.slice(0, maxDocs);
  
  logger.log(`Including ${relevantDocs.length} documents in context (max: ${maxDocs})`);
  
  // Build context from documents
  let context = "Here is the relevant documentation content:\n\n";
  
  relevantDocs.forEach((content, index) => {
    context += `--- Document ${index + 1} ---\n`;
    context += content;
    context += "\n\n";
  });
  
  // Add search result URLs for reference
  if (searchResults.length > 0) {
    context += "Reference URLs:\n";
    searchResults.slice(0, maxDocs).forEach((result, index) => {
      const title = result.hierarchy?.lvl0 || result.hierarchy?.lvl1 || `Document ${index + 1}`;
      context += `- ${title}: ${result.url}\n`;
    });
  }
  
  const userPrompt = `${context}\n\nBased on the documentation above, please answer the following question:\n\n"${query}"`;
  
  logger.log('Generated user prompt', { 
    queryLength: query.length,
    contextLength: context.length,
    totalPromptLength: userPrompt.length,
    documentCount: relevantDocs.length
  });
  
  return userPrompt;
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