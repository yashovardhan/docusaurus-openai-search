import React, { useCallback, useEffect, useState, useRef } from 'react';
import { AISearchModalProps } from '../types';
import {
  createLogger,
  SearchOrchestrator,
  ResponseCache,
  type SearchStep,
  type DocumentContent
} from '../utils';
import '../styles.css';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { Highlight, themes as prismThemes, PrismTheme } from 'prism-react-renderer';
import type { Components } from 'react-markdown';
import { DEFAULT_CONFIG } from '../config/defaults';

// Type definitions for code component props
interface CodeProps {
  node?: any;
  inline?: boolean;
  className?: string;
  children: React.ReactNode;
  theme?: PrismTheme;
}

/**
 * Custom code block renderer for ReactMarkdown
 */
const CodeBlock = ({ node, inline, className, children, ...props }: CodeProps) => {
  const match = /language-(\w+)/.exec(className || '');
  const language = match && match[1] ? match[1] : '';
  const code = String(children).replace(/\n$/, '');

  if (!inline && language) {
    return (
      <Highlight 
        theme={props.theme || prismThemes.github} 
        code={code} 
        language={language}
      >
        {({ className, style, tokens, getLineProps, getTokenProps }) => (
          <pre className={className} style={style}>
            {tokens.map((line, i) => (
              <div key={i} {...getLineProps({ line })}>
                {line.map((token, key) => (
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
};

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
  
  // Reference to the markdown container
  const markdownRef = useRef<HTMLDivElement>(null);
  
  // Reference to search orchestrator
  const orchestratorRef = useRef<SearchOrchestrator | null>(null);
  
  // Ref to track if answer generation has started to prevent duplicates
  const answerGenerationStartedRef = useRef<boolean>(false);
  
  // Cache instance
  const cache = ResponseCache.getInstance();

  // Initialize logger with enableLogging config
  useEffect(() => {
    createLogger(config?.enableLogging || false);
  }, [config?.enableLogging]);

  // Get the backend URL from config
  const backendUrl = config?.backend?.url;

  // Get Prism theme for code highlighting
  const getPrismTheme = (): PrismTheme => {
    const isDarkTheme = typeof document !== 'undefined' && 
                        document.documentElement.dataset.theme === 'dark';
    
    if (themeConfig?.prism) {
      if (isDarkTheme && 
          themeConfig.prism.darkTheme && 
          typeof themeConfig.prism.darkTheme === 'object' &&
          'plain' in themeConfig.prism.darkTheme &&
          'styles' in themeConfig.prism.darkTheme) {
        return themeConfig.prism.darkTheme as PrismTheme;
      } else if (
          themeConfig.prism.theme &&
          typeof themeConfig.prism.theme === 'object' &&
          'plain' in themeConfig.prism.theme &&
          'styles' in themeConfig.prism.theme) {
        return themeConfig.prism.theme as PrismTheme;
      }
    }
    
    // Default to standard themes if custom ones aren't available
    return isDarkTheme ? prismThemes.vsDark : prismThemes.github;
  };

  // Default modal text overrides
  const modalTexts = {
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
  };

  // Function to handle retrying the query
  const handleRetry = useCallback(() => {
    setIsRetrying(true);
    setError(null);
    setLoading(true);
    setSearchStep(null);
    setRetrievedContent([]);
    setAnswer(null);
    setIsGeneratingAnswer(false);
    answerGenerationStartedRef.current = false;

    // Set a small delay to ensure UI updates before retrying
    setTimeout(() => {
      setIsRetrying(false);
      // The useEffects will handle the retry
    }, 100);
  }, []);

  // Initialize search orchestrator
  useEffect(() => {
    if (backendUrl && config) {
      orchestratorRef.current = new SearchOrchestrator(
        config,
        (step) => setSearchStep(step)
      );
    }
  }, [backendUrl, config]);

  // First, retrieve document content using intelligent search
  useEffect(() => {
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

      try {
        setFetchFailed(false);

        // Check cache first if enabled
        const enableCaching = config?.enableCaching ?? DEFAULT_CONFIG.enableCaching;
        const cacheTTL = config?.cacheTTL || DEFAULT_CONFIG.cacheTTL;
        
        if (enableCaching) {
          const cached = cache.getCached(query, cacheTTL);
          if (cached) {
            if (cached.response) {
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

          setRetrievedContent(documents);
        }
      } catch (err: any) {
        setSearchStep(null);
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

    fetchContent();
  }, [query, searchResults.length, algoliaConfig?.indexName]); // Minimal dependencies

  // Effect to handle markdown response
  useEffect(() => {
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
  }, [answer, config, retrievedContent]);

  // Apply blockquote admonition classes after render
  useEffect(() => {
    if (markdownRef.current && !loading && !error) {
      // Find all blockquotes
      const blockquotes = markdownRef.current.querySelectorAll('blockquote');
      
      blockquotes.forEach(blockquote => {
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
      });
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
          onClose();
        }
      }}
    >
      <div className={modalClasses.content}>
        <div className="ai-modal-header">
          <h3>{modalTexts.modalTitle}</h3>
          <button className="ai-modal-close" onClick={onClose} aria-label={modalTexts.closeButtonAriaLabel}>
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
                  <ReactMarkdown 
                    remarkPlugins={[remarkGfm]}
                    rehypePlugins={[rehypeRaw]}
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
                        
                        // Get the appropriate theme based on current mode
                        const codeTheme = getPrismTheme();

                        return (
                          <Highlight 
                            theme={codeTheme} 
                            code={code} 
                            language={language}
                          >
                            {({ className, style, tokens, getLineProps, getTokenProps }) => (
                              <pre className={className} style={style}>
                                {tokens.map((line, i) => (
                                  <div key={i} {...getLineProps({ line })}>
                                    {line.map((token, key) => (
                                      <span key={key} {...getTokenProps({ token })} />
                                    ))}
                                  </div>
                                ))}
                              </pre>
                            )}
                          </Highlight>
                        );
                      }
                    }}
                  >
                    {formattedAnswer}
                  </ReactMarkdown>
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