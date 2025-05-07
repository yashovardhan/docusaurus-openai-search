import { InternalDocSearchHit } from '@docsearch/react';

/**
 * OpenAI search configuration options
 */
export interface OpenAISearchOptions {
  /** OpenAI API Key */
  apiKey: string;
  /** Model to use for AI search queries, defaults to gpt-4 */
  model?: string;
  /** Maximum tokens to use in AI requests */
  maxTokens?: number;
  /** Temperature for AI responses (0-1), lower is more deterministic */
  temperature?: number;
  /** Whether to enable AI search features */
  enabled?: boolean;
  /** Function to call when an AI query is made, for analytics */
  onAIQuery?: (query: string, success: boolean) => void;
}

/**
 * Configuration for the AI search component
 */
export interface AISearchConfig extends OpenAISearchOptions {
  /** Algolia configuration from Docusaurus */
  algoliaConfig: any;
  /** Optional UI text customizations */
  textOverrides?: {
    aiButtonText?: string;
    aiButtonAriaLabel?: string;
    modalTitle?: string;
    loadingText?: string;
    errorText?: string;
    retryButtonText?: string;
    footerText?: string;
  };
}

/**
 * Search result with relevance score
 */
export interface RankedSearchResult {
  result: InternalDocSearchHit;
  score: number;
}

/**
 * Document content from search results
 */
export interface DocumentContent {
  url: string;
  title: string;
  content: string;
}

// Global type augmentations
declare global {
  interface Window {
    // Google Analytics tracking function
    gtag?: (command: string, action: string, params: Record<string, any>) => void;
    
    // Global configuration for OpenAI API key
    OPENAI_API_KEY?: string;
  }
}

// Module declarations moved to declarations.d.ts 