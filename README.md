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
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  },
  scripts: [
    {
      src: '/docusaurus-openai-search.js',
      async: true,
    },
  ],
};
```

### 2. Create a script to expose the OpenAI API key

Create a file at `static/docusaurus-openai-search.js`:

```js
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

  const aiConfig = {
    openAI: {
      apiKey: customFields.OPENAI_API_KEY,
      model: 'gpt-4.1',
      maxTokens: 2000,
      temperature: 0.5,
    },
    ui: {
      aiButtonText: 'Ask AI about this',
      modalTitle: 'AI Answer',
    },
    prompts: {
      siteName: 'Your Site Name',
    },
  };

  return <DocusaurusAISearch 
    algoliaConfig={algolia} 
    aiConfig={aiConfig} 
  />;
}
```

## API Reference

### DocusaurusAISearch Component

The main component that replaces the default Docusaurus search component.

#### Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `algoliaConfig` | object | Yes | Algolia DocSearch configuration |
| `aiConfig` | object | No | AI search configuration options |

### AlgoliaConfig Object

The `algoliaConfig` prop contains all the standard Algolia DocSearch configuration options:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `appId` | string | Yes | Algolia application ID |
| `apiKey` | string | Yes | Algolia search-only API key |
| `indexName` | string | Yes | Name of the Algolia index to search |
| `contextualSearch` | boolean | No | Enable search based on the current context (default: `false`) |
| `searchPagePath` | string \| boolean | No | Path to the search page or `false` to disable |
| `externalUrlRegex` | string | No | Regular expression for identifying external URLs |
| `searchParameters` | object | No | Additional search parameters passed to Algolia |
| `transformItems` | function | No | Function to transform search results before display |
| `placeholder` | string | No | Placeholder text for the search input |
| `translations` | object | No | Text translations for UI elements |

### AIConfig Object

The `aiConfig` prop configures the AI-powered search features:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `openAI` | object | No | OpenAI API settings |
| `ui` | object | No | UI customization options |
| `prompts` | object | No | Prompt generation and content handling options |
| `enabled` | boolean | No | Enable or disable AI search features (default: `true`) |
| `onAIQuery` | function | No | Callback function when an AI query is made |

### OpenAI Options

The `openAI` object configures the OpenAI API settings:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `apiKey` | string | No | OpenAI API key (falls back to `window.OPENAI_API_KEY`) |
| `model` | string | No | Model to use for AI search queries (default: `gpt-4.1`) |
| `maxTokens` | number | No | Maximum tokens to use in AI requests (default: `2000`) |
| `temperature` | number | No | Temperature for AI responses from 0-1 (default: `0.5`) |

### UI Options

The `ui` object customizes the appearance and text of UI elements:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `aiButtonText` | string | No | Custom text for the AI button (default: `Ask AI about "query"`) |
| `aiButtonAriaLabel` | string | No | ARIA label for the AI button (default: `Ask AI about this question`) |
| `modalTitle` | string | No | Title of the AI modal (default: `AI Answer`) |
| `loadingText` | string | No | Loading text in the AI modal (default: `Generating answer based on documentation...`) |
| `errorText` | string | No | Error text when AI generation fails (default: `Unable to generate an answer. Please try again later.`) |
| `retryButtonText` | string | No | Text for retry button (default: `Retry Query`) |
| `footerText` | string | No | Footer text in the AI modal (default: `Powered by AI • Using content from documentation`) |
| `retrievingText` | string | No | Text shown when retrieving document content (default: `Retrieving document content...`) |
| `generatingText` | string | No | Text shown when generating AI response (default: `Generating AI response...`) |

### Prompt Options

The `prompts` object configures how prompts are generated for the AI:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `systemPrompt` | string | No | Custom system prompt template to replace the default one |
| `userPrompt` | string | No | Custom user prompt template to replace the default one |
| `siteName` | string | No | Name of your site or product to use in default prompts (default: `Documentation`) |
| `maxDocuments` | number | No | Maximum number of documents to include in context (default: `4`) |
| `highlightCode` | boolean | No | Whether to include code blocks separately in the prompt |

### Event Callbacks

| Function | Parameters | Description |
|----------|------------|-------------|
| `onAIQuery` | `(query: string, success: boolean) => void` | Called when an AI query is made. `query` is the search string, `success` indicates whether the query was successful |

## Custom Prompt Templates

You can fully customize the system and user prompts with custom templates.

### System Prompt

The default system prompt (when no custom prompt is provided):

```
You are a helpful {siteName} assistant. Your goal is to provide detailed, accurate information about {siteName} based on the documentation provided.

RESPONSE GUIDELINES:
1. BE HELPFUL: Always try to provide SOME guidance, even when the documentation doesn't contain a perfect answer.
2. PRIORITIZE USER SUCCESS: Focus on helping the user accomplish their task.
3. USE DOCUMENTATION FIRST: Base your answers primarily on the provided documentation snippets.
4. CODE EXAMPLES ARE CRUCIAL: Always include code snippets from the documentation when available.
5. INFERENCE IS ALLOWED: When documentation contains related but not exact information, use reasonable inference to bridge gaps.
6. BE HONEST: If you truly can't provide an answer, suggest relevant concepts or documentation sections that might help instead.
7. FORMAT YOUR RESPONSE: Use markdown formatting for headings, code blocks, and lists to make your response easy to read.
```

### User Prompt

The default user prompt contains the following elements:
- The user's search query
- Content from the most relevant documentation sections
- Source references to the original documentation pages

When creating a custom user prompt, you can use these template variables:
- `{query}` - The user's search query
- `{context}` - The extracted documentation content
- `{sources}` - References to the source documentation

Example custom user prompt:

```
Answer this question: {query}

Here's relevant documentation:
{context}

Sources:
{sources}

Keep your answer under 300 words and include code examples when available.
```

## Utility Functions

### trackAIQuery

```typescript
function trackAIQuery(query: string, success: boolean = true): void
```

Tracks AI queries for analytics purposes. By default, this logs to the console and sends a Google Analytics event if available.

Parameters:
- `query`: The search query string
- `success`: Whether the query was successful (default: `true`)

## Security Considerations

- Never expose your OpenAI API key directly in client-side code without rate limiting
- Consider implementing a server-side proxy for OpenAI requests 
- Set usage limits on your OpenAI API key to prevent unexpected costs
- For production environments, implement proper authentication and rate-limiting

## Troubleshooting

### OpenAI API Key Issues

If you encounter issues with the OpenAI API key:

1. Verify that your API key is correctly set in `docusaurus.config.js`
2. Check that your `static/docusaurus-openai-search.js` file is correctly set up
3. Inspect the console for any error messages related to the OpenAI API

### Document Content Retrieval Issues

If the AI cannot retrieve document content:

1. Ensure your documentation pages follow standard Docusaurus HTML structure
2. Check that the server allows the browser to fetch documentation pages via JavaScript
3. Try enabling the `highlightCode` option if code blocks are important to your documentation

## License

MIT

## Credits

Built on top of Docusaurus and Algolia DocSearch.
