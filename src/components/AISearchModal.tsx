import React, { useCallback, useEffect, useState } from 'react';
import { OpenAI } from 'openai';
import { marked } from 'marked';
import { InternalDocSearchHit } from '@docsearch/react';
import { retrieveDocumentContent, trackAIQuery } from '../utils';
import '../styles.css';

interface AISearchModalProps {
  query: string;
  onClose: () => void;
  searchResults: InternalDocSearchHit[];
}

export function AISearchModal({ query, onClose, searchResults }: AISearchModalProps): JSX.Element {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [answer, setAnswer] = useState<string | null>(null);
  const [formattedAnswer, setFormattedAnswer] = useState('');
  const [retrievalStatus, setRetrievalStatus] = useState('Retrieving document content...');
  const [fetchFailed, setFetchFailed] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [documentCount, setDocumentCount] = useState(0);

  // Get the API key from window global variable (set in docusaurus.config.js)
  const apiKey = typeof window !== 'undefined' ? window.OPENAI_API_KEY || '' : '';

  // Function to handle retrying the query
  const handleRetry = useCallback(() => {
    setIsRetrying(true);
    setError(null);
    setLoading(true);
    setRetrievalStatus('Retrying...');

    // Small delay to ensure UI updates before retrying
    setTimeout(() => {
      setIsRetrying(false);
    }, 100);
  }, []);

  // Fetch document content and generate answer using OpenAI
  useEffect(() => {
    if (!query || isRetrying === null) return;

    let isMounted = true;
    
    const generateAnswer = async () => {
      try {
        setLoading(true);
        setError(null);
        setRetrievalStatus('Retrieving document content...');
        setFetchFailed(false);

        if (searchResults.length === 0) {
          throw new Error('No search results available to retrieve content from');
        }

        // Retrieve content from documents
        const contents = await retrieveDocumentContent(searchResults, query);
        
        if (isMounted) {
          if (contents.length === 0) {
            throw new Error('Could not retrieve document content');
          }
          
          setDocumentCount(contents.length);
          setRetrievalStatus(`Generating AI response from ${contents.length} documents...`);
          
          // Prepare content for OpenAI request
          const contextContent = contents
            .map((doc, index) => {
              return `--- START OF DOCUMENT: ${doc.title} ---\n${doc.content}\n--- END OF DOCUMENT ---\n`;
            })
            .join('\n\n');

          // Format search results for reference
          const formattedResults = searchResults
            .slice(0, 3)
            .map((result, index) => {
              const title = result.hierarchy?.lvl0 || 'Document';
              const subtitle = result.hierarchy?.lvl1 || '';
              return `Source ${index + 1}: ${title} > ${subtitle}: ${result.url}`;
            })
            .join('\n');

          if (!apiKey) {
            throw new Error('OpenAI API key is not configured. Please check your configuration in docusaurus.config.js.');
          }

          // Create OpenAI client on demand
          const openai = new OpenAI({
            apiKey,
            dangerouslyAllowBrowser: true,
          });

          // Create enhanced prompt with documentation content
          const systemPrompt = `You are a helpful assistant providing information from documentation. Your goal is to provide detailed, accurate information based on the provided documentation snippets.

RESPONSE GUIDELINES:
1. Base your answers primarily on the provided documentation snippets.
2. Include code examples from the documentation when available.
3. When documentation contains related but not exact information, use reasonable inference.
4. If you can't provide an answer, suggest relevant concepts or documentation sections.
5. Keep your explanation concise but thorough.`;

          const userPrompt = `The user's question is: "${query}"

Here's content from the most relevant documentation sections:

${contextContent}

Source references:
${formattedResults}

Based on the above documentation, provide the most helpful answer you can to the user's question. Include all relevant code examples from the documentation.`;

          const response = await openai.chat.completions.create({
            model: 'gpt-4.1',
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt },
            ],
            max_tokens: 2000,
            temperature: 0.5, // Lower temperature for more factual responses
          });

          if (isMounted) {
            const generatedAnswer = response.choices[0]?.message?.content;
            setAnswer(generatedAnswer || 'Sorry, I couldn\'t find relevant information in the documentation to answer your question.');
            trackAIQuery(query, true);
          }
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err?.message || 'Failed to generate an answer. Please try again later.');
          setFetchFailed(true);
          trackAIQuery(query, false);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
          setRetrievalStatus('');
        }
      }
    };

    generateAnswer();

    return () => {
      isMounted = false;
    };
  }, [query, searchResults, apiKey, isRetrying]);

  // Format markdown to HTML
  useEffect(() => {
    if (answer) {
      let htmlContent = marked.parse(answer);

      // Add a note about direct links if content fetching failed
      if (fetchFailed && searchResults.length > 0) {
        const linksList = searchResults
          .slice(0, 3)
          .map((result, idx) => {
            const title = result.hierarchy?.lvl0 || result.hierarchy?.lvl1 || `Document ${idx + 1}`;
            return `<li><a href="${result.url}" target="_blank">${title}</a></li>`;
          })
          .join('');

        const noticeHtml = `
          <div class="ai-notice">
            <p><strong>Note:</strong> I couldn't access the full content of the documentation pages.
            You may find more complete information by visiting these pages directly:</p>
            <ul>${linksList}</ul>
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
          <h3>AI Answer</h3>
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
              <div>{retrievalStatus || 'Generating answer based on documentation...'}</div>
            </div>
          ) : error ? (
            <div className="ai-error">
              <div className="error-message">{error}</div>

              <div className="ai-error-actions">
                <button className="ai-retry-button" onClick={handleRetry}>
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
                  Retry Query
                </button>
              </div>

              {searchResults.length > 0 && (
                <div className="ai-search-links">
                  <p>You might find these search results helpful:</p>
                  <ul>
                    {searchResults.slice(0, 3).map((result, idx) => (
                      <li key={idx}>
                        <a href={result.url} target="_blank" rel="noopener noreferrer">
                          {result.hierarchy?.lvl0 || result.hierarchy?.lvl1 || `Result ${idx + 1}`}
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
                <div className="ai-response-text markdown" dangerouslySetInnerHTML={{ __html: formattedAnswer }} />
              </div>
            </div>
          )}
        </div>

        <div className="ai-modal-footer">
          Powered by AI • Using content from {documentCount} documentation pages
          {fetchFailed ? ' (search results only)' : ''}
        </div>
      </div>
    </div>
  );
} 