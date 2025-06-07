# Intelligent Search Example

This example demonstrates how to configure and use the new intelligent search feature in Docusaurus OpenAI Search.

## Basic Configuration

```jsx
// In your SearchBar component
import React from 'react';
import { DocusaurusAISearch } from 'docusaurus-openai-search';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';

export default function SearchBar() {
  const {
    siteConfig: {
      themeConfig: { algolia },
    },
  } = useDocusaurusContext();

  const aiConfig = {
    openAI: {
      proxyUrl: "https://your-backend-url.com",
      model: "gpt-4",
      maxTokens: 10000,
      temperature: 0.3,
    },
    
    // Enable intelligent search (default: true)
    intelligentSearch: true,
    
    prompts: {
      siteName: "My Documentation",
      maxDocuments: 10, // Search through more documents
    },
    
    ui: {
      aiButtonText: "Ask AI",
      modalTitle: "AI Assistant",
      footerText: "Powered by Intelligent Search",
    },
    
    // Enable logging to see the search process
    enableLogging: true,
  };

  return <DocusaurusAISearch algoliaConfig={algolia} aiConfig={aiConfig} />;
}
```

## How It Works

When a user asks a question, the intelligent search:

### 1. Query Analysis
The AI first analyzes the query to understand:
- **Intent Type**: Is it a how-to question, troubleshooting, API reference, etc.?
- **Key Concepts**: What are the important terms to search for?
- **Alternative Queries**: What other ways might this information be documented?

### 2. Multi-Step Search
Based on the analysis, it performs multiple searches:
- Original query
- Generated alternative queries
- Keyword-based searches
- Intent-specific searches (e.g., "guide" + keyword for how-to questions)

### 3. Sitemap Integration
The system loads your site's sitemap to:
- Discover related pages that might not appear in search results
- Use document structure to find relevant content
- Prioritize pages based on sitemap priority

### 4. Content Ranking
Documents are scored based on:
- Query matches in content
- Keyword frequency
- Title relevance
- Intent-based scoring (e.g., guides score higher for how-to questions)

### 5. Progress Updates
Users see real-time updates:
- "Understanding your question..." (10%)
- "Loading documentation structure..." (20%)
- "Searching documentation..." (30-40%)
- "Finding related documentation..." (50%)
- "Retrieving documentation content..." (60%)
- "Generating AI response..." (100%)

## Example Queries

Here are some examples of how intelligent search improves results:

### Example 1: "How do I authenticate users?"
- **Intent**: How-to guide
- **Generated searches**: 
  - "authentication guide"
  - "user authentication tutorial"
  - "auth setup"
- **Discovers**: Authentication guides, security docs, API references

### Example 2: "Error: Module not found"
- **Intent**: Troubleshooting
- **Generated searches**:
  - "module not found error"
  - "fix module not found"
  - "import errors"
- **Discovers**: Troubleshooting guides, common errors, configuration docs

### Example 3: "What is the API for user management?"
- **Intent**: API reference
- **Generated searches**:
  - "user management api"
  - "api reference user"
  - "user endpoints"
- **Discovers**: API documentation, endpoints, examples

## Performance Considerations

While intelligent search provides better results, it may take slightly longer:
- **Simple search**: 2-3 seconds
- **Intelligent search**: 4-6 seconds

The trade-off is worth it for:
- More relevant results
- Better understanding of user intent
- Discovery of related content
- More comprehensive answers

## Disabling Intelligent Search

If you need faster, simpler search:

```jsx
const aiConfig = {
  // ... other config
  intelligentSearch: false, // Use simple Algolia-based search
};
```

This will revert to the original behavior where it only uses Algolia search results. 