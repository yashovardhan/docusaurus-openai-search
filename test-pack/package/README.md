# Docusaurus AI-Enhanced Search

Add AI-powered search capabilities to your Docusaurus site with this drop-in enhancement for the
Algolia DocSearch component.

## Features

- 🔍 Integrates with the existing Algolia DocSearch setup
- 🤖 Adds an AI button to search results to get comprehensive answers
- 📑 Retrieves and processes content from your documentation pages
- 💡 Provides meaningful responses powered by OpenAI
- 🌙 Supports both light and dark mode

## Installation

```bash
npm install docusaurus-openai-search
# or
yarn add docusaurus-openai-search
```

## Setup

### 1. Configure OpenAI API Key

First, set up your OpenAI API key in your Docusaurus configuration file (`docusaurus.config.ts` or
`docusaurus.config.js`):

```js
module.exports = {
  // ... your existing config
  scripts: [
    // ...other scripts
    {
      src: "/inject-openai-key.js",
      defer: true,
    },
  ],
  // ... rest of your config
};
```

Then create a file called `static/inject-openai-key.js`:

```js
// This injects the API key at runtime instead of building it into your app
window.OPENAI_API_KEY = "your-openai-api-key"; // Replace with your actual key or use an environment variable
```

**Important:** For production, you should:

- Use environment variables instead of hardcoding the key
- Consider setting up a proxy API endpoint for security
- Keep your API key confidential and never expose it in client-side code in production

### 2. Swizzle the Docusaurus SearchBar Component

First, eject the existing SearchBar component:

```bash
npx docusaurus swizzle @docusaurus/theme-search-algolia SearchBar --eject
```

### 3. Replace with AI-Enhanced SearchBar

Edit the ejected component in `src/theme/SearchBar/index.js` or `src/theme/SearchBar/index.tsx`:

```tsx
import React from "react";
import { AiEnhancedSearchBar } from "docusaurus-openai-search";
import useDocusaurusContext from "@docusaurus/useDocusaurusContext";

export default function SearchBar() {
  const { siteConfig } = useDocusaurusContext();
  return <AiEnhancedSearchBar {...(siteConfig.themeConfig.algolia as any)} />;
}
```

## Configuration Options

The `AiEnhancedSearchBar` component accepts all the same props as the original Docusaurus Algolia
SearchBar.

## Customization

You can customize the appearance by overriding the CSS classes in your own stylesheets. See the
[CSS file](src/styles/aiSearch.css) for all available classes.

## Example

Here's what happens when a user interacts with the AI-enhanced search:

1. User performs a search using the standard Algolia search box
2. Search results appear as normal
3. A new "Ask AI" button appears above the search results
4. When clicked, the AI analyzes the search results and relevant documentation pages
5. The AI generates a comprehensive answer based on your documentation content

## License

MIT

## Credits

Built on top of Docusaurus and Algolia DocSearch.
