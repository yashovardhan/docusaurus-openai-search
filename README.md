# Docusaurus AI Search

An AI-enhanced search component for Docusaurus using OpenAI. This package enhances the standard Algolia search functionality in Docusaurus with an AI assistant that can provide detailed answers to user queries based on your documentation content.

## Installation

```bash
npm install docusaurus-openai-search
```

## Configuration

### 1. Register the plugin for CSS loading

First, update your `docusaurus.config.js` to use the plugin which will load the required CSS files:

```js
// docusaurus.config.js
const { docusaurusOpenAISearchPlugin } = require('docusaurus-openai-search');

module.exports = {
  // ... other config
  plugins: [
    docusaurusOpenAISearchPlugin,
    // ... your other plugins
  ],
  scripts: [
    // Add this script to make your OpenAI API key available
    {
      src: '/scripts/ai-search-config.js',
      async: true,
    },
  ],
  // ... other config
};
```

### 2. Configure OpenAI API key

Create a file at `static/scripts/ai-search-config.js` with your OpenAI API key:

```js
// Make sure to secure this in production!
window.OPENAI_API_KEY = 'your-openai-api-key';
```

### 3. Create a custom theme component

Create a file at `src/theme/SearchBar/index.js`:

```js
import React from 'react';
import { AiEnhancedSearchBar } from 'docusaurus-openai-search';

export default function SearchBar(props) {
  return <AiEnhancedSearchBar {...props} />;
}
```

## Usage

Once configured, your Docusaurus site will use the AI-enhanced search bar. Users can:

1. Use the standard Algolia search functionality as usual
2. When viewing search results, click the "Ask AI" button that appears to get an AI-generated answer based on the documentation

## Troubleshooting

### CSS Loading Issues

If you encounter styling issues, there are two ways to load the CSS:

#### Option 1: Use the plugin (recommended)
Register the plugin as shown in the Configuration section above.

#### Option 2: Import CSS manually
If you prefer to import the CSS manually, you can add this to your custom theme component:

```js
// src/theme/SearchBar/index.js
import React from 'react';
import { AiEnhancedSearchBar } from 'docusaurus-openai-search';
import 'docusaurus-openai-search/dist/styles/aiSearch.css';

export default function SearchBar(props) {
  return <AiEnhancedSearchBar {...props} />;
}
```

### Module not found errors

If you encounter errors like:

```
Module not found: Error: Can't resolve './components/AiEnhancedSearchBar.jsx'
```

Make sure you're importing the components without file extensions:

```js
// Correct
import { AiEnhancedSearchBar } from 'docusaurus-openai-search';

// Incorrect - don't include file extensions
import { AiEnhancedSearchBar } from 'docusaurus-openai-search/dist/components/AiEnhancedSearchBar';
```

### OpenAI API Issues

If the AI doesn't respond, check:

1. Your OpenAI API key is correctly set in the config script
2. You have sufficient credits on your OpenAI account
3. You're using a supported model (the package uses "gpt-4.1" by default)

## Security Considerations

**Important**: Never expose your OpenAI API key in client-side code in a production environment. Consider:

1. Using a proxy server to make the OpenAI API calls
2. Implementing user authentication before allowing AI queries
3. Setting rate limits to prevent abuse

## License

MIT

## Credits

Built on top of Docusaurus and Algolia DocSearch.
