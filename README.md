# Docusaurus OpenAI Search

AI-enhanced search component for Docusaurus using OpenAI's API to provide AI-powered answers based on your documentation content.

## Features

- Drop-in replacement for Docusaurus's default Algolia DocSearch
- AI-powered answer generation based on search results
- Extracts content from documentation pages for contextual answers
- Customizable prompts, models, and UI
- Full TypeScript support

## Installation

```bash
npm install docusaurus-openai-search
```

## Setup

### 1. Configure your Docusaurus config

Add your OpenAI API key to your `docusaurus.config.js` file:

```js
module.exports = {
  // ...other config
  customFields: {
    // Optional: Make available to browser
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  },
  scripts: [
    // Make API key available to the client
    {
      src: '/docusaurus-openai-search.js',
      async: true,
    },
  ],
  // ...rest of your configuration
};
```

### 2. Create a script to expose the OpenAI API key

Create a file at `static/docusaurus-openai-search.js`:

```js
// This makes the API key available to the client-side code
window.OPENAI_API_KEY = '%OPENAI_API_KEY%';
```

### 3. Add the swizzled theme component

Create a file at `src/theme/SearchBar/index.js`:

```jsx
import React from 'react';
import { DocusaurusAISearch } from 'docusaurus-openai-search';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';

export default function SearchBar() {
  const { 
    siteConfig: { 
      themeConfig: { algolia },
      customFields,
    },
  } = useDocusaurusContext();

  // AI search configuration
  const aiConfig = {
    // OpenAI API settings
    openAI: {
      apiKey: customFields.OPENAI_API_KEY,
      model: 'gpt-4.1',
      maxTokens: 2000,
      temperature: 0.5,
    },
    // UI customization
    ui: {
      aiButtonText: 'Ask AI about this',
      modalTitle: 'AI Answer',
      footerText: 'Powered by Your Site Name AI',
    },
    // Prompt customization
    prompts: {
      siteName: 'Your Site Name',
      // Optional: custom system prompt
      // systemPrompt: 'Your custom system prompt',
      // Optional: custom user prompt template
      // userPrompt: 'Your custom user prompt with {query}, {context}, and {sources} variables',
    },
  };

  return <DocusaurusAISearch 
    algoliaConfig={algolia} 
    aiConfig={aiConfig} 
  />;
}
```

## Configuration Options

The `DocusaurusAISearch` component accepts two props:

### `algoliaConfig` (required)

This contains the Algolia DocSearch configuration from your Docusaurus config:

```typescript
interface AlgoliaConfig {
  appId: string;
  apiKey: string;
  indexName: string;
  contextualSearch?: boolean;
  searchPagePath?: string | boolean;
  externalUrlRegex?: string;
  searchParameters?: Record<string, any>;
  transformItems?: (items: any[]) => any[];
  placeholder?: string;
  translations?: {
    button?: {
      buttonText?: string;
      buttonAriaLabel?: string;
    };
    modal?: Record<string, any>;
  };
}
```

### `aiConfig` (optional)

This controls the AI-powered search features:

```typescript
interface DocusaurusAISearchConfig {
  // OpenAI API settings
  openAI?: {
    apiKey?: string;
    model?: string;
    maxTokens?: number;
    temperature?: number;
  };
  
  // UI text and appearance
  ui?: {
    aiButtonText?: string;
    aiButtonAriaLabel?: string;
    modalTitle?: string;
    loadingText?: string;
    errorText?: string;
    retryButtonText?: string;
    footerText?: string;
    retrievingText?: string;
    generatingText?: string;
  };
  
  // Prompt handling
  prompts?: {
    systemPrompt?: string;
    userPrompt?: string;
    siteName?: string;
    maxDocuments?: number;
    highlightCode?: boolean;
  };
  
  // General settings
  enabled?: boolean;
  onAIQuery?: (query: string, success: boolean) => void;
}
```

## Customizing Prompts

You can fully customize the system and user prompts:

```js
prompts: {
  // Site name used in default prompts
  siteName: 'Your Product',
  
  // Custom system prompt (instruction to the AI)
  systemPrompt: `You are a helpful assistant for the Product documentation. 
  Provide concise, accurate answers based on the documentation content.`,
  
  // Custom user prompt with variables that will be replaced:
  // {query} - the user's search query
  // {context} - the extracted documentation content
  // {sources} - references to the source documentation
  userPrompt: `Answer this question: {query}
  
  Here's relevant documentation:
  {context}
  
  Sources:
  {sources}
  
  Keep your answer under 300 words and include code examples when available.`,
  
  // Maximum number of documents to include in the context
  maxDocuments: 3,
  
  // Whether to highlight code blocks separately in the context
  highlightCode: true
}
```

## Security Considerations

- Never expose your OpenAI API key directly in client-side code without rate limiting
- Consider implementing a server-side proxy for OpenAI requests
- Set usage limits on your OpenAI API key

## License

MIT

## Credits

Built on top of Docusaurus and Algolia DocSearch.
