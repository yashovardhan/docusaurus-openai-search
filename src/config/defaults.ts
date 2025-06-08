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
    loadingText: 'Generating answer based on documentation...',
    retryButtonText: 'Retry Query',
    questionPrefix: 'Q:',
    searchKeywordsLabel: 'Search keywords:',
    documentsFoundLabel: 'Documents found: {count}',
    documentsMoreText: '...and {count} more',
    sourcesHeaderText: 'Sources:',
    searchLinksHelpText: 'You might find these search results helpful:',
    seeAllResultsText: 'See all {count} results',
    closeButtonAriaLabel: 'Close AI answer modal',
    retrievingText: 'Retrieving document content...',
    generatingText: 'Generating AI response...',
    cachedResponseText: 'Retrieved from cache',
    documentsAnalyzedText: '{count} documents analyzed',
    searchResultsOnlyText: '(search results only)',
    aiButtonAriaLabel: 'Ask AI about this question',
    noDocumentsFoundError: 'Could not find any relevant documentation for your query',
    noSearchResultsError: 'No search results available to retrieve content from',
    
    // Search button customization
    searchButtonText: 'Search',
    searchButtonAriaLabel: 'Search',
    searchInputPlaceholder: 'Search docs',
    searchButtonClassName: '',
    showSearchButtonShortcut: true,
    useCustomSearchButton: false,
  },
  
  context: {
    siteName: 'this documentation',
    systemContext: '',
  },
  
  enableLogging: false,
}; 