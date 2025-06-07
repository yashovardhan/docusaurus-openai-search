# Docusaurus OpenAI Search Configuration Example

This example shows how to configure the deep research features for AI-powered documentation search.

## Basic Configuration

```javascript
// In your docusaurus.config.js
module.exports = {
  // ... other config ...
  
  presets: [
    [
      '@docusaurus/preset-classic',
      {
        theme: {
          customCss: require.resolve('./src/css/custom.css'),
        },
      },
    ],
  ],

  themes: [
    [
      'docusaurus-openai-search',
      {
        // OpenAI Configuration (Required)
        openAI: {
          proxyUrl: 'https://your-proxy-url.com/api/chat', // Required: Your backend proxy URL
          model: 'gpt-4',                                  // Optional: Defaults to 'gpt-4'
          maxTokens: 2000,                                 // Optional: Defaults to 2000
          temperature: 0.5,                                // Optional: Defaults to 0.5
        },

        // Research Configuration (Optional)
        research: {
          maxAICalls: 3,          // Maximum AI calls per search (default: 3)
          maxSearchQueries: 5,    // Maximum Algolia searches (default: 5)
          maxDocuments: 10,       // Maximum documents to analyze (default: 10)
          timeoutSeconds: 30,     // Total timeout in seconds (default: 30)
          enableCaching: true,    // Enable response caching (default: true)
          cacheTTL: 3600,        // Cache time-to-live in seconds (default: 3600 = 1 hour)
        },

        // Enable intelligent search (Optional)
        intelligentSearch: true,  // Enable deep research mode (default: true)

        // UI Customization (Optional)
        ui: {
          aiButtonText: 'Ask AI about "{query}"',
          aiButtonAriaLabel: 'Ask AI about this question',
          modalTitle: 'AI Answer',
          loadingText: 'Analyzing documentation...',
          errorText: 'Unable to generate an answer. Please try again.',
          retryButtonText: 'Try Again',
          footerText: 'Powered by AI',
          retrievingText: 'Retrieving relevant documents...',
          generatingText: 'Generating comprehensive answer...',
        },

        // Prompt Customization (Optional)
        prompts: {
          siteName: 'React Documentation',  // Your documentation name
          systemContext: 'React is a JavaScript library for building user interfaces', // Additional context
          maxDocuments: 10,                 // Documents to include in AI context
        },

        // Analytics (Optional)
        onAIQuery: (query, success) => {
          // Track AI queries in your analytics
          if (window.gtag) {
            window.gtag('event', 'ai_search', {
              query: query,
              success: success,
            });
          }
        },

        // Debugging (Optional)
        enableLogging: false,  // Enable console logging for debugging
      },
    ],
  ],
};
```

## Performance-Optimized Configuration

For faster responses with efficient resource usage:

```javascript
{
  openAI: {
    proxyUrl: 'https://your-proxy-url.com/api/chat',
    model: 'gpt-3.5-turbo',    // Faster model
    maxTokens: 1000,           // Reduced tokens for speed
    temperature: 0.3,          // More deterministic
  },
  
  research: {
    maxAICalls: 2,             // Only query analysis + synthesis
    maxSearchQueries: 3,       // Fewer searches
    maxDocuments: 5,           // Analyze fewer documents
    timeoutSeconds: 20,        // Shorter timeout
    enableCaching: true,       // Always cache
    cacheTTL: 7200,           // 2 hour cache
  },
}
```

## High-Quality Configuration

For the most comprehensive results:

```javascript
{
  openAI: {
    proxyUrl: 'https://your-proxy-url.com/api/chat',
    model: 'gpt-4-turbo',      // Latest model
    maxTokens: 3000,           // More comprehensive answers
    temperature: 0.7,          // More creative
  },
  
  research: {
    maxAICalls: 4,             // Allow refinement
    maxSearchQueries: 8,       // More thorough search
    maxDocuments: 15,          // Analyze more content
    timeoutSeconds: 45,        // Allow more time
    enableCaching: true,       // Still cache for efficiency
    cacheTTL: 1800,           // 30 minute cache
  },
}
```

## Understanding the Research Process

With the deep research configuration, here's what happens when a user asks a question:

1. **Query Analysis** (AI Call #1)
   - Analyzes user intent
   - Generates targeted search queries
   - Identifies key concepts and related topics

2. **Multi-Faceted Search** (No AI calls)
   - Performs multiple Algolia searches
   - Retrieves relevant documents
   - Ranks results by relevance

3. **Content Synthesis** (AI Call #2)
   - Analyzes retrieved documents
   - Generates comprehensive answer
   - Includes source references

4. **Optional Refinement** (AI Call #3, if needed)
   - Only if initial results are poor
   - Refines search strategy
   - Improves answer quality

## Monitoring and Debugging

Enable logging to see the research process:

```javascript
{
  enableLogging: true,
  
  onAIQuery: (query, success) => {
    console.log('AI Query:', {
      query,
      success,
      timestamp: new Date().toISOString(),
    });
  },
}
```

This will show:
- Query analysis results
- Search queries generated
- Documents retrieved
- AI call count
- Cache hits/misses
- Total processing time 