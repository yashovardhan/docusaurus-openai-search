import React, { useCallback, useEffect, useState } from "react";
import { OpenAI } from "openai";
import { marked } from "marked";
import "../styles/aiSearch.css";
import {
  retrieveDocumentContent,
  generateFallbackContent,
  trackAIQuery,
} from "../utils/contentUtils";

export function AISearchModal({ query, onClose, searchResults }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [answer, setAnswer] = useState(null);
  const [formattedAnswer, setFormattedAnswer] = useState("");
  const [retrievedContent, setRetrievedContent] = useState([]);
  const [retrievalStatus, setRetrievalStatus] = useState("Retrieving document content...");
  const [fetchFailed, setFetchFailed] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);

  // Get the API key from window global variable (set in docusaurus.config.ts)
  const apiKey = typeof window !== "undefined" ? (window).OPENAI_API_KEY || "" : "";

  // Function to handle retrying the query
  const handleRetry = useCallback(() => {
    setIsRetrying(true);
    setError(null);
    setLoading(true);
    setRetrievalStatus("Retrying...");

    // Set a small delay to ensure UI updates before retrying
    setTimeout(() => {
      setIsRetrying(false);
      // The useEffects will handle the retry since they depend on isRetrying
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
        setRetrievalStatus("Retrieving document content...");
        setFetchFailed(false);

        if (searchResults.length === 0) {
          throw new Error("No search results available to retrieve content from");
        }

        const contents = await retrieveDocumentContent(searchResults, query);

        if (contents.length === 0) {
          console.warn("Could not retrieve document content, using fallback mechanism");
          // Use fallback mechanism to at least provide some information
          const fallbackContents = generateFallbackContent(searchResults, query);

          if (fallbackContents.length > 0) {
            setRetrievedContent(fallbackContents);
            setRetrievalStatus(
              `Using search results as content (${fallbackContents.length} results)`,
            );
            setFetchFailed(true);
          } else {
            throw new Error("Could not retrieve or generate any content for this search");
          }
        } else {
          setRetrievedContent(contents);
          setRetrievalStatus(`Retrieved content from ${contents.length} documents`);
        }
      } catch (err) {
        console.error("Error retrieving document content:", err);
        setRetrievalStatus("Failed to retrieve document content");
        setError(
          `Unable to retrieve documentation content: ${err.message || "Unknown error"}. Please try a different search query.`,
        );
        setLoading(false);
      }
    }

    fetchContent();
  }, [query, searchResults, isRetrying]);

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
        setRetrievalStatus("Generating AI response...");

        // Format search results with their titles and URLs for reference
        const formattedResults = searchResults
          .slice(0, 4)
          .map((result, index) => {
            const title = result.hierarchy?.lvl0 || "Document";
            const subtitle = result.hierarchy?.lvl1 || "";
            return `Source ${index + 1}: ${title} > ${subtitle}: ${result.url}`;
          })
          .join("\n");

        // Combine the retrieved content with source information
        const contextContent = retrievedContent
          .map((content, index) => {
            const result = searchResults[index];
            const title = result?.hierarchy?.lvl0 || "Document " + (index + 1);
            return `--- START OF DOCUMENT: ${title} ---\n${content}\n--- END OF DOCUMENT ---\n`;
          })
          .join("\n\n");

        // Create enhanced prompt with actual document content
        const systemPrompt =
          "You are a helpful assistant providing information from documentation. Your goal is to provide detailed, accurate information based on the provided documentation snippets.\n\n" +
          "RESPONSE GUIDELINES:\n" +
          "1. BE HELPFUL: Always try to provide SOME guidance, even when the documentation doesn't contain a perfect answer.\n" +
          "2. PRIORITIZE USER SUCCESS: Focus on helping the user accomplish their task.\n" +
          "3. USE DOCUMENTATION FIRST: Base your answers primarily on the provided documentation snippets.\n" +
          "4. CODE EXAMPLES ARE CRUCIAL: Always include code snippets from the documentation when available, as they're extremely valuable to developers.\n" +
          "5. INFERENCE IS ALLOWED: When documentation contains related but not exact information, use reasonable inference to bridge gaps.\n" +
          "6. BE HONEST: If you truly can't provide an answer, suggest relevant concepts or documentation sections that might help instead.\n";

        const userPrompt = `The user's question is: "${query}"

          Here's content from the most relevant documentation sections:

          ${contextContent}

          Source references:
          ${formattedResults}

          Based on the above documentation, provide the most helpful answer you can to the user's question. Remember:
          1. Include ALL relevant code examples from the documentation
          2. If you can't find a direct answer, still provide guidance based on similar concepts
          3. Suggest specific next steps the user could take
          4. Keep your explanation concise but thorough
          5. Link to specific documentation pages when relevant`;

        if (apiKey) {
          // Create OpenAI client on demand
          const openai = new OpenAI({
            apiKey: apiKey,
            dangerouslyAllowBrowser: true,
          });

          const response = await openai.chat.completions.create({
            model: "gpt-4.1",
            messages: [
              {
                role: "system",
                content: systemPrompt,
              },
              {
                role: "user",
                content: userPrompt,
              },
            ],
            max_tokens: 30000,
            temperature: 0.5, // Lower temperature for more factual responses
          });

          const generatedAnswer = response.choices[0]?.message?.content;
          setAnswer(
            generatedAnswer ||
              "Sorry, I couldn't find relevant information in our documentation to answer your question.",
          );
          trackAIQuery(query, true);
        } else {
          setError(
            "OpenAI API key is not configured. Please check your configuration in docusaurus.config.js.",
          );
        }
      } catch (err) {
        setError(err?.message || "Failed to generate an answer. Please try again later.");
        trackAIQuery(query, false);
      } finally {
        setLoading(false);
        setRetrievalStatus("");
      }
    }

    fetchAnswer();
  }, [query, retrievedContent, searchResults, apiKey, isRetrying]);

  // Effect to format markdown to HTML
  useEffect(() => {
    if (answer) {
      let htmlContent = marked.parse(answer);

      // Add a note about direct links if content fetching failed
      if (fetchFailed && searchResults.length > 0) {
        const linksList = searchResults
          .slice(0, 3)
          .map((result, idx) => {
            const title =
              result.hierarchy?.lvl0 || result.hierarchy?.lvl1 || "Document " + (idx + 1);
            return `<li><a href="${result.url}" target="_blank">${title}</a></li>`;
          })
          .join("");

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
              <div>{retrievalStatus || "Generating answer based on documentation..."}</div>
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
                          {result.hierarchy?.lvl0 ||
                            result.hierarchy?.lvl1 ||
                            "Result " + (idx + 1)}
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
                <div className="ai-response-text markdown">
                  <div dangerouslySetInnerHTML={{ __html: formattedAnswer }} />
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="ai-modal-footer">
          Powered by AI • Using content from {retrievedContent.length} documentation pages
          {fetchFailed ? " (search results only)" : ""}
        </div>
      </div>
    </div>
  );
} 