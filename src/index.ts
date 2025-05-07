// Main exports
export { AiEnhancedSearchBar } from "./components/AiEnhancedSearchBar";
export { AISearchModal } from "./components/AISearchModal";

// Utility exports
export {
  trackAIQuery,
  fetchDocumentContent,
  chunkText,
  processDocumentContent,
  rankSearchResultsByRelevance,
  retrieveDocumentContent,
  generateFallbackContent,
} from "./utils/contentUtils";

// Re-export for simpler usage
export type { InternalDocSearchHit } from "@docsearch/react";
