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
  /** Text for loading/generating answer */
  loadingText?: string;
  /** Text for retry button */
  retryButtonText?: string;
  /** Prefix for the question display (default: "Q:") */
  questionPrefix?: string;
  /** Label for search keywords section */
  searchKeywordsLabel?: string;
  /** Label for documents found section */
  documentsFoundLabel?: string;
  /** Text for "and X more" when showing limited documents */
  documentsMoreText?: string;
  /** Header text for sources section */
  sourcesHeaderText?: string;
  /** Text shown above search links on error */
  searchLinksHelpText?: string;
  /** Text for "See all X results" link */
  seeAllResultsText?: string;
  /** Close button aria label */
  closeButtonAriaLabel?: string;
  /** Text shown when retrieving documents */
  retrievingText?: string;
  /** Text shown when generating AI response */
  generatingText?: string;
  /** Text appended when response is from cache */
  cachedResponseText?: string;
  /** Text pattern for document analysis count (use {count} as placeholder) */
  documentsAnalyzedText?: string;
  /** Text shown when only search results are available */
  searchResultsOnlyText?: string;
  /** Aria label for the AI button in search */
  aiButtonAriaLabel?: string;
  /** Text for no documents found error */
  noDocumentsFoundError?: string;
  /** Text for no search results error */
  noSearchResultsError?: string;
  // Search button customization
  /** Text for the search button */
  searchButtonText?: string;
  /** Aria label for the search button */
  searchButtonAriaLabel?: string;
  /** Placeholder text for the search input */
  searchInputPlaceholder?: string;
  /** Custom class name for the search button */
  searchButtonClassName?: string;
  /** Show/hide the keyboard shortcut hint (Cmd/Ctrl+K) */
  showSearchButtonShortcut?: boolean;
  /** Use a custom search button instead of the default DocSearch button */
  useCustomSearchButton?: boolean;
}

/**
 * reCAPTCHA configuration
 */
export interface RecaptchaOptions {
  /** Google reCAPTCHA v3 site key */
  siteKey: string;
}

/**
 * Stage 2: Multi-source search configuration
 */
export interface GitHubOptions {
  /** GitHub repository in format "owner/repo" */
  repo: string;
  /** Search types to include (default: ['issues', 'discussions']) */
  searchTypes?: ('issues' | 'discussions' | 'code')[];
  /** Maximum number of results to fetch from GitHub (default: 5) */
  maxResults?: number;
}

export interface BlogOptions {
  /** Base URL of the blog to search */
  url: string;
  /** Blog platform type for specialized parsing */
  platform?: 'wordpress' | 'ghost' | 'medium' | 'generic';
  /** Maximum number of blog posts to include (default: 3) */
  maxResults?: number;
}

export interface ChangelogOptions {
  /** URL of the changelog file or API endpoint */
  url: string;
  /** Format of the changelog (default: 'markdown') */
  format?: 'markdown' | 'json' | 'rss';
  /** Maximum number of changelog entries to include (default: 2) */
  maxResults?: number;
}

export interface MultiSourceOptions {
  /** Enable multi-source search functionality */
  enabled?: boolean;
  /** GitHub integration configuration */
  github?: GitHubOptions;
  /** Blog search configuration */
  blog?: BlogOptions;
  /** Changelog search configuration */
  changelog?: ChangelogOptions;
  /** Weight for aggregating results from different sources */
  aggregationWeights?: {
    documentation?: number;
    github?: number;
    blog?: number;
    changelog?: number;
  };
}

/**
 * Stage 3: Fine-tuned model enhancement configuration
 */
export interface EnhancementOptions {
  /** Enable recursive document enhancement with fine-tuned model */
  recursiveSearch?: boolean;
  /** Fine-tuned model ID for enhanced context gathering */
  fineTunedModelId?: string;
  /** Maximum recursion depth (default: 2) */
  maxDepth?: number;
  /** Timeout for recursive operations in milliseconds (default: 5000) */
  timeout?: number;
}

/**
 * Stage 2: Advanced AI features configuration
 */
export interface AIFeaturesOptions {
  /** Enable query understanding and intelligent processing */
  queryUnderstanding?: boolean;
  /** Multi-source search configuration */
  multiSource?: MultiSourceOptions;
  /** Enable intelligent result ranking */
  intelligentRanking?: boolean;
  /** Enable conversational memory between searches */
  conversationalMemory?: {
    enabled?: boolean;
    /** Session duration in seconds (default: 3600) */
    sessionDuration?: number;
  };
  /** Enable follow-up question suggestions */
  followUpSuggestions?: boolean;
  /** Enable answer quality scoring */
  qualityScoring?: boolean;
  /** Stage 3: Fine-tuned model enhancement */
  enhancement?: EnhancementOptions;
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
  
  /** reCAPTCHA configuration for bot protection */
  recaptcha?: RecaptchaOptions;
  
  /** Stage 2: Advanced AI features configuration */
  features?: AIFeaturesOptions;
  
  // Optional: Custom search button rendering
  useCustomSearchButton?: boolean;
  
  // Optional: Callback for user feedback on answers
  onFeedback?: (query: string, rating: string, queryType?: string) => void;
  enableFeedback?: boolean;
  
  // Optional: Callback when follow-up question is clicked
  onFollowUpQuestionClick?: (question: string) => void;
  
  // Optional: System context for backend (used in prompts)
  systemContext?: string;
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

/**
 * Week 5-6: Multi-source search result type
 */
export interface MultiSourceResult {
  source: 'documentation' | 'github' | 'blog' | 'changelog';
  title: string;
  url: string;
  content: string;
  metadata: {
    weight: number;
    timestamp?: string;
    author?: string;
    type?: string;
  };
}

/**
 * Week 5-6: Aggregated search result with multiple sources
 */
export interface AggregatedSearchResult {
  answer: string;
  sources: MultiSourceResult[];
  aggregationMetrics: {
    totalSources: number;
    sourceBreakdown: Record<string, number>;
    confidenceScore: number;
  };
}

/**
 * Week 6: Conversation turn for memory
 */
export interface ConversationTurn {
  query: string;
  answer: string;
  timestamp: Date;
  queryAnalysis?: {
    type?: string;
    intent?: string;
    complexity?: string;
  };
  sources?: MultiSourceResult[];
  validation?: any;
}

/**
 * Week 6: Conversation session
 */
export interface ConversationSession {
  sessionId: string;
  turns: ConversationTurn[];
  createdAt: Date;
  lastActiveAt: Date;
  context: string;
}

// Global type augmentations
declare global {
  interface Window {
    // Google Analytics tracking function
    gtag?: (command: string, action: string, params: Record<string, any>) => void;
  }
}

// Module declarations moved to declarations.d.ts 