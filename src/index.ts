// Import CSS directly as requested
import './styles.css';

// Export main component
export { DocusaurusAISearch } from './components/DocusaurusAISearch';

// Export proxy utilities
export { 
  makeProxyRequest, 
  createProxyChatCompletion, 
  createProxySummarization 
} from './utils/proxy';

// Export configuration types
export type { 
  DocusaurusAISearchProps,
  DocusaurusAISearchConfig,
  OpenAIOptions,
  UIOptions,
  PromptOptions
} from './types';

// Export proxy types
export type { ProxyRequestOptions } from './utils/proxy';
