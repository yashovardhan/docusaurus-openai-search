// Main entry point for the package
import { AiEnhancedSearchBar } from './components/AiEnhancedSearchBar';
import { AISearchModal } from './components/AISearchModal';

// Plugin to load the CSS file from NPM package
function docusaurusOpenAISearchPlugin(context, options) {
  return {
    name: 'docusaurus-openai-search',
    getClientModules() {
      return [require.resolve('./styles/aiSearch.css')];
    },
  };
}

// Export components
export { AiEnhancedSearchBar, AISearchModal, docusaurusOpenAISearchPlugin }; 