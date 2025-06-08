module.exports = {
  // Backend configuration (required)
  backend: {
    // URL of your backend service that handles all AI operations
    url: 'https://your-backend-service.com',
  },
  
  // Optional: UI customization
  ui: {
    // Text shown on the AI search button
    aiButtonText: 'Ask AI about "{query}"',
    
    // Title of the AI answer modal
    modalTitle: 'AI Answer',
    
    // Error message when AI fails
    errorText: 'Unable to generate an answer. Please try again.',
    
    // Footer text in the modal
    footerText: 'Powered by AI',
    
    // Loading/Progress messages
    loadingText: 'Generating answer based on documentation...',
    retrievingText: 'Retrieving document content...',
    generatingText: 'Generating AI response...',
    
    // Button labels
    retryButtonText: 'Retry Query',
    closeButtonAriaLabel: 'Close AI answer modal',
    aiButtonAriaLabel: 'Ask AI about this question',
    
    // Question display
    questionPrefix: 'Q:',
    
    // Search progress labels
    searchKeywordsLabel: 'Search keywords:',
    documentsFoundLabel: 'Documents found: {count}',
    documentsMoreText: '...and {count} more',
    
    // Sources section
    sourcesHeaderText: 'Sources:',
    
    // Error state messages
    searchLinksHelpText: 'You might find these search results helpful:',
    noDocumentsFoundError: 'Could not find any relevant documentation for your query',
    noSearchResultsError: 'No search results available to retrieve content from',
    
    // Footer indicators
    cachedResponseText: 'Retrieved from cache',
    documentsAnalyzedText: '{count} documents analyzed',
    searchResultsOnlyText: '(search results only)',
    
    // Search results link
    seeAllResultsText: 'See all {count} results',
    
    // Search button customization
    searchButtonText: 'Search',
    searchButtonAriaLabel: 'Search documentation',
    searchInputPlaceholder: 'Search docs',
    searchButtonClassName: 'custom-search-button',
    showSearchButtonShortcut: true,
    
    // Use custom search button for complete control over button rendering
    // Set to true if the default button text/styling doesn't update properly
    useCustomSearchButton: false,
  },
  
  // Optional: Context to send to backend
  context: {
    // Name of your site/product
    siteName: 'My Documentation',
    
    // Additional context about your product to help AI understand queries better
    systemContext: 'This is documentation for a React component library that helps developers build accessible UI components.',
  },
  
  // Optional: Search configuration
  maxSearchQueries: 5, // Maximum keywords to request from backend (default: 5)
  
  // Optional: Caching configuration
  enableCaching: true, // Enable response caching (default: true)
  cacheTTL: 3600, // Cache time-to-live in seconds (default: 3600 = 1 hour)
  
  // Optional: Enable for development/debugging
  enableLogging: false,
  
  // Optional: Callback when AI query is made
  onAIQuery: (query, success) => {
    // Track AI usage, analytics, etc.
    console.log('AI Query:', query, 'Success:', success);
  },
}; 