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