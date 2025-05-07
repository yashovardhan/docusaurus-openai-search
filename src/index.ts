// Import CSS directly as requested
import './styles.css';

// Export main component
export { DocusaurusAISearch } from './components/DocusaurusAISearch';

// Export environment variables plugin
export { default as envPlugin } from './envPlugin';

// Export configuration types
export type { 
  DocusaurusAISearchProps,
  DocusaurusAISearchConfig,
  OpenAIOptions,
  UIOptions,
  PromptOptions
} from './types';
