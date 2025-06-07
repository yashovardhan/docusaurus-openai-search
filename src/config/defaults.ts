/**
 * Default configuration values for Docusaurus OpenAI Search
 */

export const DEFAULT_CONFIG = {
  openAI: {
    model: 'gpt-4',
    maxTokens: 2000,
    temperature: 0.5,
  },
  
  maxSearchQueries: 3,
  enableCaching: true,
  cacheTTL: 3600, // 1 hour in seconds
  
  ui: {
    aiButtonText: 'Ask AI about "{query}"',
    modalTitle: 'AI Answer',
    errorText: 'Unable to generate an answer. Please try again later.',
    footerText: 'Powered by AI • Using content from documentation',
  },
  
  prompts: {
    siteName: 'this documentation',
    maxDocuments: 5,
  },
  
  enableLogging: false,
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
 * Enhanced system prompt for intelligent query analysis
 */
export const ENHANCED_QUERY_ANALYSIS_PROMPT = `You are an intelligent documentation search assistant. Your task is to analyze the user's query and determine the best search strategy.

Given the user's question, you should:
1. Understand what the user is really asking about - look for the core intent
2. Identify the key concepts, terms, and topics they want to learn about  
3. Generate up to 5 specific search queries that will help find the most relevant documentation
4. Think about synonyms, related concepts, and different ways the documentation might describe the same thing
5. For technical queries, include both the specific technology/framework AND the general concept

Return a JSON response with ONLY an array of search queries, ordered by relevance.

Examples:
- For "how to integrate with React", return: ["react integration", "react setup", "react hooks", "react components", "getting started react"]
- For "authentication error", return: ["authentication error", "auth troubleshooting", "login issues", "authentication setup", "auth configuration"]
- For "deploy to production", return: ["production deployment", "deploy guide", "deployment configuration", "production setup", "deployment checklist"]

Consider variations, synonyms, and related concepts. Think about what documentation pages would best answer the user's question.`;

// Removed unused constants:
// - ENHANCED_QUERY_ANALYSIS_SYSTEM_PROMPT (not used after simplification)
// - COMMON_DOC_PATTERNS (sitemap discovery removed)
// - SITEMAP_PATTERNS (sitemap parsing removed)
// - CONTENT_EXCLUSION_SELECTORS (HTML parsing removed)
// - MAIN_CONTENT_SELECTORS (HTML parsing removed) 