module.exports = {
  // Backend configuration (required)
  backend: {
    // URL of your backend service that handles all AI operations
    url: 'https://your-backend-service.com',
  },
  
  // Optional: Advanced AI features (Stage 2)
  features: {
    // Conversational memory for context-aware follow-up questions
    conversationalMemory: {
      enabled: true,
      sessionDuration: 3600, // Session duration in seconds (default: 1 hour)
    },
    
    // Multi-source search (GitHub, blog, changelog integration)
    multiSource: {
      enabled: true,
      // GitHub integration for issues and discussions
      github: {
        repo: 'owner/repository-name', // Your GitHub repository
        // Note: GitHub Personal Access Token should be configured in the backend environment
        // as GITHUB_TOKEN for security reasons
        searchTypes: ['issues', 'discussions'], // What to search
        maxResults: 5, // Max results from GitHub (default: 5)
      },
      // Blog search integration
      blog: {
        url: 'https://blog.example.com',
        platform: 'wordpress', // 'wordpress', 'ghost', 'medium', or 'generic'
        maxResults: 3, // Max blog posts to include (default: 3)
      },
      // Changelog integration
      changelog: {
        url: 'https://changelog.example.com',
        format: 'markdown', // 'markdown', 'json', or 'rss'
        maxResults: 2, // Max changelog entries (default: 2)
      },
      // Source weighting for result aggregation
      aggregationWeights: {
        documentation: 0.5, // Primary weight for docs
        github: 0.3, // Secondary weight for GitHub
        blog: 0.15, // Tertiary weight for blog
        changelog: 0.05, // Minimal weight for changelog
      },
    },
    
    // Other advanced features
    queryUnderstanding: true, // Enhanced query analysis (default: true)
    intelligentRanking: true, // Smart result ranking (default: true)
    followUpSuggestions: true, // Generate follow-up questions (default: true)
    qualityScoring: true, // Answer quality assessment (default: true)
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
  
  // Optional: Callback for user feedback on answers
  onFeedback: (query, rating, queryType) => {
    // Track user satisfaction, improve prompts, etc.
    console.log('User feedback:', { query, rating, queryType });
  },
  
  // Optional: reCAPTCHA configuration for bot protection
  recaptcha: {
    // Your Google reCAPTCHA v3 site key
    siteKey: 'your-recaptcha-site-key-here',
    // Get your keys from: https://www.google.com/recaptcha/admin/
  },
}; 