// Remove direct CSS import
// import './styles.css';

// Export main component
export { DocusaurusAISearch } from './components/DocusaurusAISearch';

// Export environment variables plugin
export { default as envPlugin } from './envPlugin';

// Export plugin function for loading CSS on client side
export function docusaurusOpenAISearchPlugin() {
  return {
    name: 'docusaurus-openai-search-plugin',
    getClientModules() {
      return [require.resolve('./styles.css')];
    },
  };
}

// Export configuration types
export type { 
  DocusaurusAISearchProps,
  DocusaurusAISearchConfig,
  OpenAIOptions,
  UIOptions,
  PromptOptions
} from './types';
