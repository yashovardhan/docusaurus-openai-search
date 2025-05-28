import React, { useCallback, useEffect, useState, useRef } from 'react';
import { AISearchModalProps } from '../types';
import {
  trackAIQuery,
  retrieveDocumentContent,
  generateFallbackContent,
  createSystemPrompt,
  createUserPrompt
} from '../utils';
import { createProxyChatCompletion, createProxySummarization } from '../utils/proxy';
import { createLogger } from '../utils/logger';
import '../styles.css';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { Highlight, themes as prismThemes, type PrismTheme } from 'prism-react-renderer';
import type { Components } from 'react-markdown';

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
  themeConfig
}: AISearchModalProps): JSX.Element {
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [answer, setAnswer] = useState<string | null>(null);
  const [formattedAnswer, setFormattedAnswer] = useState<string>('');
  const [retrievedContent, setRetrievedContent] = useState<string[]>([]);
  const [retrievalStatus, setRetrievalStatus] = useState<string>(
    config?.ui?.retrievingText || 'Retrieving document content...'
  );
  const [fetchFailed, setFetchFailed] = useState<boolean>(false);
  const [isRetrying, setIsRetrying] = useState<boolean>(false);
  
  // Reference to the markdown container
  const markdownRef = useRef<HTMLDivElement>(null);

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
    modalTitle: 'AI Answer',
    loadingText: 'Generating answer based on documentation...',
    errorText: 'Unable to generate an answer. Please try again later.',
    retryButtonText: 'Retry Query',
    footerText: 'Powered by AI • Using content from documentation',
    retrievingText: 'Retrieving document content...',
    generatingText: 'Generating AI response...',
    ...config?.ui
  };

  // Function to handle retrying the query
  const handleRetry = useCallback(() => {
    setIsRetrying(true);
    setError(null);
    setLoading(true);
    setRetrievalStatus('Retrying...');

    // Set a small delay to ensure UI updates before retrying
    setTimeout(() => {
      setIsRetrying(false);
      // The useEffects will handle the retry
    }, 100);
  }, []);

  // First, retrieve document content
  useEffect(() => {
    async function fetchContent() {
      if (!query) {
        setLoading(false);
        return;
      }

      try {
        setRetrievalStatus(modalTexts.retrievingText);
        setFetchFailed(false);

        if (searchResults.length === 0) {
          throw new Error('No search results available to retrieve content from');
        }

        const contents = await retrieveDocumentContent(searchResults, query, {
          includeLlmsFile: config?.prompts?.includeLlmsFile
        });

        if (contents.length === 0) {
          // Use search result data directly as fallback
          const fallbackContents = generateFallbackContent(searchResults, query);
          
          if (fallbackContents.length > 0) {
            setRetrievedContent(fallbackContents);
            setRetrievalStatus(`Using search results directly (${fallbackContents.length} results)`);
            setFetchFailed(true);
          } else {
            throw new Error('Could not retrieve or generate any content for this search');
          }
        } else {
          setRetrievedContent(contents);
          setRetrievalStatus(`Retrieved content from ${contents.length} documents`);
        }
      } catch (err: any) {
        setRetrievalStatus('Failed to retrieve document content');
        setError(
          `Unable to retrieve documentation content: ${err.message || 'Unknown error'}. Please try a different search query.`
        );
        setLoading(false);
      }
    }

    fetchContent();
  }, [query, searchResults, isRetrying, modalTexts.retrievingText, config]);

  // Then, generate answer based on retrieved content
  useEffect(() => {
    async function fetchAnswer() {
      if (!query) {
        setLoading(false);
        return;
      }

      // If no content was retrieved, we've already set the error in the first useEffect
      if (retrievedContent.length === 0) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        setRetrievalStatus(modalTexts.generatingText);

        // Create system and user prompts using config options
        const systemPrompt = createSystemPrompt({
          systemPrompt: config?.prompts?.systemPrompt,
          siteName: config?.prompts?.siteName
        });
        
        // Summarize content with AI if enabled in config
        let processedContent = retrievedContent;
        if (config?.prompts?.useSummarization && proxyUrl) {
          setRetrievalStatus('Optimizing document content...');
          
          // Use proxy for summarization
          const summary = await createProxySummarization(
            proxyUrl,
            query,
            retrievedContent,
            {
              model: config?.openAI?.model || 'gpt-4',
              maxTokens: config?.openAI?.maxTokens || 2000,
              systemPrompt: config?.prompts?.systemPrompt
            }
          );
          processedContent = [summary];
          
          setRetrievalStatus(modalTexts.generatingText);
        }
        
        const userPrompt = createUserPrompt(
          query, 
          processedContent, 
          searchResults, 
          {
            userPrompt: config?.prompts?.userPrompt,
            maxDocuments: config?.prompts?.maxDocuments,
            highlightCode: config?.prompts?.highlightCode
          }
        );

        if (proxyUrl) {
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
              model: config?.openAI?.model || 'gpt-4',
              maxTokens: config?.openAI?.maxTokens || 2000,
              temperature: config?.openAI?.temperature || 0.5,
            }
          );

          const generatedAnswer = response.choices[0]?.message?.content;
          
          setAnswer(
            generatedAnswer ||
              "Sorry, I couldn't find relevant information in our documentation to answer your question."
          );
          
          // Track successful AI query if function is provided
          if (config?.onAIQuery) {
            config.onAIQuery(query, true);
          } else {
            trackAIQuery(query, true);
          }
        } else {
          setError('Proxy URL is not configured. Please check your configuration.');
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
        setRetrievalStatus('');
      }
    }

    fetchAnswer();
  }, [query, retrievedContent, searchResults, proxyUrl, isRetrying, config, modalTexts.generatingText]);

  // Effect to handle markdown response
  useEffect(() => {
    if (answer) {
      let markdownContent = answer;

      // Add a note about direct links if content fetching failed
      if (fetchFailed && searchResults.length > 0) {
        const linksList = searchResults
          .slice(0, 3)
          .map((result, idx) => {
            const title =
              result.hierarchy?.lvl0 || result.hierarchy?.lvl1 || 'Document ' + (idx + 1);
            return `- [${title}](${result.url})`;
          })
          .join('\n');

        const noticeMarkdown = `
> **Note**
> 
> I couldn't access the full content of the documentation pages.
> You may find more complete information by visiting these pages directly:
>
${linksList}
        `;

        markdownContent += noticeMarkdown;
      }

      setFormattedAnswer(markdownContent);
    }
  }, [answer, fetchFailed, searchResults]);

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
              <div>{retrievalStatus || modalTexts.loadingText}</div>
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
          {modalTexts.footerText} • Using content from {retrievedContent.length} documentation pages
          {fetchFailed ? ' (search results only)' : ''}
        </div>
      </div>
    </div>
  );
} 