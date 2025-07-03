import React, { useCallback, useEffect, useState, useRef, useMemo } from 'react';
import { AISearchModalProps } from '../types';
import {
  createLogger,
  SearchOrchestrator,
  ResponseCache,
  type SearchStep,
  type DocumentContent
} from '../utils';
import { 
  ModalCleanupUtils, 
  RefCleanupUtils, 
  useCleanup 
} from '../utils/cleanup';
import { useErrorBoundary } from '../components/ErrorBoundary';
import '../styles.css';
import { DEFAULT_CONFIG } from '../config/defaults';

// P4-002: Lazy load heavy dependencies to improve initial bundle size
type LazyMarkdownComponents = {
  ReactMarkdown: React.ComponentType<any>;
  remarkGfm: any;
  rehypeRaw: any;
  Highlight: React.ComponentType<any>;
  prismThemes: any;
};

// Cache for loaded components
let markdownComponents: LazyMarkdownComponents | null = null;
let markdownLoadPromise: Promise<LazyMarkdownComponents> | null = null;

// P4-002: Lazy load markdown dependencies
async function loadMarkdownDependencies(): Promise<LazyMarkdownComponents> {
  if (markdownComponents) {
    return markdownComponents;
  }
  
  if (markdownLoadPromise) {
    return markdownLoadPromise;
  }
  
  markdownLoadPromise = Promise.all([
    import('react-markdown'),
    import('remark-gfm'),
    import('rehype-raw'),
    import('prism-react-renderer')
  ]).then(([reactMarkdown, remarkGfm, rehypeRaw, prismRenderer]) => {
    const components = {
      ReactMarkdown: reactMarkdown.default,
      remarkGfm: remarkGfm.default,
      rehypeRaw: rehypeRaw.default,
      Highlight: prismRenderer.Highlight,
      prismThemes: prismRenderer.themes
    };
    
    markdownComponents = components;
    return components;
  });
  
  return markdownLoadPromise;
}

// Type definitions for code component props
interface CodeProps {
  node?: any;
  inline?: boolean;
  className?: string;
  children: React.ReactNode;
  theme?: any; // P4-002: Use 'any' type since PrismTheme is lazy loaded
}

/**
 * Custom code block renderer for ReactMarkdown
 * P4-002: Updated to work with lazy-loaded components
 */
const CodeBlock = React.memo(({ node, inline, className, children, components, ...props }: CodeProps & { components?: LazyMarkdownComponents }) => {
  const match = /language-(\w+)/.exec(className || '');
  const language = match && match[1] ? match[1] : '';
  const code = String(children).replace(/\n$/, '');

  if (!inline && language && components) {
    const { Highlight, prismThemes } = components;
    
    return (
      <Highlight 
        theme={props.theme || prismThemes.github} 
        code={code} 
        language={language}
      >
        {({ className, style, tokens, getLineProps, getTokenProps }: any) => (
          <pre className={className} style={style}>
            {tokens.map((line: any, i: number) => (
              <div key={i} {...getLineProps({ line })}>
                {line.map((token: any, key: number) => (
                  <span key={key} {...getTokenProps({ token })} />
                ))}
              </div>
            ))}
          </pre>
        )}
      </Highlight>
    );
  }

  return (
    <code className={className} {...props}>
      {children}
    </code>
  );
});

/**
 * Modal component that displays AI-generated answers to search queries
 */
export function AISearchModal({
  query,
  onClose,
  searchResults,
  config,
  themeConfig,
  algoliaConfig
}: AISearchModalProps): JSX.Element {
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [answer, setAnswer] = useState<string | null>(null);
  const [formattedAnswer, setFormattedAnswer] = useState<string>('');
  const [retrievedContent, setRetrievedContent] = useState<DocumentContent[]>([]);
  const [searchStep, setSearchStep] = useState<SearchStep | null>(null);
  const [fetchFailed, setFetchFailed] = useState<boolean>(false);
  const [isRetrying, setIsRetrying] = useState<boolean>(false);
  const [queryAnalysis, setQueryAnalysis] = useState<string>('');
  const [aiCallCount, setAiCallCount] = useState<number>(0);
  const [isFromCache, setIsFromCache] = useState<boolean>(false);
  const [isGeneratingAnswer, setIsGeneratingAnswer] = useState(false);
  
  // P4-002: State for lazy-loaded markdown components
  const [markdownComponentsLoaded, setMarkdownComponentsLoaded] = useState<LazyMarkdownComponents | null>(null);
  const [markdownLoading, setMarkdownLoading] = useState<boolean>(false);
  
  // Reference to the markdown container
  const markdownRef = useRef<HTMLDivElement>(null);
  
  // Reference to search orchestrator
  const orchestratorRef = useRef<SearchOrchestrator | null>(null);
  
  // Ref to track if answer generation has started to prevent duplicates
  const answerGenerationStartedRef = useRef<boolean>(false);
  
  // Cache instance
  const cache = ResponseCache.getInstance();
  
  // Cleanup hook for component
  const { registerCleanup, cleanupComponent } = useCleanup('ai-search-modal');
  
  // P3-001: Error boundary hook for enhanced error handling
  const { createErrorHandler } = useErrorBoundary();

  // Initialize logger with enableLogging config
  useEffect(() => {
    createLogger(config?.enableLogging || false);
  }, [config?.enableLogging]);
  
  // P4-002: Load markdown components when modal opens
  useEffect(() => {
    if (!markdownComponentsLoaded && !markdownLoading) {
      setMarkdownLoading(true);
      loadMarkdownDependencies()
        .then((components) => {
          setMarkdownComponentsLoaded(components);
          setMarkdownLoading(false);
        })
        .catch((error) => {
          console.error('[AI Search Modal] Failed to load markdown components:', error);
          setMarkdownLoading(false);
        });
    }
  }, [markdownComponentsLoaded, markdownLoading]);

  // Get the backend URL from config
  const backendUrl = config?.backend?.url;

  // P4-001 & P4-002: Memoize Prism theme computation with lazy-loaded components
  const prismTheme = useMemo(() => {
    // P4-002: Return null if markdown components aren't loaded yet
    if (!markdownComponentsLoaded?.prismThemes) {
      return null;
    }
    
    const isDarkTheme = typeof document !== 'undefined' && 
                        document.documentElement.dataset.theme === 'dark';
    
    if (themeConfig?.prism) {
      if (isDarkTheme && 
          themeConfig.prism.darkTheme && 
          typeof themeConfig.prism.darkTheme === 'object' &&
          'plain' in themeConfig.prism.darkTheme &&
          'styles' in themeConfig.prism.darkTheme) {
        return themeConfig.prism.darkTheme;
      } else if (
          themeConfig.prism.theme &&
          typeof themeConfig.prism.theme === 'object' &&
          'plain' in themeConfig.prism.theme &&
          'styles' in themeConfig.prism.theme) {
        return themeConfig.prism.theme;
      }
    }
    
    // Default to standard themes if custom ones aren't available
    return isDarkTheme ? markdownComponentsLoaded.prismThemes.vsDark : markdownComponentsLoaded.prismThemes.github;
  }, [themeConfig?.prism, markdownComponentsLoaded?.prismThemes]);

  // P4-001: Memoize modal texts to prevent object recreation on every render
  const modalTexts = useMemo(() => ({
    modalTitle: config?.ui?.modalTitle || DEFAULT_CONFIG.ui.modalTitle,
    loadingText: config?.ui?.loadingText || DEFAULT_CONFIG.ui.loadingText,
    errorText: config?.ui?.errorText || DEFAULT_CONFIG.ui.errorText,
    retryButtonText: config?.ui?.retryButtonText || DEFAULT_CONFIG.ui.retryButtonText,
    footerText: config?.ui?.footerText || DEFAULT_CONFIG.ui.footerText,
    retrievingText: config?.ui?.retrievingText || DEFAULT_CONFIG.ui.retrievingText,
    generatingText: config?.ui?.generatingText || DEFAULT_CONFIG.ui.generatingText,
    questionPrefix: config?.ui?.questionPrefix || DEFAULT_CONFIG.ui.questionPrefix,
    searchKeywordsLabel: config?.ui?.searchKeywordsLabel || DEFAULT_CONFIG.ui.searchKeywordsLabel,
    documentsFoundLabel: config?.ui?.documentsFoundLabel || DEFAULT_CONFIG.ui.documentsFoundLabel,
    documentsMoreText: config?.ui?.documentsMoreText || DEFAULT_CONFIG.ui.documentsMoreText,
    sourcesHeaderText: config?.ui?.sourcesHeaderText || DEFAULT_CONFIG.ui.sourcesHeaderText,
    searchLinksHelpText: config?.ui?.searchLinksHelpText || DEFAULT_CONFIG.ui.searchLinksHelpText,
    closeButtonAriaLabel: config?.ui?.closeButtonAriaLabel || DEFAULT_CONFIG.ui.closeButtonAriaLabel,
    cachedResponseText: config?.ui?.cachedResponseText || DEFAULT_CONFIG.ui.cachedResponseText,
    documentsAnalyzedText: config?.ui?.documentsAnalyzedText || DEFAULT_CONFIG.ui.documentsAnalyzedText,
    searchResultsOnlyText: config?.ui?.searchResultsOnlyText || DEFAULT_CONFIG.ui.searchResultsOnlyText,
    noDocumentsFoundError: config?.ui?.noDocumentsFoundError || DEFAULT_CONFIG.ui.noDocumentsFoundError,
    noSearchResultsError: config?.ui?.noSearchResultsError || DEFAULT_CONFIG.ui.noSearchResultsError,
  }), [config?.ui]);

  // P2-001: Enhanced retry handler with proper ref reset and safety checks
  const handleRetry = useCallback(() => {
    // Reset all states
    setIsRetrying(true);
    setError(null);
    setLoading(true);
    setSearchStep(null);
    setRetrievedContent([]);
    setAnswer(null);
    setIsGeneratingAnswer(false);
    
    // P2-001: Enhanced ref reset with safety checks
    try {
      // Ensure answerGenerationStartedRef is properly reset
      if (answerGenerationStartedRef && answerGenerationStartedRef.current !== undefined) {
        answerGenerationStartedRef.current = false;
      }
      
      // P3-002: Reset orchestrator and cancel pending operations
      if (orchestratorRef.current) {
        // Cancel any ongoing operations before retry
        if (typeof orchestratorRef.current.cancelAllOperations === 'function') {
          orchestratorRef.current.cancelAllOperations();
        }
        orchestratorRef.current = null;
      }
    } catch (error) {
      console.error('[AI Search Modal] Error during retry ref reset:', error);
    }

    // Set a small delay to ensure UI updates before retrying
    setTimeout(() => {
      setIsRetrying(false);
      // The useEffects will handle the retry
    }, 100);
  }, []);
  
  // P2-001: Enhanced close handler with comprehensive ref reset and safety checks
  const handleClose = useCallback(() => {
    // Pre-close safety checks
    try {
      // Ensure answerGenerationStartedRef is properly reset with safety check
      if (answerGenerationStartedRef && answerGenerationStartedRef.current !== undefined) {
        answerGenerationStartedRef.current = false;
      }
      
      // P3-002: Stop any ongoing orchestrator operations
      if (orchestratorRef.current) {
        // Cancel all pending operations before clearing reference
        if (typeof orchestratorRef.current.cancelAllOperations === 'function') {
          orchestratorRef.current.cancelAllOperations();
        }
        orchestratorRef.current = null;
      }
      
      // Reset refs on modal close with null checks
      RefCleanupUtils.clearRefs(markdownRef, orchestratorRef, answerGenerationStartedRef);
      
      // Reset all state to initial values
      ModalCleanupUtils.cleanupModal({
        refs: [markdownRef, orchestratorRef, answerGenerationStartedRef],
        states: [
          { setter: setLoading, initialValue: true },
          { setter: setError, initialValue: null },
          { setter: setAnswer, initialValue: null },
          { setter: setFormattedAnswer, initialValue: '' },
          { setter: setRetrievedContent, initialValue: [] },
          { setter: setSearchStep, initialValue: null },
          { setter: setFetchFailed, initialValue: false },
          { setter: setIsRetrying, initialValue: false },
          { setter: setQueryAnalysis, initialValue: '' },
          { setter: setAiCallCount, initialValue: 0 },
          { setter: setIsFromCache, initialValue: false },
          { setter: setIsGeneratingAnswer, initialValue: false }
        ]
      });
      
    } catch (error) {
      // Safety net - log error but don't prevent modal from closing
      console.error('[AI Search Modal] Error during close cleanup:', error);
    } finally {
      // Always call the original onClose regardless of cleanup success
      onClose();
    }
  }, [onClose]);

  // P2-001: Enhanced ref initialization and orchestrator setup with safety checks
  useEffect(() => {
    // Ensure answerGenerationStartedRef is properly initialized
    if (answerGenerationStartedRef.current === undefined || answerGenerationStartedRef.current === null) {
      answerGenerationStartedRef.current = false;
    }
    
    // Initialize orchestrator with safety checks
    if (backendUrl && config && !orchestratorRef.current) {
      orchestratorRef.current = new SearchOrchestrator(
        config,
        (step) => setSearchStep(step)
      );
    }
    
    // Initialization cleanup on unmount
    return () => {
      // Ensure refs are properly reset on unmount
      if (answerGenerationStartedRef.current !== undefined) {
        answerGenerationStartedRef.current = false;
      }
    };
  }, [backendUrl, config]);
  
  // P2-001: Enhanced component lifecycle management with ref monitoring
  useEffect(() => {
    // Register cleanup tasks with enhanced ref management
    registerCleanup('refs', () => {
      RefCleanupUtils.clearRefs(markdownRef, orchestratorRef, answerGenerationStartedRef);
    }, 10);
    
    registerCleanup('orchestrator', () => {
      if (orchestratorRef.current) {
        // P3-002: Enhanced orchestrator cleanup with operation cancellation
        if (typeof orchestratorRef.current.cancelAllOperations === 'function') {
          orchestratorRef.current.cancelAllOperations();
        }
        orchestratorRef.current = null;
      }
    }, 5);
    
    registerCleanup('answerGeneration', () => {
      // Ensure answer generation ref is properly reset
      if (answerGenerationStartedRef && answerGenerationStartedRef.current !== undefined) {
        answerGenerationStartedRef.current = false;
      }
    }, 8);
    
    return () => {
      // Clear state on unmount with enhanced safety
      try {
        cleanupComponent();
      } catch (error) {
        console.error('[AI Search Modal] Error during component cleanup:', error);
      }
    };
  }, [registerCleanup, cleanupComponent]);
  
  // P2-001: Monitor ref state changes for debugging and safety
  useEffect(() => {
    // Optional: Add development-only ref state monitoring
    if (process.env.NODE_ENV === 'development' && config?.enableLogging) {
      const checkRefs = () => {
        console.debug('[AI Search Modal] Ref states:', {
          markdownRef: !!markdownRef.current,
          orchestratorRef: !!orchestratorRef.current,
          answerGenerationStarted: answerGenerationStartedRef.current
        });
      };
      
      // Initial check
      checkRefs();
    }
  }, [config?.enableLogging]);

  // P3-001 & P3-002: Enhanced document content retrieval with comprehensive error handling and race condition protection
  useEffect(() => {
    const errorHandler = createErrorHandler('AISearchModal-fetchContent');
    let isCancelled = false; // P3-002: Race condition protection
    
    async function fetchContent() {
      if (!query) {
        setLoading(false);
        return;
      }

      // Skip if we're retrying
      if (isRetrying) {
        return;
      }

      // Skip if we already have content and an answer
      if (retrievedContent.length > 0 && answer) {
        return;
      }

      // P3-002: Check if this effect instance was cancelled
      if (isCancelled) {
        return;
      }

      try {
        setFetchFailed(false);

        // Check cache first if enabled
        const enableCaching = config?.enableCaching ?? DEFAULT_CONFIG.enableCaching;
        const cacheTTL = config?.cacheTTL || DEFAULT_CONFIG.cacheTTL;
        
        if (enableCaching) {
          const cached = cache.getCached(query, cacheTTL);
          if (cached) {
            if (cached.response) {
              // P3-002: Check for race condition before setting state
              if (isCancelled) return;
              
              // Full cache hit - we have everything
              setAnswer(cached.response);
              setRetrievedContent(cached.documents || []);
              setQueryAnalysis(cached.queryAnalysis || '');
              setIsFromCache(true);
              setLoading(false);
              
              // Track cached response
              if (config?.onAIQuery) {
                config.onAIQuery(query, true);
              }
              return;
            }
          }
        }

        // Use AI search with the new orchestrator
        if (orchestratorRef.current && algoliaConfig) {
          const result = await orchestratorRef.current.performAISearch(
            query,
            algoliaConfig.searchClient,
            algoliaConfig.indexName
          );

          // P3-002: Check for race condition after async operation
          if (isCancelled) return;

          if (result.documents.length === 0) {
            throw new Error(modalTexts.noDocumentsFoundError);
          }

          setRetrievedContent(result.documents);
          setAnswer(result.answer);
          
          // Cache the complete response if caching is enabled
          if (enableCaching) {
            cache.set(query, result.answer, '', result.documents);
          }
          
          // Track successful AI query
          if (config?.onAIQuery) {
            config.onAIQuery(query, true);
          }
          
          setLoading(false);
        } else {
          // Fallback to original search behavior
          if (searchResults.length === 0) {
            throw new Error(modalTexts.noSearchResultsError);
          }

          setSearchStep({
            step: 'documents-found',
            message: modalTexts.retrievingText,
            progress: 50
          });

          // Simple content extraction from search results
          const maxDocs = 5; // Backend will handle the actual document limit
          const documents: DocumentContent[] = searchResults.slice(0, maxDocs).map((result) => {
            let content = '';
            
            // Build content from hierarchy
            if (result.hierarchy) {
              const levels = ['lvl0', 'lvl1', 'lvl2', 'lvl3', 'lvl4', 'lvl5'] as const;
              levels.forEach(level => {
                const value = result.hierarchy[level];
                if (value) {
                  content += `${value}\n`;
                }
              });
            }
            
            // Add snippet
            if (result._snippetResult?.content?.value) {
              content += `\n${result._snippetResult.content.value}`;
            }
            
            // Add full content if available
            if (result.content) {
              content += `\n${result.content}`;
            }

            return {
              url: result.url || '',
              title: result.hierarchy?.lvl1 || result.hierarchy?.lvl0 || 'Document',
              content: content || 'No content available'
            };
          });

          // P3-002: Check for race condition before setting fallback data
          if (isCancelled) return;
          
          setRetrievedContent(documents);
        }
      } catch (err: any) {
        // P3-001: Enhanced error handling with error boundary integration
        console.error('[AISearchModal] Error in fetchContent:', err);
        
        setSearchStep(null);
        
        // Determine if this is a critical error that should trigger error boundary
        const isCriticalError = err instanceof TypeError || 
                               err.message?.includes('network') ||
                               err.message?.includes('fetch') ||
                               err.name === 'AbortError';
        
        if (isCriticalError) {
          // For critical errors, trigger error boundary
          errorHandler(err, { context: 'fetchContent', query });
        } else {
          // For non-critical errors, show user-friendly message
          setError(
            `Unable to find relevant documentation: ${err.message || 'Unknown error'}. Please try a different search query.`
          );
          setLoading(false);
          
          // Track failed AI query if function is provided
          if (config?.onAIQuery) {
            config.onAIQuery(query, false);
          }
        }
      }
    }

    fetchContent();
    
    // P3-002: Cleanup function to prevent race conditions
    return () => {
      isCancelled = true;
      // Cancel orchestrator operations if they're running
      if (orchestratorRef.current && typeof orchestratorRef.current.cancelAllOperations === 'function') {
        orchestratorRef.current.cancelAllOperations();
      }
    };
  }, [query, searchResults.length, algoliaConfig?.indexName]); // Minimal dependencies

  // P3-001: Enhanced markdown response handling with error protection
  useEffect(() => {
    const errorHandler = createErrorHandler('AISearchModal-markdownProcessing');
    
    try {
      if (answer) {
        let markdownContent = answer;

        // Add source references if we have retrieved content
        if (retrievedContent.length > 0) {
          const sourcesMarkdown = `

---

**${modalTexts.sourcesHeaderText}**
${retrievedContent.slice(0, 5).map((doc, idx) => 
  `${idx + 1}. [${doc.title}](${doc.url})`
).join('\n')}`;

          markdownContent += sourcesMarkdown;
        }

        setFormattedAnswer(markdownContent);
      }
    } catch (err: any) {
      console.error('[AISearchModal] Error processing markdown:', err);
      // For markdown processing errors, fallback to plain text
      if (answer) {
        setFormattedAnswer(answer);
      }
    }
  }, [answer, config, retrievedContent, createErrorHandler]);

  // P3-001: Enhanced DOM manipulation with error protection
  useEffect(() => {
    try {
      if (markdownRef.current && !loading && !error) {
        // Find all blockquotes
        const blockquotes = markdownRef.current.querySelectorAll('blockquote');
        
        blockquotes.forEach(blockquote => {
          try {
            // Find the first strong tag in the blockquote
            const firstStrong = blockquote.querySelector('p:first-child strong:first-child');
            
            if (firstStrong) {
              const text = firstStrong.textContent?.trim().toLowerCase();
              
              // Add appropriate class based on content
              if (text === 'note' || text === 'info') {
                blockquote.classList.add('note');
              } else if (text === 'tip') {
                blockquote.classList.add('tip');
              } else if (text === 'warning') {
                blockquote.classList.add('warning');
              } else if (text === 'danger' || text === 'caution') {
                blockquote.classList.add('danger');
              }
            }
          } catch (blockquoteError) {
            console.warn('[AISearchModal] Error processing blockquote:', blockquoteError);
            // Continue with other blockquotes even if one fails
          }
        });
      }
    } catch (err: any) {
      console.error('[AISearchModal] Error in DOM manipulation:', err);
      // DOM manipulation errors are non-critical, just log and continue
    }
  }, [loading, error, formattedAnswer]);

  // Create the classes for the modal based on Docusaurus theme variables
  const modalClasses = {
    overlay: [
      'ai-modal-overlay',
      themeConfig?.colorMode?.respectPrefersColorScheme ? 'respect-color-scheme' : '',
    ].filter(Boolean).join(' '),
    content: [
      'ai-modal-content',
      themeConfig?.hideableSidebar ? 'hideable-sidebar' : '',
    ].filter(Boolean).join(' ')
  };

  return (
    <div
      className={modalClasses.overlay}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          handleClose();
        }
      }}
    >
      <div className={modalClasses.content}>
        <div className="ai-modal-header">
          <h3>{modalTexts.modalTitle}</h3>
          <button className="ai-modal-close" onClick={handleClose} aria-label={modalTexts.closeButtonAriaLabel}>
            &times;
          </button>
        </div>

        <div className="ai-modal-body">
          <div className="ai-question">
            <strong>{modalTexts.questionPrefix}</strong> {query}
          </div>

          {loading ? (
            <div className="ai-loading">
              <div className="ai-loading-spinner"></div>
              <div className="ai-loading-status">
                {searchStep ? (
                  <>
                    <div className="ai-progress-bar">
                      <div 
                        className="ai-progress-fill"
                        style={{ width: `${searchStep.progress}%` }}
                      />
                    </div>
                    <div className="ai-step-message">{searchStep.message}</div>
                    
                    {/* Display detailed progress information */}
                    {searchStep.details && (
                      <div className="ai-progress-details">
                        {searchStep.details.keywords && searchStep.details.keywords.length > 0 && (
                          <div className="ai-keywords-section">
                            <strong>{modalTexts.searchKeywordsLabel}</strong>
                            <ul className="ai-keywords-list">
                              {searchStep.details.keywords.map((keyword, idx) => (
                                <li key={idx} className="ai-keyword-item">{keyword}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        
                        {searchStep.details.documentsFound !== undefined && searchStep.details.documentsFound > 0 && (
                          <div className="ai-documents-section">
                            <strong>{modalTexts.documentsFoundLabel.replace('{count}', searchStep.details.documentsFound.toString())}</strong>
                            {searchStep.details.documentLinks && searchStep.details.documentLinks.length > 0 && (
                              <ul className="ai-document-links">
                                {searchStep.details.documentLinks.slice(0, 5).map((link, idx) => (
                                  <li key={idx} className="ai-document-link-item">
                                    <a href={link} target="_blank" rel="noopener noreferrer">
                                      {link.split('/').pop() || 'Document'}
                                    </a>
                                  </li>
                                ))}
                                {searchStep.details.documentLinks.length > 5 && (
                                  <li className="ai-document-link-more">
                                    {modalTexts.documentsMoreText.replace('{count}', (searchStep.details.documentLinks.length - 5).toString())}
                                  </li>
                                )}
                              </ul>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </>
                ) : (
                  <p>{modalTexts.loadingText}</p>
                )}
              </div>
            </div>
          ) : error ? (
            <div className="ai-error">
              <div className="alert alert--danger error-message">
                <p>{error}</p>
              </div>

              <div className="ai-error-actions">
                <button className="button button--primary ai-retry-button" onClick={handleRetry}>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M21 2v6h-6"></path>
                    <path d="M3 12a9 9 0 0 1 15-6.7L21 8"></path>
                    <path d="M3 22v-6h6"></path>
                    <path d="M21 12a9 9 0 0 1-15 6.7L3 16"></path>
                  </svg>
                  {modalTexts.retryButtonText}
                </button>
              </div>

              {searchResults.length > 0 && (
                <div className="ai-search-links">
                  <p>{modalTexts.searchLinksHelpText}</p>
                  <ul>
                    {searchResults.slice(0, 3).map((result, idx) => (
                      <li key={idx}>
                        <a href={result.url} target="_blank" rel="noopener noreferrer">
                          {result.hierarchy?.lvl0 ||
                            result.hierarchy?.lvl1 ||
                            'Result ' + (idx + 1)}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <div className="ai-answer">
              <div className="ai-response">
                <div className="ai-response-text markdown-body" ref={markdownRef}>
                  {markdownComponentsLoaded ? (
                    <markdownComponentsLoaded.ReactMarkdown 
                      remarkPlugins={[markdownComponentsLoaded.remarkGfm]}
                      rehypePlugins={[markdownComponentsLoaded.rehypeRaw]}
                      components={{
                        // Override pre rendering to avoid nesting
                        // @ts-ignore - The type definition for pre component in ReactMarkdown is complex
                        pre: ({ children }) => children,
                        
                        // @ts-ignore - The type definition for code component in ReactMarkdown is complex
                        code: (codeProps: any) => {
                          const { className, children } = codeProps;
                          // Check if this is a code block or inline code
                          const match = /language-(\w+)/.exec(className || '');
                          
                          // If no language is specified, render as inline code
                          if (!match) {
                            return <code className={className}>{children}</code>;
                          }
                          
                          const language = match[1];
                          const code = String(children).replace(/\n$/, '');
                          
                          // P4-001 & P4-002: Use memoized theme with lazy-loaded components
                          const codeTheme = prismTheme;

                          return (
                            <markdownComponentsLoaded.Highlight 
                              theme={codeTheme} 
                              code={code} 
                              language={language}
                            >
                              {({ className, style, tokens, getLineProps, getTokenProps }: any) => (
                                <pre className={className} style={style}>
                                  {tokens.map((line: any, i: number) => (
                                    <div key={i} {...getLineProps({ line })}>
                                      {line.map((token: any, key: number) => (
                                        <span key={key} {...getTokenProps({ token })} />
                                      ))}
                                    </div>
                                  ))}
                                </pre>
                              )}
                            </markdownComponentsLoaded.Highlight>
                          );
                        }
                      }}
                    >
                      {formattedAnswer}
                    </markdownComponentsLoaded.ReactMarkdown>
                  ) : (
                    <div className="ai-loading-markdown">
                      <div className="ai-loading-spinner"></div>
                      <p>Loading markdown renderer...</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="ai-modal-footer">
          {isFromCache ? (
            <span>
              {modalTexts.footerText} • {modalTexts.cachedResponseText}
            </span>
          ) : (
            <span>
              {orchestratorRef.current 
                ? `${modalTexts.footerText} • ${modalTexts.documentsAnalyzedText.replace('{count}', retrievedContent.length.toString())}`
                : `${modalTexts.footerText} • Found ${retrievedContent.length} documents`
              }
              {fetchFailed ? ` ${modalTexts.searchResultsOnlyText}` : ''}
            </span>
          )}
        </div>
      </div>
    </div>
  );
} 