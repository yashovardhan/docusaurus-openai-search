# Docusaurus OpenAI Search

An intelligent AI-powered search plugin for Docusaurus that enhances the default Algolia search with OpenAI capabilities. This plugin provides a seamless search experience where users can get AI-generated answers based on their documentation content.

## Architecture

This plugin follows a clean separation of concerns:

- **Frontend SDK**: Minimal UI layer that coordinates search flow
  - Provides the "Use AI" button in search results
  - Manages the search progress UI
  - Sends queries to backend and displays results
  - **No AI logic or prompts** - purely UI and coordination
  
- **Backend Service**: The brain of the AI search (separate repository)
  - **All AI logic and prompts** are defined here
  - Generates optimized search keywords from queries
  - Creates comprehensive answers using RAG
  - Manages all OpenAI API interactions
  - Keeps API keys secure on the server

## Features

✨ **Intelligent Search Enhancement**: Extends Algolia DocSearch with AI capabilities
🤖 **Smart Keyword Generation**: Backend generates optimal search keywords from user queries
📚 **RAG-based Answers**: Retrieves relevant documents and generates comprehensive answers
🔄 **Real-time Progress**: Shows detailed progress including keywords, documents found, and links
🎨 **Fully Customizable UI**: Customize the AI search modal appearance
🔒 **Secure Architecture**: AI logic runs on backend, keeping API keys safe
⚡ **Response Caching**: Caches AI responses for improved performance

## How It Works

1. User performs a regular search
2. If results aren't satisfactory, they click "Use AI"
3. Frontend sends query to backend with system context
4. Backend returns optimized search keywords
5. Frontend searches for each keyword using Algolia
6. Frontend sends collected documents to backend
7. Backend generates comprehensive answer using RAG
8. User sees the complete answer with source links

## Installation

```bash
npm install docusaurus-openai-search
```

## Setup

### 1. Deploy the Backend Service

For security, this plugin requires a backend service to handle all AI operations.

The backend service is available at [docusaurus-openai-search-backend](https://github.com/yashovardhan/docusaurus-openai-search-backend). It handles:
- All AI logic and prompts
- Keyword generation from queries
- RAG-based answer generation
- Secure OpenAI API key management

Deploy it to any Node.js hosting service:

```bash
# Clone the backend repository
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
    // Backend service configuration
    backend: {
      url: "https://your-backend-url.com", // Required
    },
    // UI customization
    ui: {
      aiButtonText: "Ask AI",
      modalTitle: "AI Assistant",
      footerText: "Powered by AI",
    },
    // Context to send to backend
    context: {
      siteName: "Your Site Name",
      systemContext: "This is documentation for [your product description]",
    },
    // Enable detailed logging for debugging (disable in production)
    enableLogging: false,
  };
  
  return <DocusaurusAISearch algoliaConfig={algolia} aiConfig={aiConfig} />;
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
| `backend` | object | Yes | Backend service configuration |
| `ui` | object | No | UI customization options |
| `context` | object | No | Context to send to backend |
| `enabled` | boolean | No | Enable or disable AI search features (default: `true`) |
| `maxSearchQueries` | number | No | Maximum number of search queries to request from backend (default: `5`) |
| `enableCaching` | boolean | No | Enable response caching (default: `true`) |
| `cacheTTL` | number | No | Cache time-to-live in seconds (default: `3600`) |
| `onAIQuery` | function | No | Callback function when an AI query is made |
| `enableLogging` | boolean | No | Enable detailed logging for debugging (default: `false`) |

### Backend Options

The `backend` object configures the connection to your backend service:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `url` | string | Yes | URL of your backend service that handles all AI operations |

### UI Options

The `ui` object customizes the appearance and text of UI elements:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `aiButtonText` | string | No | Custom text for the AI button (default: `Ask AI about "{query}"`) |
| `modalTitle` | string | No | Title of the AI modal (default: `AI Answer`) |
| `errorText` | string | No | Error text when AI generation fails (default: `Unable to generate an answer. Please try again later.`) |
| `footerText` | string | No | Footer text in the AI modal (default: `Powered by AI`) |

### Context Options

The `context` object provides information about your product to send to the backend:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `siteName` | string | No | Name of your site or product (default: `this documentation`) |
| `systemContext` | string | No | Additional context about your product/service to help AI understand queries better |

### Example Configuration

```jsx
const aiConfig = {
  backend: {
    url: "https://your-backend-url.com",
  },
  ui: {
    aiButtonText: "Ask AI",
    modalTitle: "AI Assistant",
    footerText: "Powered by AI",
  },
  context: {
    siteName: "Your Site Name",
    systemContext: "This is documentation for [your product description]",
  },
  enableLogging: false,
};
```

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

## Debugging with enableLogging

The `enableLogging` parameter provides detailed logging to help you debug the search flow.

### Enabling Debug Logging

To enable detailed logging, set `enableLogging: true` in your AI configuration:

```jsx
const aiConfig = {
  backend: {
    url: "https://your-backend-url.com",
  },
  // Enable detailed logging
  enableLogging: true,
};
```

### What Gets Logged

When logging is enabled, you'll see information about:

1. **Search Steps**: Each phase of the search process
2. **Keywords**: What keywords the backend generated
3. **Document Retrieval**: Which documents were found
4. **API Calls**: When requests are made to the backend

### Production Considerations

Remember to disable logging in production (`enableLogging: false`) as it generates console output.

## Security Considerations

### Backend Service Security Features

The backend service provides comprehensive security features:
- **Domain-based access control**: Only whitelisted domains can access the service
- **Rate limiting**: Configurable per IP/user to prevent abuse
- **Request validation**: All requests are validated and sanitized
- **Secure error handling**: No sensitive data in error messages
- **API key security**: OpenAI API keys are never exposed to the frontend
- **Comprehensive logging**: For security auditing and monitoring

### Best Practices

1. **Domain Whitelisting**: Configure `ALLOWED_DOMAINS` in your backend to only accept requests from your documentation site
2. **HTTPS Only**: Always use HTTPS for both your documentation site and backend service
3. **Monitor Usage**: Set up logging and monitoring on your backend to track usage and detect anomalies
4. **Rate Limiting**: Configure appropriate rate limits based on your expected usage
5. **Regular Updates**: Keep your backend dependencies up to date

### Additional Recommendations

- Set usage limits on your OpenAI API key to prevent unexpected costs
- Regularly rotate your API keys
- Monitor your OpenAI usage dashboard for unusual activity
- Consider implementing additional authentication for sensitive documentation
- Use environment-specific configurations (development vs. production)

## Troubleshooting

### Backend Connection Issues

If you encounter issues connecting to the backend:

1. Verify that your backend URL is correct in the configuration
2. Check that the backend service is running and accessible
3. Ensure your domain is whitelisted in the backend's `ALLOWED_DOMAINS` configuration
4. Check the backend logs for any error messages

### Search Issues

If search is not working as expected:

1. Ensure your Algolia configuration is correct
2. Check that the backend is returning keywords properly
3. Verify that documents are being retrieved from Algolia
4. Enable logging to see the search flow

### CORS Errors

If you see CORS errors:

1. Verify your domain is in the backend's `ALLOWED_DOMAINS` environment variable
2. Check for protocol mismatch (http vs https)
3. Ensure no trailing slashes in domain configuration
4. Check that the backend's CORS configuration is correct

## License

MIT

## Credits

Built on top of Docusaurus and Algolia DocSearch. 