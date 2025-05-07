# Docusaurus OpenAI Search

An AI-enhanced search component for Docusaurus that uses OpenAI to provide intelligent answers from your documentation.

## Features

- 🔍 Integrates seamlessly with Docusaurus's existing Algolia search
- 🤖 AI-powered answers based on your documentation content
- 🔗 References to relevant documentation pages
- 🎨 Customizable UI that matches Docusaurus themes (light/dark)
- 📱 Fully responsive design

## Installation

```bash
npm install docusaurus-openai-search
```

## Configuration

1. Add your OpenAI API key to your `docusaurus.config.js`:

```js
module.exports = {
  // ... other Docusaurus config
  customFields: {
    // This will be available globally as window.OPENAI_API_KEY
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  },
  scripts: [
    // Make the API key available to the client
    {
      src: '/docusaurus-openai-search.js',
      async: true,
    },
  ],
};
```

2. Create a file called `static/docusaurus-openai-search.js` with the following content:

```js
// This script makes the API key available to the client
window.OPENAI_API_KEY = '${OPENAI_API_KEY}';
```

3. Configure your theme to use the AI-enhanced search in your `src/theme/SearchBar/index.js`:

```jsx
import React from 'react';
import { AiEnhancedSearchBar } from 'docusaurus-openai-search';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';

export default function SearchBarWrapper() {
  const {
    siteConfig: { 
      themeConfig: {
        algolia: algoliaConfig, 
        navbar: { search = {} } = {}
      } = {}
    } = {}
  } = useDocusaurusContext();
  
  // Return null if no Algolia config or search is explicitly disabled
  if (!algoliaConfig || search.algoliaConfig === false) {
    return null;
  }

  return (
    <AiEnhancedSearchBar
      {...algoliaConfig}
      contextualSearch={algoliaConfig.contextualSearch ?? false}
      searchPagePath={algoliaConfig.searchPagePath}
    />
  );
}
```

## Usage

Once installed and configured, users can:

1. Use the regular Algolia search functionality by clicking the search button
2. When viewing search results, they'll see an "Ask AI" button for queries
3. Clicking the AI button opens a modal that generates an answer using your documentation content

## Customization

You can customize the appearance by modifying the provided CSS variables in your custom CSS:

```css
:root {
  --ai-search-button-bg: var(--ifm-color-primary);
  --ai-search-button-hover-bg: var(--ifm-color-primary-dark);
  --ai-modal-header-color: var(--ifm-color-content-secondary);
  --ai-error-color: var(--ifm-color-danger);
}
```

## Advanced Options

You can pass additional options to the `AiEnhancedSearchBar` component:

```jsx
<AiEnhancedSearchBar
  // Algolia config
  appId="YOUR_APP_ID"
  apiKey="YOUR_SEARCH_API_KEY" 
  indexName="YOUR_INDEX_NAME"
  
  // OpenAI config (optional)
  model="gpt-4" // Default model to use
  maxTokens={2000} // Maximum tokens to use
  temperature={0.5} // Temperature for responses
  
  // UI customization (optional)
  textOverrides={{
    aiButtonText: "Get AI Answer",
    modalTitle: "AI Documentation Assistant",
    loadingText: "Analyzing documentation...",
    errorText: "Sorry, I couldn't find an answer.",
    retryButtonText: "Try Again",
    footerText: "Powered by OpenAI"
  }}
/>
```

## Security Considerations

⚠️ **Important**: Never expose your OpenAI API key directly in client-side code. Use environment variables and server-side protection.

For production, consider:
1. Using a proxy API endpoint to hide your OpenAI key
2. Setting rate limits
3. Adding user authentication for API access

## License

MIT

## Credits

Built on top of Docusaurus and Algolia DocSearch.
