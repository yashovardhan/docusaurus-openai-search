// Example: Using enableLogging for debugging

import React from "react";
import { DocusaurusAISearch } from "docusaurus-openai-search";
import useDocusaurusContext from "@docusaurus/useDocusaurusContext";

export default function SearchBar() {
  const {
    siteConfig: {
      themeConfig: { algolia },
    },
  } = useDocusaurusContext();

  // Check if we're in development mode
  const isDevelopment = process.env.NODE_ENV === 'development';

  // AI search configuration with conditional logging
  const aiConfig = {
    // OpenAI API settings
    openAI: {
      proxyUrl: process.env.REACT_APP_PROXY_URL || "https://your-backend-url.com",
      model: "gpt-4",
      maxTokens: 10000,
      temperature: 0.3,
    },
    
    // UI customization
    ui: {
      aiButtonText: "Ask AI",
      modalTitle: "AI Assistant",
      footerText: "Powered by AI",
      loadingText: "Searching documentation and generating answer...",
      errorText: "Unable to generate an answer. Please try again.",
      retrievingText: "Retrieving relevant documentation...",
      generatingText: "Generating AI response...",
    },
    
    // Prompt customization
    prompts: {
      siteName: "Your Documentation",
      maxDocuments: 5,
      highlightCode: true,
      includeLlmsFile: true,
      useSummarization: true,
    },
    
    // Enable logging only in development
    enableLogging: isDevelopment,
    
    // Optional: Custom analytics callback
    onAIQuery: (query, success) => {
      if (isDevelopment) {
        console.log(`AI Query Analytics: "${query}" - Success: ${success}`);
      }
      
      // Send to your analytics service
      if (window.gtag) {
        window.gtag('event', 'ai_search', {
          event_category: 'search',
          event_label: query,
          value: success ? 1 : 0,
        });
      }
    },
  };
  
  return <DocusaurusAISearch themeConfig={{ algolia }} aiConfig={aiConfig} />;
}

// Example of what you'll see in the console when enableLogging is true:
/*
[AI Search] Starting document content retrieval for query: "how to install"
[AI Search] Query: "how to install"
  Number of search results: 5
  Search results: [
    {
      index: 0,
      url: '/docs/getting-started/installation',
      title: 'Installation Guide',
      snippet: 'Install the package using npm...'
    },
    {
      index: 1,
      url: '/docs/quick-start',
      title: 'Quick Start',
      snippet: 'Get started quickly with our installation wizard...'
    },
    // ... more results
  ]
[AI Search] Processing top 5 search results
[AI Search] Fetching document content from: /docs/getting-started/installation
[AI Search] Converted URL to path: /docs/getting-started/installation
[AI Search] Final path for fetching: /docs/getting-started/installation/index.html
[AI Search] Content Retrieval: /docs/getting-started/installation
  Success: true
  Content length: 3456
  Content preview: # Installation Guide

To install our package, you can use npm, yarn, or pnpm:

## Using npm

```bash
npm install your-package-name
```

## Using yarn

```bash
yarn add your-package-name
```

## Using pnpm...
[AI Search] Performance - fetchDocumentContent(/docs/getting-started/installation): 145ms
[AI Search] Extracted content from search result /docs/getting-started/installation (3456 chars)
[AI Search] Initial content extraction: 5 documents with content
[AI Search] Checking for llms.txt file...
[AI Search] Added llms.txt content (1234 chars)
[AI Search] Content verification: [
  { length: 1234, lines: 45 },
  { length: 3456, lines: 89 },
  { length: 2345, lines: 67 },
  { length: 1890, lines: 54 },
  { length: 2678, lines: 72 }
]
[AI Search] RAG Content Preparation
  Number of documents: 5
  Document 1: { length: 1234, preview: '--- LLMS CONTEXT FILE ---\nYour Product Name is a modern...' }
  Document 2: { length: 3456, preview: '# Installation Guide\n\nTo install our package...' }
  Document 3: { length: 2345, preview: '# Quick Start\n\nGet started quickly with...' }
  Document 4: { length: 1890, preview: '# Configuration\n\nConfigure your installation...' }
  Document 5: { length: 2678, preview: '# Troubleshooting\n\nCommon installation issues...' }
[AI Search] Performance - retrieveDocumentContent: 523ms
[AI Search] Creating user prompt for query: "how to install"
[AI Search] Including 5 documents in context (max: 5)
[AI Search] Generated user prompt
  queryLength: 14
  contextLength: 11603
  totalPromptLength: 11617
  documentCount: 5
[AI Search] Using custom system prompt
[AI Search] Creating chat completion through proxy
  model: gpt-4
  messageCount: 2
  maxTokens: 10000
  temperature: 0.3
[AI Search] Prompt Generation
  System Prompt: You are a helpful AI assistant specialized in answering questions about Your Documentation...
  User Prompt: Here is the relevant documentation content:

--- Document 1 ---
--- LLMS CONTEXT FILE ---
Your Product Name is a modern...

--- Document 2 ---
# Installation Guide
...
  Total prompt length: 12845
[AI Search] API Request to https://your-backend-url.com/api/chat/completions
  Payload: {
    model: 'gpt-4',
    messages: [
      { role: 'system', content: 'You are a helpful AI assistant...' },
      { role: 'user', content: 'Here is the relevant documentation content...' }
    ],
    max_tokens: 10000,
    temperature: 0.3
  }
[AI Search] API Response
  Response: {
    id: 'chatcmpl-abc123',
    object: 'chat.completion',
    created: 1234567890,
    model: 'gpt-4-0613',
    choices: [{
      index: 0,
      message: {
        role: 'assistant',
        content: 'To install the package, you have several options:\n\n## Using npm\n\n```bash\nnpm install your-package-name\n```\n\n## Using yarn\n\n```bash\nyarn add your-package-name\n```\n\n## Using pnpm\n\n```bash\npnpm add your-package-name\n```\n\nAfter installation, you can verify it was successful by checking your `package.json` file...'
      },
      finish_reason: 'stop'
    }],
    usage: {
      prompt_tokens: 2456,
      completion_tokens: 234,
      total_tokens: 2690
    }
  }
  Generated answer length: 567
[AI Search] Performance - Proxy request to /api/chat/completions: 3456ms
[AI Search] AI Query Analytics: "how to install" - Success: true
*/ 