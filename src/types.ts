import { InternalDocSearchHit } from '@docsearch/react';

/**
 * Context options to send to backend
 */
export interface ContextOptions {
  /** Name of your site or product */
  siteName?: string;
  /** Additional context about your product/service to help AI understand queries better */
  systemContext?: string;
}

/**
 * Backend configuration
 */
export interface BackendOptions {
  /** URL of your backend service that handles AI operations */
  url: string;
}

/**
 * UI customization options
 */
export interface UIOptions {
  /** Custom text for the AI button */
  aiButtonText?: string;
  /** Title of the AI modal */
  modalTitle?: string;
  /** Error text when AI generation fails */
  errorText?: string;
  /** Footer text in the AI modal */
  footerText?: string;
}

/**
 * Docusaurus AI Search configuration
 */
export interface DocusaurusAISearchConfig {
  /** Backend service configuration */
  backend: BackendOptions;
  
  /** UI customization options */
  ui?: UIOptions;
  
  /** Context to send to backend */
  context?: ContextOptions;
  
  /** Enable or disable AI search features */
  enabled?: boolean;
  
  /** Maximum number of search queries to request from backend (default: 5) */
  maxSearchQueries?: number;
  
  /** Enable response caching (default: true) */
  enableCaching?: boolean;
  
  /** Cache TTL in seconds (default: 3600) */
  cacheTTL?: number;
  
  /** Callback function when an AI query is made */
  onAIQuery?: (query: string, success: boolean) => void;
  
  /** Enable detailed logging for debugging */
  enableLogging?: boolean;
}

/**
 * Algolia DocSearch configuration
 */
export interface AlgoliaSearchConfig {
  appId: string;
  apiKey: string;
  indexName: string;
  contextualSearch?: boolean;
  searchPagePath?: string | boolean;
  externalUrlRegex?: string;
  searchParameters?: Record<string, any>;
  transformItems?: (items: any[]) => any[];
  placeholder?: string;
  translations?: {
    button?: {
      buttonText?: string;
      buttonAriaLabel?: string;
    };
    modal?: Record<string, any>;
  };
}

/**
 * Docusaurus theme configuration
 */
export interface DocusaurusThemeConfig {
  /** Algolia DocSearch configuration */
  algolia: AlgoliaSearchConfig;
  /** Prism syntax highlighting configuration */
  prism: {
    theme: string | object;
    darkTheme?: string | object;
  };
  /** Color mode configuration */
  colorMode?: {
    respectPrefersColorScheme?: boolean;
  };
  /** Hideable sidebar configuration */
  hideableSidebar?: boolean;
}

/**
 * Props for the DocusaurusAISearch component
 */
export interface DocusaurusAISearchProps {
  /** Docusaurus theme configuration */
  themeConfig: DocusaurusThemeConfig;
  /** AI search configuration */
  aiConfig: DocusaurusAISearchConfig;
}

/**
 * Props for the AI Search Modal component
 */
export interface AISearchModalProps {
  /** The search query */
  query: string;
  
  /** Function to close the modal */
  onClose: () => void;
  
  /** Search results from Algolia */
  searchResults: InternalDocSearchHit[];
  
  /** AI configuration */
  config?: DocusaurusAISearchConfig;
  
  /** Theme configuration for code highlighting */
  themeConfig?: any;
  
  /** Algolia configuration for intelligent search */
  algoliaConfig?: {
    searchClient: any;
    indexName: string;
  };
}

/**
 * Props for the AI-enhanced Search Bar component
 */
export interface AISearchBarProps {
  contextualSearch?: boolean;
  externalUrlRegex?: string;
  searchParameters?: Record<string, any>;
  transformItems?: (items: any[]) => any[];
  appId?: string;
  apiKey?: string;
  indexName?: string;
  placeholder?: string;
  searchPagePath?: string | boolean;
  translations?: {
    button?: {
      buttonText?: string;
      buttonAriaLabel?: string;
    };
    modal?: Record<string, any>;
  };
  aiConfig?: DocusaurusAISearchConfig;
}

// Global type augmentations
declare global {
  interface Window {
    // Google Analytics tracking function
    gtag?: (command: string, action: string, params: Record<string, any>) => void;
  }
}

// Module declarations moved to declarations.d.ts 