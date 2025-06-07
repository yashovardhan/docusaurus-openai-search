// Import CSS directly as requested
import './styles.css';

// Export main component
export { DocusaurusAISearch } from './components/DocusaurusAISearch';

// Export proxy utilities
export { 
  makeProxyRequest, 
  createProxyChatCompletion
} from './utils/proxy';

// Export search orchestrator for advanced usage
export { 
  SearchOrchestrator,
  type SearchStep,
  type SearchContext,
  type QueryIntent,
  type DocumentContent
} from './utils/searchOrchestrator';

// Export default configuration for reference
export { 
  DEFAULT_CONFIG,
  QUERY_ANALYSIS_SYSTEM_PROMPT,
  COMMON_DOC_PATTERNS,
  SITEMAP_PATTERNS,
} from './config/defaults';

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
