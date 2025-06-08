/**
 * Default configuration values for Docusaurus OpenAI Search
 */

export const DEFAULT_CONFIG = {
  maxSearchQueries: 5,
  enableCaching: true,
  cacheTTL: 3600, // 1 hour in seconds
  
  ui: {
    aiButtonText: 'Ask AI about "{query}"',
    modalTitle: 'AI Answer',
    errorText: 'Unable to generate an answer. Please try again later.',
    footerText: 'Powered by AI',
  },
  
  context: {
    siteName: 'this documentation',
    systemContext: '',
  },
  
  enableLogging: false,
}; 