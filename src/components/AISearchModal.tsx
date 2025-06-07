import React, { useCallback, useEffect, useState, useRef } from 'react';
import { AISearchModalProps } from '../types';
import {
  trackAIQuery,
  retrieveDocumentContent,
  createSystemPrompt,
  createUserPrompt,
  createProxyChatCompletion,
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

  // Get the proxy URL from config
  const proxyUrl = config?.openAI?.proxyUrl;

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
    if (proxyUrl && config?.intelligentSearch !== false) {
      orchestratorRef.current = new SearchOrchestrator(
        config!,  // Pass the entire config object
        (step) => setSearchStep(step)
      );
    }
  }, [proxyUrl, config]);

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
        const enableCaching = config?.research?.enableCaching ?? DEFAULT_CONFIG.research.enableCaching;
        const cacheTTL = config?.research?.cacheTTL || DEFAULT_CONFIG.research.cacheTTL;
        
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
              } else {
                trackAIQuery(query, true);
              }
              return;
            }
          }
        }

        // Use intelligent search if enabled
        if (config?.intelligentSearch !== false && orchestratorRef.current && algoliaConfig) {
          const documents = await orchestratorRef.current.performIntelligentSearch(
            query,
            algoliaConfig.searchClient,
            algoliaConfig.indexName,
            config?.prompts?.maxDocuments || DEFAULT_CONFIG.prompts.maxDocuments
          );

          if (documents.length === 0) {
            throw new Error('Could not find any relevant documentation for your query');
          }

          setRetrievedContent(documents);
          
          // Extract query analysis and AI call count from the orchestrator
          const searchContext = (orchestratorRef.current as any).context;
          if (searchContext?.queryAnalysisResult) {
            setQueryAnalysis(searchContext.queryAnalysisResult);
          }
          if (searchContext?.aiCallCount) {
            setAiCallCount(searchContext.aiCallCount);
          }
          
          setSearchStep({
            step: 'synthesizing',
            message: `Found ${documents.length} relevant documents`,
            progress: 95
          });
        } else {
          // Fallback to original search behavior
          if (searchResults.length === 0) {
            throw new Error('No search results available to retrieve content from');
          }

          setSearchStep({
            step: 'retrieving',
            message: modalTexts.retrievingText,
            progress: 50
          });

          const contents = await retrieveDocumentContent(searchResults, 
            config?.prompts?.maxDocuments || 5
          );

          // Convert to DocumentContent format
          const documents: DocumentContent[] = contents.map((content, index) => ({
            url: searchResults[index]?.url || '',
            title: searchResults[index]?.hierarchy?.lvl1 || searchResults[index]?.hierarchy?.lvl0 || 'Document',
            content: content
          }));

          setRetrievedContent(documents);
        }
      } catch (err: any) {
        setSearchStep(null);
        setError(
          `Unable to find relevant documentation: ${err.message || 'Unknown error'}. Please try a different search query.`
        );
        setLoading(false);
      }
    }

    fetchContent();
  }, [query, searchResults.length, algoliaConfig?.indexName]); // Minimal dependencies

  // Then, generate answer based on retrieved content
  useEffect(() => {
    async function fetchAnswer() {
      if (!query || !proxyUrl) {
        setLoading(false);
        return;
      }

      // If no content was retrieved, we've already set the error in the first useEffect
      if (retrievedContent.length === 0) {
        setLoading(false);
        return;
      }
      
      // Skip if we already have a cached answer
      if (isFromCache && answer) {
        setLoading(false);
        return;
      }

      // Skip if we already have an answer
      if (answer) {
        setLoading(false);
        return;
      }

      // Prevent duplicate AI calls using ref
      if (answerGenerationStartedRef.current || isGeneratingAnswer) {
        return;
      }

      try {
        answerGenerationStartedRef.current = true;
        setIsGeneratingAnswer(true);
        setLoading(true);
        setError(null);
        setSearchStep({
          step: 'synthesizing',
          message: modalTexts.generatingText,
          progress: 100
        });

        // Create system and user prompts using config options
        const systemPrompt = createSystemPrompt(
          config?.prompts?.siteName || 'this documentation'
        );
        
        // Convert DocumentContent to string array for existing prompt function
        const processedContent = retrievedContent.map(doc => 
          `${doc.title}\nURL: ${doc.url}\n\n${doc.content}`
        );
        
        const userPrompt = createUserPrompt(
          query, 
          processedContent, 
          searchResults
        );

        // Use proxy for chat completion
        const response = await createProxyChatCompletion(
          proxyUrl,
          [
            {
              role: 'system',
              content: systemPrompt,
            },
            {
              role: 'user',
              content: userPrompt,
            },
          ],
          {
            model: config?.openAI?.model || DEFAULT_CONFIG.openAI.model,
            maxTokens: config?.openAI?.maxTokens || DEFAULT_CONFIG.openAI.maxTokens,
            temperature: config?.openAI?.temperature || DEFAULT_CONFIG.openAI.temperature,
          }
        );

        const generatedAnswer = response.choices[0]?.message?.content;
        
        // Increment AI call count for synthesis
        setAiCallCount(prev => prev + 1);
        
        const finalAnswer = generatedAnswer ||
          "Sorry, I couldn't find relevant information in our documentation to answer your question.";
        
        setAnswer(finalAnswer);
        
        // Cache the complete response if caching is enabled
        const enableCaching = config?.research?.enableCaching ?? DEFAULT_CONFIG.research.enableCaching;
        if (enableCaching) {
          cache.set(query, finalAnswer, queryAnalysis, retrievedContent);
        }
        
        // Track successful AI query if function is provided
        if (config?.onAIQuery) {
          config.onAIQuery(query, true);
        } else {
          trackAIQuery(query, true);
        }
      } catch (err: any) {
        setError(err?.message || 'Failed to generate an answer. Please try again later.');
        
        // Track failed AI query if function is provided
        if (config?.onAIQuery) {
          config.onAIQuery(query, false);
        } else {
          trackAIQuery(query, false);
        }
      } finally {
        setLoading(false);
        setSearchStep(null);
        setIsGeneratingAnswer(false);
      }
    }

    fetchAnswer();
  }, [query, retrievedContent.length, proxyUrl]); // Simplified dependencies to prevent re-renders

  // Effect to handle markdown response
  useEffect(() => {
    if (answer) {
      let markdownContent = answer;

      // Add source references if using intelligent search
      if (config?.intelligentSearch !== false && retrievedContent.length > 0) {
        const sourcesMarkdown = `

---

**Sources:**
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
          <button className="ai-modal-close" onClick={onClose}>
            &times;
          </button>
        </div>

        <div className="ai-modal-body">
          <div className="ai-question">
            <strong>Q:</strong> {query}
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
                    {searchStep.details && searchStep.details.length > 0 && (
                      <div className="ai-step-details">
                        {searchStep.details.map((detail, idx) => (
                          <div key={idx} className="ai-step-detail">
                            {detail}
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <div>{modalTexts.loadingText}</div>
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
                  <p>You might find these search results helpful:</p>
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
              {modalTexts.footerText} • Retrieved from cache
            </span>
          ) : (
            <span>
              {config?.intelligentSearch !== false 
                ? `${modalTexts.footerText} • Deep research: ${retrievedContent.length} documents analyzed • ${aiCallCount} AI calls`
                : `${modalTexts.footerText} • ${retrievedContent.length} documents • ${aiCallCount} AI calls`
              }
              {fetchFailed ? ' (search results only)' : ''}
            </span>
          )}
        </div>
      </div>
    </div>
  );
} 