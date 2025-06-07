// Example configuration for Docusaurus OpenAI Search

module.exports = {
  title: 'My Documentation Site',
  tagline: 'Documentation for MyProduct',
  
  themeConfig: {
    algolia: {
      appId: 'YOUR_ALGOLIA_APP_ID',
      apiKey: 'YOUR_ALGOLIA_API_KEY', 
      indexName: 'YOUR_INDEX_NAME',
    },
    
    // AI Search configuration
    aiSearch: {
      // Required: OpenAI configuration
      openAI: {
        proxyUrl: 'https://your-proxy-server.com/api/chat', // Required: Your secure proxy URL
        model: 'gpt-4', // Optional: defaults to gpt-4
        maxTokens: 2000, // Optional: defaults to 2000
        temperature: 0.5, // Optional: defaults to 0.5
      },
      
      // Optional: Prompt customization
      prompts: {
        siteName: 'MyProduct', // Used in AI prompts for better context
        
        // Optional: Additional context about your product/service
        systemContext: `MyProduct is a modern data analytics platform that helps businesses 
        analyze and visualize their data. It includes features like:
        - Real-time dashboards
        - SQL query builder
        - Data pipeline management
        - API integrations
        - Custom reporting
        
        Common use cases include business intelligence, data warehousing, and analytics.`,
        
        maxDocuments: 5, // Optional: Number of documents to analyze (default: 5)
      },
      
      // Optional: UI customization
      ui: {
        aiButtonText: 'Ask AI about "{query}"', // Optional: Button text with {query} placeholder
        modalTitle: 'AI Assistant', // Optional: Modal header title
        errorText: 'Unable to generate an answer. Please try again later.', // Optional: Error message
        footerText: 'Powered by AI • Using content from documentation', // Optional: Footer text
      },
      
      // Optional: Performance settings
      maxSearchQueries: 3, // Optional: Max search queries to perform (default: 3)
      enableCaching: true, // Optional: Enable response caching (default: true)
      cacheTTL: 3600, // Optional: Cache time-to-live in seconds (default: 3600)
      
      // Optional: Enable detailed logging for debugging
      enableLogging: false, // Set to true for debugging
      
      // Optional: Custom tracking function
      onAIQuery: (query, success) => {
        // Track AI queries in your analytics
        console.log('AI Query:', { query, success });
      },
    },
  },
}; 