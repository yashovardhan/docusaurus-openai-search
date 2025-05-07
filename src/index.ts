// Export main components
export { AiEnhancedSearchBar } from './components/AiEnhancedSearchBar';
export { AISearchModal } from './components/AISearchModal';

// Export utility functions
export {
  trackAIQuery,
  fetchDocumentContent,
  chunkText,
  rankSearchResultsByRelevance,
  retrieveDocumentContent,
  generateFallbackContent,
} from './utils';

// Export types
export type { OpenAISearchOptions, AISearchConfig, DocumentContent } from './types';
export type { AiEnhancedSearchBarProps } from './components/AiEnhancedSearchBar';
export type { InternalDocSearchHit } from '@docsearch/react';
