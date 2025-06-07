// Example configuration for enhanced AI search with detailed query analysis

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
      openAI: {
        proxyUrl: 'https://your-proxy-server.com/api/chat', // Required: Your secure proxy URL
        model: 'gpt-4', // Optional: defaults to gpt-4
        maxTokens: 2000, // Optional: defaults to 2000
        temperature: 0.5, // Optional: defaults to 0.5
      },
      
      // Prompt configuration with system context
      prompts: {
        siteName: 'MyProduct',
        
        // This is the key addition - provide context about your product
        systemContext: `MyProduct is a modern data analytics platform that helps businesses 
        analyze and visualize their data. It includes features like:
        - Real-time dashboards
        - SQL query builder
        - Data pipeline management
        - API integrations
        - Custom reporting
        
        Common use cases include business intelligence, data warehousing, and analytics.`,
        
        maxDocuments: 10, // Will search and analyze up to 10 documents
      },
      
      // UI customization
      ui: {
        modalTitle: 'AI Assistant',
        loadingText: 'Analyzing your question and searching documentation...',
        retrievingText: 'Deep searching through documentation...',
        generatingText: 'Synthesizing information from multiple sources...',
      },
      
      // Enable intelligent search (default: true)
      intelligentSearch: true,
      
      // Enable detailed logging for debugging
      enableLogging: true,
      
      // Optional: Custom tracking function
      onAIQuery: (query, success) => {
        // Track AI queries in your analytics
        console.log('AI Query:', { query, success });
      },
    },
  },
}; 