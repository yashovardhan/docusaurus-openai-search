import React, { useCallback, useEffect, useState } from 'react';
import { OpenAI } from 'openai';
import { AISearchModalProps } from '../types';
import {
  trackAIQuery,
  retrieveDocumentContent,
  generateFallbackContent,
  createSystemPrompt,
  createUserPrompt
} from '../utils';
import '../styles.css';

/**
 * Modal component that displays AI-generated answers to search queries
 */
export function AISearchModal({
  query,
  onClose,
  searchResults,
  config
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

  // Get the API key from config or window global variable
  const apiKey = config?.openAI?.apiKey || (typeof window !== 'undefined' ? window.OPENAI_API_KEY : '');

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

        const contents = await retrieveDocumentContent(searchResults, query);

        if (contents.length === 0) {
          console.warn('Could not retrieve document content, using fallback mechanism');
          // Use fallback mechanism to at least provide some information
          const fallbackContents = generateFallbackContent(searchResults, query);

          if (fallbackContents.length > 0) {
            setRetrievedContent(fallbackContents);
            setRetrievalStatus(
              `Using search results as content (${fallbackContents.length} results)`
            );
            setFetchFailed(true);
          } else {
            throw new Error('Could not retrieve or generate any content for this search');
          }
        } else {
          setRetrievedContent(contents);
          setRetrievalStatus(`Retrieved content from ${contents.length} documents`);
        }
      } catch (err: any) {
        console.error('Error retrieving document content:', err);
        setRetrievalStatus('Failed to retrieve document content');
        setError(
          `Unable to retrieve documentation content: ${err.message || 'Unknown error'}. Please try a different search query.`
        );
        setLoading(false);
      }
    }

    fetchContent();
  }, [query, searchResults, isRetrying, modalTexts.retrievingText]);

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
        
        const userPrompt = createUserPrompt(
          query, 
          retrievedContent, 
          searchResults, 
          {
            userPrompt: config?.prompts?.userPrompt,
            maxDocuments: config?.prompts?.maxDocuments,
            highlightCode: config?.prompts?.highlightCode
          }
        );

        if (apiKey) {
          // Create OpenAI client on demand
          const openai = new OpenAI({
            apiKey: apiKey,
            dangerouslyAllowBrowser: true,
          });

          const response = await openai.chat.completions.create({
            model: config?.openAI?.model || 'gpt-4.1',
            messages: [
              {
                role: 'system',
                content: systemPrompt,
              },
              {
                role: 'user',
                content: userPrompt,
              },
            ],
            max_tokens: config?.openAI?.maxTokens || 2000,
            temperature: config?.openAI?.temperature || 0.5, // Lower temperature for more factual responses
          });

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
          setError('OpenAI API key is not configured. Please check your configuration.');
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
  }, [query, retrievedContent, searchResults, apiKey, isRetrying, config, modalTexts.generatingText]);

  // Effect to handle HTML response
  useEffect(() => {
    if (answer) {
      let htmlContent = answer; // Use HTML directly, no need to parse markdown

      // Add a note about direct links if content fetching failed
      if (fetchFailed && searchResults.length > 0) {
        const linksList = searchResults
          .slice(0, 3)
          .map((result, idx) => {
            const title =
              result.hierarchy?.lvl0 || result.hierarchy?.lvl1 || 'Document ' + (idx + 1);
            return `<li><a href="${result.url}" target="_blank">${title}</a></li>`;
          })
          .join('');

        const noticeHtml = `
          <div class="admonition admonition-note alert alert--info">
            <div class="admonition-heading">
              <h5>Note</h5>
            </div>
            <div class="admonition-content">
              <p>I couldn't access the full content of the documentation pages.
              You may find more complete information by visiting these pages directly:</p>
              <ul>${linksList}</ul>
            </div>
          </div>
        `;

        htmlContent += noticeHtml;
      }

      setFormattedAnswer(htmlContent);
    }
  }, [answer, fetchFailed, searchResults]);

  return (
    <div
      className="ai-modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="ai-modal-content">
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
                <div className="ai-response-text markdown-body">
                  <div dangerouslySetInnerHTML={{ __html: formattedAnswer }} />
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