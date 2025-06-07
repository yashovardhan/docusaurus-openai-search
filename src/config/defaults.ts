/**
 * Default configuration values for Docusaurus OpenAI Search
 */

export const DEFAULT_CONFIG = {
  openAI: {
    model: 'gpt-4',
    maxTokens: 2000,
    temperature: 0.5,
  },
  
  search: {
    maxDocuments: 10,
    intelligentSearch: true,
  },
  
  queryAnalysis: {
    model: 'gpt-3.5-turbo', // Use a smaller model for query analysis to save costs
    maxTokens: 500,
    temperature: 0.3,
  },
  
  research: {
    maxAICalls: 2,
    maxSearchQueries: 3,
    maxDocuments: 5,
    timeoutSeconds: 20,
    enableCaching: true,
    cacheTTL: 3600, // 1 hour in seconds
  },
  
  ui: {
    aiButtonText: 'Ask AI about "{query}"',
    aiButtonAriaLabel: 'Ask AI about this question',
    modalTitle: 'AI Answer',
    loadingText: 'Generating answer based on documentation...',
    errorText: 'Unable to generate an answer. Please try again later.',
    retryButtonText: 'Retry Query',
    footerText: 'Powered by AI • Using content from documentation',
    retrievingText: 'Retrieving document content...',
    generatingText: 'Generating AI response...',
  },
  
  prompts: {
    siteName: 'this documentation',
    maxDocuments: 5,
    highlightCode: false,
    includeLlmsFile: true,
    useSummarization: false,
  },
  
  logging: {
    enabled: false,
  },
};

/**
 * System prompt for query intent analysis
 */
export const QUERY_ANALYSIS_SYSTEM_PROMPT = `You are a query analyzer. Analyze the user's documentation search query and return a JSON response with:
1. type: one of 'how-to', 'concept', 'troubleshooting', 'api-reference', or 'general'
2. keywords: array of important keywords/concepts to search for
3. suggestedSearches: array of 2-3 alternative search queries that might find relevant content

Be concise and focus on extracting searchable terms.`;

/**
 * Enhanced system prompt for deep query analysis
 */
export const ENHANCED_QUERY_ANALYSIS_SYSTEM_PROMPT = `You are an intelligent documentation search assistant. Your task is to analyze the user's query and determine the best search strategy.

Given the user's question, you should:
1. Understand what the user is really asking about - look for the core intent
2. Identify the key concepts, terms, and topics they want to learn about
3. Generate up to 5 specific search queries that will help find the most relevant documentation
4. Think about synonyms, related concepts, and different ways the documentation might describe the same thing
5. For technical queries, include both the specific technology/framework AND the general concept

Return a JSON response with:
{
  "type": "how-to" | "concept" | "troubleshooting" | "api-reference" | "general",
  "keywords": ["keyword1", "keyword2", ...], // Up to 5 keywords/phrases
  "suggestedSearches": ["search query 1", "search query 2", ...], // Up to 5 search queries, ordered by relevance
  "explanation": "Brief explanation of what you understood and why you chose these keywords"
}

Examples:
- For "how to integrate in react", generate searches like: ["react integration", "react setup", "react hooks", "react components", "getting started react"]
- For "authentication error", generate searches like: ["authentication error", "auth troubleshooting", "login issues", "authentication setup", "auth configuration"]

Consider variations, synonyms, and related concepts. Think about what documentation pages would best answer the user's question.`;

/**
 * Common documentation URL patterns for sitemap discovery
 */
export const COMMON_DOC_PATTERNS = [
  '/docs',
  '/docs/getting-started',
  '/docs/api',
  '/docs/guides',
  '/api',
  '/tutorials',
  '/documentation',
  '/guide',
  '/reference',
];

/**
 * Sitemap URL patterns to try
 */
export const SITEMAP_PATTERNS = [
  '/sitemap.xml',
  '/sitemap/sitemap-0.xml',
  '/sitemap-index.xml',
  '/sitemap_index.xml',
];

/**
 * HTML elements to remove when extracting content
 */
export const CONTENT_EXCLUSION_SELECTORS = [
  'script',
  'style',
  'nav',
  '.navbar',
  '.sidebar',
  '.pagination',
  '.tocCollapsible',
  '.tableOfContents',
  'footer',
  '.theme-doc-footer',
  '.theme-doc-version-badge',
  '.theme-doc-breadcrumbs',
];

/**
 * HTML selectors for finding main content
 */
export const MAIN_CONTENT_SELECTORS = [
  'article',
  'main',
  '.markdown',
  '.theme-doc-markdown',
  '[class*="docItemContainer"]',
  '.docusaurus-mt-lg', // Common Docusaurus content container
]; 