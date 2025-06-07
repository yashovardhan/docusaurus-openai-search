# Docusaurus OpenAI Search

AI-enhanced search component for Docusaurus using OpenAI's API to provide AI-powered answers based on your documentation content.

## Features

- Drop-in replacement for Docusaurus's default Algolia DocSearch
- AI-powered answer generation based on search results
- Extracts content from documentation pages for contextual answers
- Customizable prompts, models, and UI
- Full TypeScript support
- Secure backend proxy for API key protection

## Installation

```bash
npm install docusaurus-openai-search
```

## Setup

### 1. Deploy the Backend Proxy

For security, this plugin requires a backend proxy service to keep your OpenAI API key safe on the server side.

The recommended backend proxy is available at [docusaurus-openai-search-backend](https://github.com/yashovardhan/docusaurus-openai-search-backend). It's a simple Node.js server that:
- Keeps your OpenAI API key secure
- Validates requests from your allowed domains
- Provides rate limiting to prevent abuse

Deploy it to any Node.js hosting service:

```bash
# Clone the backend proxy repository
git clone https://github.com/yashovardhan/docusaurus-openai-search-backend.git
cd docusaurus-openai-search-backend

# Install and configure
npm install
cp .env.example .env
# Edit .env with your OPENAI_API_KEY and ALLOWED_DOMAINS

# Deploy to your preferred service (Vercel, Heroku, Railway, etc.)
```

See the [docusaurus-openai-search-backend README](https://github.com/yashovardhan/docusaurus-openai-search-backend#readme) for deployment instructions.

### 2. Swizzle the SearchBar component

Run the swizzle command and select SearchBar to eject:

```bash
npm run swizzle
```

### 3. Replace the SearchBar component

Replace the content of the swizzled component (typically at `src/theme/SearchBar/index.js` or `index.tsx`) with:

```jsx
import React from "react";
import { DocusaurusAISearch } from "docusaurus-openai-search";
import useDocusaurusContext from "@docusaurus/useDocusaurusContext";

export default function SearchBar() {
  const {
    siteConfig: {
      themeConfig: { algolia },
    },
  } = useDocusaurusContext();

  // AI search configuration
  const aiConfig = {
    // OpenAI API settings
    openAI: {
      proxyUrl: "https://your-backend-url.com", // Required
      model: "gpt-4",
      maxTokens: 10000,
      temperature: 0.3,
    },
    // UI customization
    ui: {
      aiButtonText: "Ask AI",
      modalTitle: "AI Assistant",
      footerText: "Powered by AI",
    },
    // Prompt customization
    prompts: {
      siteName: "Your Site Name",
      // Enable AI summarization of content before sending to main LLM
      useSummarization: true,
    },
    // Enable detailed logging for debugging (disable in production)
    enableLogging: false,
  };
  
  return <DocusaurusAISearch algoliaConfig={algolia} aiConfig={aiConfig} />;
}
```

## Crafting Effective System Prompts

A well-crafted system prompt is crucial for getting high-quality answers from the AI assistant. Here's a guide to creating effective system prompts for documentation:

### System Prompt Structure

An effective system prompt typically includes:

1. **Role Definition**: Define the AI's role and expertise
2. **Response Guidelines**: Set clear expectations for answer quality and style
3. **Domain Knowledge**: Provide key facts about your product/platform
4. **Formatting Preferences**: Specify how answers should be formatted

### Example System Prompt Template

Here's an annotated example of an effective system prompt:

```js
const systemPrompt =
  // Role definition - clearly establish the assistant's identity and purpose
  "You are a helpful [PRODUCT] expert assistant. Your goal is to provide detailed, accurate information about [PRODUCT]'s [FEATURES] to [TARGET USERS].\n\n" +
  
  // Response guidelines - establish clear expectations for answers
  "RESPONSE GUIDELINES:\n" +
  "1. BE HELPFUL: Always try to provide SOME guidance, even when the documentation doesn't contain a perfect answer.\n" +
  "2. PRIORITIZE USER SUCCESS: Focus on helping the user accomplish their task with [PRODUCT].\n" +
  "3. USE DOCUMENTATION FIRST: Base your answers primarily on the provided documentation snippets.\n" +
  "4. CODE EXAMPLES ARE CRUCIAL: Always include code snippets from the documentation when available, as they're extremely valuable to developers.\n" +
  "5. INFERENCE IS ALLOWED: When documentation contains related but not exact information, use reasonable inference to bridge gaps based on standard [PRODUCT] patterns.\n" +
  "6. BE HONEST: If you truly can't provide an answer, suggest relevant [PRODUCT] concepts or documentation sections that might help instead.\n" +
  "7. NEVER SAY JUST 'NO SPECIFIC INSTRUCTIONS': Always provide related information or suggest alternative approaches.\n\n" +
  
  // Domain knowledge - provide key facts about your product/platform
  "ABOUT [PRODUCT]:\n" +
  "- [KEY FACT 1 ABOUT YOUR PRODUCT]\n" +
  "- [KEY FACT 2 ABOUT YOUR PRODUCT]\n" +
  "- [KEY FACT 3 ABOUT YOUR PRODUCT]\n" +
  "- [KEY TECHNICAL DETAILS THAT HELP ANSWER COMMON QUESTIONS]";
```

### Best Practices

1. **Be specific about response format**: Explicitly state if you want code examples, step-by-step instructions, etc.
2. **Include critical domain knowledge**: Add key facts that help the AI understand your product's unique aspects
3. **Set clear guardrails**: Define what the AI should do when it doesn't have a perfect answer
4. **Balance brevity and detail**: Include enough context without overwhelming the model
5. **Focus on user success**: Orient the prompt toward solving user problems, not just providing information

### Tips for Technical Documentation

For technical documentation, consider:

1. **Emphasize code examples**: Instruct the AI to prioritize showing code snippets when relevant
2. **Address common user scenarios**: Mention key use cases your users frequently encounter
3. **Clarify technical terminology**: If your product uses specific technical terms, include brief definitions
4. **Reference documentation structure**: If your docs have a specific organization, explain it briefly

When implementing the system prompt in your SearchBar component:

```jsx
// In your SearchBar component
const systemPrompt = 
  "You are a helpful [YOUR PRODUCT] expert assistant...[rest of your prompt]";

const aiConfig = {
  // ...other config
  prompts: {
    siteName: "Your Site Name",
    systemPrompt: systemPrompt,
  },
};
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
| `openAI` | object | Yes | OpenAI API settings |
| `ui` | object | No | UI customization options |
| `prompts` | object | No | Prompt generation and content handling options |
| `enabled` | boolean | No | Enable or disable AI search features (default: `true`) |
| `intelligentSearch` | boolean | No | Enable Perplexity-style intelligent search (default: `true`) |
| `onAIQuery` | function | No | Callback function when an AI query is made |
| `enableLogging` | boolean | No | Enable detailed logging for debugging RAG pipeline (default: `false`) |

### OpenAI Options

The `openAI` object configures the OpenAI API settings:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `proxyUrl` | string | Yes | URL of your backend proxy service |
| `model` | string | No | Model to use for AI search queries (default: `gpt-4`) |
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
| `systemContext` | string | No | Additional context about your product/service to help AI understand queries better |
| `maxDocuments` | number | No | Maximum number of documents to include in context (default: `4`) |
| `highlightCode` | boolean | No | Whether to include code blocks separately in the prompt |
| `includeLlmsFile` | boolean | No | Whether to include `llms.txt` from the site root if available. This file provides additional context for AI responses. Enabled by default, set to `false` to disable. |
| `useSummarization` | boolean | No | Whether to use AI-based summarization before sending content to the main LLM. This shrinks and focuses the content to be more relevant to the query. (default: `false`) |

### Enhanced Query Analysis (Deep Research Mode)

When `intelligentSearch` is enabled (default), the search performs a sophisticated two-step AI analysis:

#### How It Works

1. **Query Understanding**: The AI first analyzes your query using the system context to understand:
   - What the user is really asking about
   - Key concepts and terminology related to the query
   - Up to 5 specific search keywords that will find relevant documentation

2. **Multi-faceted Search**: For each keyword identified:
   - Performs a targeted search
   - Retrieves the top 2 most relevant documents
   - Collects up to 10 total documents for comprehensive coverage

3. **Synthesis**: The collected documents are sent to the AI for final answer generation

#### Benefits

- **Better Understanding**: AI uses your product context to decode ambiguous queries
- **Comprehensive Coverage**: Multiple targeted searches find more relevant content
- **Transparent Process**: Users see exactly what the AI is doing at each step

#### Example Configuration with System Context

```jsx
const aiConfig = {
  openAI: {
    proxyUrl: "https://your-backend-url.com",
    model: "gpt-4",
  },
  prompts: {
    siteName: "MyProduct",
    // Provide context about your product to help AI understand queries
    systemContext: `MyProduct is a modern data analytics platform that helps businesses 
    analyze and visualize their data. Key features include:
    - Real-time dashboards
    - SQL query builder
    - Data pipeline management
    - API integrations
    - Custom reporting
    
    Common use cases: business intelligence, data warehousing, and analytics.`,
    maxDocuments: 10, // Collect up to 10 documents
  },
  intelligentSearch: true, // Enable deep research mode (default)
};
```

#### What Users See

During the search process, users see detailed progress:

1. **Analysis Phase**:
   - "Analyzing your question to understand what you're looking for..."
   - Shows what the AI understood from the query
   - Displays the search keywords identified

2. **Search Phase**:
   - Progress for each keyword search
   - Number of results found for each keyword
   - Total documents collected

3. **Synthesis Phase**:
   - "Preparing final results for AI synthesis..."
   - Number of documents being analyzed

This transparency helps users understand how their query is being processed and builds trust in the results.

### Event Callbacks

| Function | Parameters | Description |
|----------|------------|-------------|
| `onAIQuery` | `(query: string, success: boolean) => void` | Called when an AI query is made. `query` is the search string, `success` indicates whether the query was successful |

#### How It Works

The search ranking algorithm uses this analysis to:

1. **Disambiguate similar terms**: Distinguishes between "React" and "React Native" to show more relevant results
2. **Match user intent**: Prioritizes guides for "how to" queries, API docs for API queries, etc.
3. **Apply platform-specific ranking**: Boosts web-related results for React queries, mobile results for React Native, etc.
4. **Penalize mismatches**: Reduces ranking for results that don't match the detected technology or platform

This intelligent query analysis significantly improves search relevance, especially for documentation sites with multiple technologies, platforms, or frameworks.

## Styling Customization

The component provides customizable CSS variables to adjust spacing throughout the UI. You can override these variables in your site's CSS to adjust the spacing to match your site's design.

### CSS Variables

The following CSS variables are available for customization:

```css
.docusaurus-openai-search {
  /* Base spacing units - can be customized */
  --ai-search-unit-xs: 4px;   /* Extra small spacing */
  --ai-search-unit-sm: 8px;   /* Small spacing */
  --ai-search-unit-md: 12px;  /* Medium spacing */
  --ai-search-unit-lg: 16px;  /* Large spacing */
  --ai-search-unit-xl: 24px;  /* Extra large spacing */
  --ai-search-unit-xxl: 32px; /* Extra extra large spacing */
}
```

### Customizing Spacing

To customize the spacing in your Docusaurus site, add CSS overrides in your custom CSS file:

```css
/* In your custom CSS file */
:root {
  /* Adjust the spacing globally */
  .docusaurus-openai-search {
    --ai-search-unit-xs: 6px;   /* Make extra small spacing larger */
    --ai-search-unit-sm: 12px;  /* Increase small spacing */
    /* Other customizations... */
  }
}

/* For dark mode adjustments */
html[data-theme='dark'] .docusaurus-openai-search {
  /* Dark mode specific adjustments if needed */
}
```

### Usage Example

If you want to make all UI elements more compact:

```css
.docusaurus-openai-search {
  --ai-search-unit-xs: 2px;
  --ai-search-unit-sm: 4px;
  --ai-search-unit-md: 8px;
  --ai-search-unit-lg: 12px;
  --ai-search-unit-xl: 16px;
  --ai-search-unit-xxl: 24px;
}
```

Or if you prefer more spacious UI:

```css
.docusaurus-openai-search {
  --ai-search-unit-xs: 6px;
  --ai-search-unit-sm: 12px;
  --ai-search-unit-md: 18px;
  --ai-search-unit-lg: 24px;
  --ai-search-unit-xl: 32px;
  --ai-search-unit-xxl: 48px;
}
```

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

## Using llms.txt for Enhanced AI Responses

When using LLM models like GPT-4 to enhance your documentation search, you can provide additional global context to improve the AI's understanding of your product/service by creating an `llms.txt` file.

### What is llms.txt?

The `llms.txt` file is a plain text file you can place at the root of your Docusaurus site that contains important context about your product, service, or documentation that you want the AI to know. This information will be included in every AI search query when the `includeLlmsFile` option is enabled.

### How to Use llms.txt

1. Create a file named `llms.txt` in your site's `static/` directory (so it gets copied to the root of your built site)
2. Add important information about your product/service that the AI should always know about
3. The feature is enabled by default. If you need to disable it, set `includeLlmsFile: false` in your AI configuration

## AI Content Summarization

To enhance the quality of AI responses, you can enable content summarization that uses a smaller AI model to first process and focus the retrieved content before sending it to the main LLM.

### How Content Summarization Works

When enabled, the content retrieved from your documentation pages is sent to an AI model which:

1. Summarizes the content while preserving key information
2. Focuses the content specifically on the user's query
3. Maintains all code examples and technical details
4. Removes irrelevant information

This process creates more targeted context for the main LLM, resulting in more accurate and concise answers. By default, the system uses the same model and token settings as configured for the main answer generation, ensuring consistency and quality in the summarization process.

### Example Configuration with Summarization

```jsx
// In your SearchBar component
const aiConfig = {
  openAI: {
    proxyUrl: "https://your-backend-url.com",
    model: "gpt-4",
    maxTokens: 10000,
    temperature: 0.3,
  },
  prompts: {
    siteName: "Your Site Name",
    // Enable AI summarization of content before sending to main LLM
    useSummarization: true,
    // Other prompt options...
  },
  // Other configuration...
};

return <DocusaurusAISearch algoliaConfig={algolia} aiConfig={aiConfig} />;
```

## Debugging with enableLogging

The `enableLogging` parameter provides comprehensive logging throughout the RAG (Retrieval-Augmented Generation) pipeline to help you debug and optimize your AI search implementation.

### Enabling Debug Logging

To enable detailed logging, set `enableLogging: true` in your AI configuration:

```jsx
const aiConfig = {
  openAI: {
    proxyUrl: "https://your-backend-url.com",
    model: "gpt-4",
    maxTokens: 10000,
    temperature: 0.3,
  },
  // Enable detailed logging
  enableLogging: true,
  // Other configuration...
};
```

### What Gets Logged

When logging is enabled, you'll see detailed information about:

1. **Search Query Processing**
   - The user's query
   - Number of search results from Algolia
   - Details about each search result (URL, title, snippet)

2. **Content Retrieval**
   - URLs being fetched
   - Success/failure status of each fetch
   - Content length and preview
   - Fallback mechanisms when direct fetching fails
   - llms.txt file retrieval (if enabled)

3. **RAG Content Preparation**
   - Number of documents being processed
   - Length and preview of each document
   - Content verification and quality checks

4. **Prompt Generation**
   - System prompt (full text)
   - User prompt (full text)
   - Total prompt length
   - Document count included in context

5. **API Requests**
   - Full request payload sent to the proxy
   - Model parameters (temperature, max tokens, etc.)
   - Response data from OpenAI

6. **Performance Metrics**
   - Time taken for each operation
   - Content summarization metrics (if enabled)
   - Compression ratios

### Example Log Output

```
[AI Search] Starting document content retrieval for query: "how to install"
[AI Search] Query: "how to install"
  Number of search results: 5
  Search results: [
    { index: 0, url: '/docs/installation', title: 'Installation Guide', snippet: 'Install the package using npm...' },
    ...
  ]
[AI Search] Processing top 5 search results
[AI Search] Fetching document content from: /docs/installation
[AI Search] Content Retrieval: /docs/installation
  Success: true
  Content length: 2456
  Content preview: # Installation Guide\n\nTo install the package...
[AI Search] Performance - fetchDocumentContent(/docs/installation): 125ms
[AI Search] RAG Content Preparation
  Number of documents: 3
  Document 1: { length: 2456, preview: '# Installation Guide...' }
  ...
[AI Search] Creating user prompt for query: "how to install"
[AI Search] Generated user prompt
  queryLength: 14
  contextLength: 5234
  totalPromptLength: 5248
  documentCount: 3
[AI Search] Creating chat completion through proxy
  model: gpt-4
  messageCount: 2
  maxTokens: 10000
  temperature: 0.3
[AI Search] API Request to https://your-backend-url.com/api/chat/completions
  Payload: { model: 'gpt-4', messages: [...], max_tokens: 10000, temperature: 0.3 }
[AI Search] API Response
  Response: { choices: [...], usage: { total_tokens: 1234 } }
  Generated answer length: 856
[AI Search] Performance - Proxy request to /api/chat/completions: 2341ms
```

### Using Logs for Optimization

The detailed logs can help you:

1. **Identify Content Retrieval Issues**
   - See which documents fail to load
   - Understand why certain content isn't being included
   - Debug URL routing problems

2. **Optimize Prompt Size**
   - Monitor total prompt lengths
   - Adjust `maxDocuments` if prompts are too large
   - Fine-tune content summarization settings

3. **Improve Response Quality**
   - See exactly what content the AI receives
   - Identify missing or incomplete documentation
   - Adjust system prompts based on actual usage

4. **Performance Tuning**
   - Identify slow operations
   - Optimize content retrieval strategies
   - Consider enabling content summarization for large documents

### Production Considerations

Remember to disable logging in production (`enableLogging: false`) as it:
- Generates significant console output
- May impact performance slightly
- Could expose sensitive information in browser console

Use logging primarily during development and testing phases.

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

### Backend Proxy Security Features

The backend proxy provides comprehensive security features:
- **Domain-based access control**: Only whitelisted domains can access the proxy
- **Rate limiting**: Configurable per IP/user to prevent abuse
- **Request validation**: All requests are validated and sanitized
- **Secure error handling**: No sensitive data in error messages
- **Optional Redis caching**: Reduces API calls and improves performance
- **Comprehensive logging**: For security auditing and monitoring

### Best Practices

1. **Domain Whitelisting**: Configure `ALLOWED_DOMAINS` in your proxy to only accept requests from your documentation site
2. **HTTPS Only**: Always use HTTPS for both your documentation site and proxy service
3. **Monitor Usage**: Set up logging and monitoring on your proxy to track usage and detect anomalies
4. **Rate Limiting**: Configure appropriate rate limits based on your expected usage
5. **Regular Updates**: Keep your proxy dependencies up to date

### Additional Recommendations

- Set usage limits on your OpenAI API key to prevent unexpected costs
- Regularly rotate your API keys
- Monitor your OpenAI usage dashboard for unusual activity
- Consider implementing additional authentication for sensitive documentation
- Use environment-specific configurations (development vs. production)

## Troubleshooting

### Proxy Connection Issues

If you encounter issues connecting to the proxy:

1. Verify that your proxy URL is correct in the configuration
2. Check that the proxy service is running and accessible
3. Ensure your domain is whitelisted in the proxy's `ALLOWED_DOMAINS` configuration
4. Check the proxy logs for any error messages

### Document Content Retrieval Issues

If the AI cannot retrieve document content:

1. Ensure your documentation pages follow standard Docusaurus HTML structure
2. Check that the server allows the browser to fetch documentation pages via JavaScript
3. Try enabling the `highlightCode` option if code blocks are important to your documentation

### CORS Errors

If you see CORS errors:

1. Verify your domain is in the proxy's `ALLOWED_DOMAINS` environment variable
2. Check for protocol mismatch (http vs https)
3. Ensure no trailing slashes in domain configuration
4. Check that the proxy's CORS configuration is correct

## License

MIT

## Credits

Built on top of Docusaurus and Algolia DocSearch.

## What's New: Intelligent Search

The latest version introduces Perplexity-style intelligent search that:
- **Understands Intent**: Analyzes your query to understand what you're really looking for
- **Multi-Step Search**: Performs multiple targeted searches based on query analysis
- **Sitemap Integration**: Uses your site's structure to discover related content
- **Progress Updates**: Shows real-time progress as it searches and analyzes
- **Smart Ranking**: Ranks results by relevance to your specific question

## Intelligent Search Mode

When `intelligentSearch` is enabled (default), the search process works as follows:

1. **Query Analysis**: AI analyzes your query to understand the intent (how-to, troubleshooting, API reference, etc.)
2. **Multi-faceted Search**: Generates multiple search queries based on the analysis
3. **Sitemap Discovery**: Uses your site's sitemap to find related documentation
4. **Content Ranking**: Scores and ranks documents by relevance
5. **Answer Generation**: Creates a comprehensive answer from the most relevant sources

### Progress Indicators

During intelligent search, users see real-time progress updates:
- "Understanding your question..." - Analyzing query intent
- "Loading documentation structure..." - Processing sitemap
- "Searching documentation..." - Running searches
- "Finding related documentation..." - Discovering additional content
- "Retrieving documentation content..." - Fetching page content
- "Generating AI response..." - Creating the final answer

### Configuration Example

```jsx
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
    siteName: "Your Documentation",
    maxDocuments: 10, // Analyze up to 10 documents
  },
  ui: {
    aiButtonText: "Ask AI",
    modalTitle: "AI Assistant",
  },
};
```

### Disabling Intelligent Search

If you prefer the simpler, faster search that relies solely on Algolia results:

```jsx
const aiConfig = {
  // ... other config
  intelligentSearch: false, // Use simple Algolia-based search
};
```

## Configuration

The plugin uses a comprehensive default configuration system. All configuration values have sensible defaults, so you only need to specify what you want to override.

### Default Configuration

The plugin includes built-in defaults for all configuration options. You can import and reference these defaults if needed:

```jsx
import { DEFAULT_CONFIG } from 'docusaurus-openai-search';

// View default values
console.log(DEFAULT_CONFIG);
```

Default values include:
- **OpenAI Model**: `gpt-4` for main queries, `gpt-3.5-turbo` for query analysis
- **Temperature**: `0.5` for main queries, `0.3` for query analysis
- **Max Tokens**: `2000` for main queries, `500` for query analysis
- **Intelligent Search**: Enabled by default
- **Max Documents**: 10 for intelligent search, 5 for simple search

### Minimal Configuration

The only required configuration is the proxy URL:

```jsx
const aiConfig = {
  openAI: {
    proxyUrl: "https://your-backend-url.com", // Only required field
  },
};
```

All other values will use sensible defaults.

### Full Configuration Example

Here's a complete example showing all available options:

```jsx
const aiConfig = {
  // OpenAI API settings
  openAI: {
    proxyUrl: "https://your-backend-url.com", // Required
    model: "gpt-4",                          // Default: gpt-4
    maxTokens: 10000,                        // Default: 2000
    temperature: 0.3,                        // Default: 0.5
  },
  
  // Enable/disable features
  intelligentSearch: true,                   // Default: true
  enabled: true,                            // Default: true
  enableLogging: false,                     // Default: false
  
  // UI customization
  ui: {
    aiButtonText: "Ask AI about \"{query}\"",         // Default includes {query} placeholder
    aiButtonAriaLabel: "Ask AI about this question",  // Default
    modalTitle: "AI Answer",                          // Default
    loadingText: "Generating answer based on documentation...", // Default
    errorText: "Unable to generate an answer. Please try again later.", // Default
    retryButtonText: "Retry Query",                   // Default
    footerText: "Powered by AI • Using content from documentation", // Default
    retrievingText: "Retrieving document content...", // Default
    generatingText: "Generating AI response...",      // Default
  },
  
  // Prompt customization
  prompts: {
    siteName: "Your Documentation",          // Default: "this documentation"
    maxDocuments: 10,                        // Default: 10 for intelligent search, 5 for simple
    highlightCode: false,                    // Default: false
    includeLlmsFile: true,                   // Default: true
    useSummarization: false,                 // Default: false
    systemPrompt: undefined,                 // Default: built-in prompt
    userPrompt: undefined,                   // Default: built-in prompt
  },
  
  // Event callbacks
  onAIQuery: (query, success) => {
    console.log(`AI query: ${query}, success: ${success}`);
  },
};
```

### Accessing Configuration Constants

The plugin exports several configuration constants that you can use:

```jsx
import { 
  DEFAULT_CONFIG,
  QUERY_ANALYSIS_SYSTEM_PROMPT,
  COMMON_DOC_PATTERNS,
  SITEMAP_PATTERNS 
} from 'docusaurus-openai-search';

// Use or extend default patterns
const myDocPatterns = [...COMMON_DOC_PATTERNS, '/my-custom-docs'];
```
