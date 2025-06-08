// Import CSS directly as requested
import './styles.css';

// Export main component
export { DocusaurusAISearch } from './components/DocusaurusAISearch';

// Export search orchestrator for advanced usage
export { 
  SearchOrchestrator,
  type SearchStep,
  type DocumentContent
} from './utils/searchOrchestrator';

// Export default configuration for reference
export { 
  DEFAULT_CONFIG
} from './config/defaults';

// Export configuration types
export type { 
  DocusaurusAISearchProps,
  DocusaurusAISearchConfig,
  BackendOptions,
  UIOptions,
  ContextOptions
} from './types';
