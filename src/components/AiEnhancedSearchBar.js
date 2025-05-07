import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { DocSearchButton, useDocSearchKeyboardEvents } from "@docsearch/react";
import Head from "@docusaurus/Head";
import Link from "@docusaurus/Link";
import { useHistory } from "@docusaurus/router";
import { isRegexpStringMatch, useSearchLinkCreator } from "@docusaurus/theme-common";
import {
  useAlgoliaContextualFacetFilters,
  useSearchResultUrlProcessor,
} from "@docusaurus/theme-search-algolia/client";
import Translate from "@docusaurus/Translate";
import useDocusaurusContext from "@docusaurus/useDocusaurusContext";
import translations from "@theme/SearchTranslations";
import { AISearchModal } from "./AISearchModal";
import { rankSearchResultsByRelevance } from "../utils/contentUtils";

// Docusaurus injects its SearchBar translations, but we'll provide defaults
const defaultTranslations = {
  button: {
    buttonText: "Search",
    buttonAriaLabel: "Search",
  },
  modal: {
    searchBox: {
      resetButtonTitle: "Clear the query",
      resetButtonAriaLabel: "Clear the query",
      cancelButtonText: "Cancel",
      cancelButtonAriaLabel: "Cancel",
    },
    startScreen: {
      recentSearchesTitle: "Recent",
      noRecentSearchesText: "No recent searches",
      saveRecentSearchButtonTitle: "Save this search",
      removeRecentSearchButtonTitle: "Remove this search from history",
      favoriteSearchesTitle: "Favorite",
      removeFavoriteSearchButtonTitle: "Remove this search from favorites",
    },
    errorScreen: {
      titleText: "Unable to fetch results",
      helpText: "You might want to check your network connection.",
    },
    footer: {
      selectText: "to select",
      selectKeyAriaLabel: "Enter key",
      navigateText: "to navigate",
      navigateUpKeyAriaLabel: "Arrow up",
      navigateDownKeyAriaLabel: "Arrow down",
      closeText: "to close",
      closeKeyAriaLabel: "Escape key",
      searchByText: "Search by",
    },
    noResultsScreen: {
      noResultsText: "No results for",
      suggestedQueryText: "Try searching for",
      reportMissingResultsText: "Believe this query should return results?",
      reportMissingResultsLinkText: "Let us know.",
    },
  },
};

let DocSearchModal = null;

function importDocSearchModalIfNeeded() {
  if (DocSearchModal) {
    return Promise.resolve();
  }
  return Promise.all([
    import("@docsearch/react/modal"),
    import("@docsearch/react/style"),
    // Don't import CSS this way
    // import("../styles/aiSearch.css"),
  ]).then(([{ DocSearchModal: Modal }]) => {
    DocSearchModal = Modal;
    
    // Manually inject the CSS if we're in a browser environment
    if (typeof document !== 'undefined') {
      // Check if our CSS is already loaded
      if (!document.getElementById('docusaurus-openai-search-css')) {
        const link = document.createElement('link');
        link.id = 'docusaurus-openai-search-css';
        link.rel = 'stylesheet';
        link.type = 'text/css';
        link.href = '/_assets/docusaurus-openai-search/styles/aiSearch.css';
        document.head.appendChild(link);
      }
    }
  });
}

function useNavigator({ externalUrlRegex }) {
  const history = useHistory();
  const [navigator] = useState(() => {
    return {
      navigate(params) {
        // Algolia results could contain URL's from other domains which cannot
        // be served through history and should navigate with window.location
        if (isRegexpStringMatch(externalUrlRegex, params.itemUrl)) {
          window.location.href = params.itemUrl;
        } else {
          history.push(params.itemUrl);
        }
      },
    };
  });
  return navigator;
}

function useTransformSearchClient() {
  const {
    siteMetadata: { docusaurusVersion },
  } = useDocusaurusContext();
  return useCallback(
    (searchClient) => {
      searchClient.addAlgoliaAgent("docusaurus", docusaurusVersion);
      return searchClient;
    },
    [docusaurusVersion],
  );
}

function useTransformItems(props) {
  const processSearchResultUrl = useSearchResultUrlProcessor();
  const [transformItems] = useState(() => {
    return (items) =>
      props.transformItems
        ? // Custom transformItems
          props.transformItems(items)
        : // Default transformItems
          items.map((item) => ({
            ...item,
            url: processSearchResultUrl(item.url),
          }));
  });
  return transformItems;
}

function useSearchParameters({
  contextualSearch,
  ...props
}) {
  function mergeFacetFilters(f1, f2) {
    const normalize = (f) => (typeof f === "string" ? [f] : f);
    return [...normalize(f1), ...normalize(f2)];
  }

  const contextualSearchFacetFilters = useAlgoliaContextualFacetFilters();

  const configFacetFilters = props.searchParameters?.facetFilters ?? [];

  const facetFilters = contextualSearch
    ? // Merge contextual search filters with config filters
      mergeFacetFilters(contextualSearchFacetFilters, configFacetFilters)
    : // ... or use config facetFilters
      configFacetFilters;

  // We let users override default searchParameters if they want to
  return {
    ...props.searchParameters,
    facetFilters,
  };
}

function Hit({
  hit,
  children,
}) {
  return <Link to={hit.url}>{children}</Link>;
}

function ResultsFooter({ state, onClose }) {
  const createSearchLink = useSearchLinkCreator();

  return (
    <div className="ai-search-footer">
      <div className="ai-search-footer-left">
        <Link to={createSearchLink(state.query)} onClick={onClose} className="ai-search-see-all">
          <Translate id="theme.SearchBar.seeAll" values={{ count: state.context.nbHits }}>
            {"See all {count} results"}
          </Translate>
        </Link>
      </div>
    </div>
  );
}

function useResultsFooterComponent({
  closeModal,
}) {
  return useMemo(
    () =>
      ({ state }) => <ResultsFooter state={state} onClose={closeModal} />,
    [closeModal],
  );
}

export function AiEnhancedSearchBar({ externalUrlRegex, ...props }) {
  const navigator = useNavigator({ externalUrlRegex });
  const searchParameters = useSearchParameters({ ...props });
  const transformItems = useTransformItems(props);
  const transformSearchClient = useTransformSearchClient();

  const searchContainer = useRef(null);
  const searchButtonRef = useRef(null);
  const [isOpen, setIsOpen] = useState(false);
  const [initialQuery, setInitialQuery] = useState(undefined);

  const [showAIModal, setShowAIModal] = useState(false);
  const [aiQuery, setAiQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);

  // Track the last Algolia search state for better result access
  const [lastSearchState, setLastSearchState] = useState(null);

  const prepareSearchContainer = useCallback(() => {
    if (!searchContainer.current) {
      const divElement = document.createElement("div");
      searchContainer.current = divElement;
      document.body.insertBefore(divElement, document.body.firstChild);
    }
  }, []);

  const openModal = useCallback(() => {
    prepareSearchContainer();
    importDocSearchModalIfNeeded().then(() => setIsOpen(true));
  }, [prepareSearchContainer]);

  const closeModal = useCallback(() => {
    setIsOpen(false);
    searchButtonRef.current?.focus();
    setInitialQuery(undefined);
  }, []);

  const handleAskAI = useCallback((query, results) => {
    setAiQuery(query);
    setSearchResults(results);
    setShowAIModal(true);
  }, []);

  // Enhance search results with Algolia data
  const enhanceSearchResults = useCallback((state) => {
    // Store the full search state for later use
    setLastSearchState(state);

    // Get the current query
    const currentQuery = state.query;

    // Extract all hits from different sources
    let allHits = [];

    // Combine all hits from different indices if they exist
    if (state.collections) {
      state.collections.forEach((collection) => {
        if (collection.items && Array.isArray(collection.items)) {
          allHits = [...allHits, ...collection.items];
        }
      });
    }

    // Rank these hits by relevance to the query
    return rankSearchResultsByRelevance(currentQuery, allHits);
  }, []);

  const handleInput = useCallback(
    (event) => {
      if (event.key === "f" && (event.metaKey || event.ctrlKey)) {
        // ignore browser's ctrl+f
        return;
      }
      // prevents duplicate key insertion in the modal input
      event.preventDefault();
      setInitialQuery(event.key);
      openModal();
    },
    [openModal],
  );

  const resultsFooterComponent = useResultsFooterComponent({
    closeModal,
  });

  // Hit component with tracking
  const HitWithTracking = useMemo(
    () =>
      (props) => {
        // Store clicked result for potential AI follow-up
        const handleClick = () => {
          // For potential future tracking
        };

        return (
          <Link to={props.hit.url} onClick={handleClick}>
            {props.children}
          </Link>
        );
      },
    [],
  );

  // Setup for DocSearch modal hooks
  useDocSearchKeyboardEvents({
    isOpen,
    onOpen: openModal,
    onClose: closeModal,
    onInput: handleInput,
    searchButtonRef,
  });

  // Effect to inject the AI button at the top and observe search state
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        const searchInput = document.querySelector(".DocSearch-Input");
        const searchDropdown = document.querySelector(".DocSearch-Dropdown");

        if (searchInput && searchDropdown) {
          // We'll only add the AI button and not interfere with the search
          let aiButtonAdded = false;

          // Function to add AI button without affecting search input
          const addAiButton = (query) => {
            // Skip if query is too short or already added button
            if (!query || query.trim().length < 3) return;

            // Remove existing AI button if any
            const existingButton = document.querySelector(".ai-search-header");
            if (existingButton) {
              existingButton.remove();
            }

            // Create new AI button
            const aiButton = document.createElement("div");
            aiButton.className = "ai-search-header";
            aiButton.innerHTML = `
              <button class="ai-search-button-header" aria-label="Ask AI to answer your question">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                  <path d="M21.928 11.607c-.202-.488-.635-.605-.928-.633V8c0-1.103-.897-2-2-2h-6V4.61c.305-.274.5-.668.5-1.11a1.5 1.5 0 0 0-3 0c0 .442.195.836.5 1.11V6H5c-1.103 0-2 .897-2 2v2.997l-.082.006A1 1 0 0 0 1.99 12v2a1 1 0 0 0 1 1H3v5c0 1.103.897 2 2 2h14c1.103 0 2-.897 2-2v-5a1 1 0 0 0 1-1v-1.938a1.006 1.006 0 0 0-.072-.455zM5 20V8h14l.001 3.996L19 12v2l.001.005.001 5.995H5z"></path>
                  <ellipse cx="8.5" cy="12" rx="1.5" ry="2"></ellipse>
                  <ellipse cx="15.5" cy="12" rx="1.5" ry="2"></ellipse>
                  <path d="M8 16h8v1H8z"></path>
                </svg>
                Ask AI about "${query}"
              </button>
            `;

            // Insert the button at the top of search results
            const resultsContainer = document.querySelector(".DocSearch-Dropdown-Container");
            if (resultsContainer && resultsContainer.parentNode) {
              resultsContainer.parentNode.insertBefore(aiButton, resultsContainer);
              aiButtonAdded = true;
            }

            // Add click event listener
            const button = aiButton.querySelector("button");
            if (button) {
              button.addEventListener("click", (e) => {
                e.preventDefault();

                // Capture current search results
                const searchResultItems = Array.from(
                  document.querySelectorAll(".DocSearch-Hit"),
                ).map((hit) => {
                  const anchor = hit.querySelector("a");
                  const titleEl = hit.querySelector(".DocSearch-Hit-title");
                  const pathEl = hit.querySelector(".DocSearch-Hit-path");

                  // Try to extract any highlighted content
                  let snippet = "";
                  const contentEls = hit.querySelectorAll(".DocSearch-Hit-content mark");
                  contentEls.forEach((mark) => {
                    snippet += mark.textContent + " ... ";
                  });

                  return {
                    url: anchor?.href || "",
                    hierarchy: {
                      lvl0: titleEl?.textContent || "",
                      lvl1: pathEl?.textContent || "",
                    },
                    content: snippet || "",
                    _snippetResult: {
                      content: {
                        value: snippet || "",
                      },
                    },
                  };
                });

                // Use our ranking function to prioritize the most relevant results
                const rankedResults = rankSearchResultsByRelevance(query, searchResultItems);

                // Use all available search results for better context
                handleAskAI(query, rankedResults);
                closeModal();
              });
            }
          };

          // Use a passive approach to detect when results have been shown
          // We'll use a MutationObserver that doesn't interact with the input
          const observer = new MutationObserver(() => {
            // Check if search has results
            const hasResults = document.querySelector(".DocSearch-Hit");
            const query = searchInput.value.trim();

            // Only add button if there are results and query is valid
            if (hasResults && query.length >= 3 && !aiButtonAdded) {
              addAiButton(query);
            }
          });

          // Observe search results area for changes
          observer.observe(searchDropdown, {
            childList: true,
            subtree: true,
            attributes: false,
            characterData: false,
          });

          // Also check when user changes search input, but don't modify the input
          const handleNewSearch = () => {
            // Wait for search results to update
            setTimeout(() => {
              const hasResults = document.querySelector(".DocSearch-Hit");
              const query = searchInput.value.trim();

              // If results are shown and button not added yet, add it
              if (hasResults && query.length >= 3) {
                addAiButton(query);
              } else {
                // Remove button if search is too short
                const existingButton = document.querySelector(".ai-search-header");
                if (existingButton && query.length < 3) {
                  existingButton.remove();
                  aiButtonAdded = false;
                }
              }
            }, 100); // Short delay to let results render
          };

          // Track clicks in the input field
          searchInput.addEventListener("click", handleNewSearch);

          // Handle keyboard input without interfering with typing
          let typingTimer = null;
          const doneTyping = () => {
            aiButtonAdded = false; // Reset flag to allow adding button again
            handleNewSearch();
          };

          // Use keyup event with delay to detect when user is done typing
          searchInput.addEventListener("keyup", () => {
            if (typingTimer) clearTimeout(typingTimer);
            typingTimer = setTimeout(doneTyping, 500);
          });

          // Cancel timer on keydown
          searchInput.addEventListener("keydown", () => {
            if (typingTimer) clearTimeout(typingTimer);
          });

          return () => {
            observer.disconnect();
            searchInput.removeEventListener("click", handleNewSearch);
            searchInput.removeEventListener("keyup", () => {});
            searchInput.removeEventListener("keydown", () => {});
            if (typingTimer) clearTimeout(typingTimer);
          };
        }
      }, 200); // Delay to ensure Algolia has initialized

      return () => clearTimeout(timer);
    }
  }, [isOpen, handleAskAI, closeModal]);

  return (
    <>
      <Head>
        {/* This hints the browser that the website will load data from Algolia,
        and allows it to preconnect to the DocSearch cluster. It makes the first
        query faster, especially on mobile. */}
        <link
          rel="preconnect"
          href={`https://${props.appId}-dsn.algolia.net`}
          crossOrigin="anonymous"
        />
      </Head>

      <DocSearchButton
        onTouchStart={importDocSearchModalIfNeeded}
        onFocus={importDocSearchModalIfNeeded}
        onMouseOver={importDocSearchModalIfNeeded}
        onClick={openModal}
        ref={searchButtonRef}
        translations={
          props.translations?.button ?? translations?.button ?? defaultTranslations.button
        }
      />

      {isOpen &&
        DocSearchModal &&
        searchContainer.current &&
        createPortal(
          <DocSearchModal
            onClose={closeModal}
            initialScrollY={window.scrollY}
            initialQuery={initialQuery}
            navigator={navigator}
            transformItems={transformItems}
            hitComponent={HitWithTracking}
            transformSearchClient={transformSearchClient}
            {...(props.searchPagePath && {
              resultsFooterComponent,
            })}
            placeholder={translations?.placeholder ?? "Search docs"}
            {...props}
            translations={
              props.translations?.modal ?? translations?.modal ?? defaultTranslations.modal
            }
            searchParameters={searchParameters}
          />,
          searchContainer.current,
        )}

      {showAIModal && (
        <AISearchModal
          query={aiQuery}
          searchResults={searchResults}
          onClose={() => setShowAIModal(false)}
        />
      )}
    </>
  );
} 