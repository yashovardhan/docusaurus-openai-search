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

### 1. Install necessary packages

```bash
npm install docusaurus-openai-search docusaurus2-dotenv
```

### 2. Create an environment file

Create a `.env` file in your project root:

```
OPENAI_API_KEY=your_openai_api_key_here
```

### 3. Configure docusaurus2-dotenv plugin

Add the plugin to your `docusaurus.config.js`:

```js
module.exports = {
  // ...other config
  plugins: [
    // ...other plugins
    [
      "docusaurus2-dotenv",
      {
        path: "./.env", // The path to your environment variables
        safe: false, // If false ignore safe-mode, if true load './.env.example', if a string load that file as the sample
        systemvars: false, // Set to true if you would rather load all system variables as well (useful for CI purposes)
        silent: false, // If true, all warnings will be suppressed
        expand: false, // Allows your variables to be "expanded" for reusability within your .env file
        defaults: false, // Adds support for dotenv-defaults. If set to true, uses ./.env.defaults
      },
    ],
  ],
};
```

### 4. Swizzle the SearchBar component

Run the swizzle command and select SearchBar to eject:

```bash
npm run swizzle
```

### 5. Replace the SearchBar component

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

  const apiKey = process.env.OPENAI_API_KEY;

  // AI search configuration
  const aiConfig = {
    // OpenAI API settings
    openAI: {
      apiKey,
      model: "gpt-4.1",
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
      // Optional: Customize system prompt
      systemPrompt: "You are a helpful assistant. Your goal is to provide detailed, accurate information about the documentation provided."
    },
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
