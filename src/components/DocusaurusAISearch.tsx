import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { DocSearchButton, useDocSearchKeyboardEvents } from '@docsearch/react';
import Head from '@docusaurus/Head';
import Link from '@docusaurus/Link';
import { useHistory } from '@docusaurus/router';
import { isRegexpStringMatch, useSearchLinkCreator } from '@docusaurus/theme-common';
import { useAlgoliaContextualFacetFilters, useSearchResultUrlProcessor } from '@docusaurus/theme-search-algolia/client';
import Translate from '@docusaurus/Translate';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import { AISearchModal } from './AISearchModal';
import { rankSearchResultsByRelevance } from '../utils';
import { DocusaurusAISearchProps } from '../types';
import { InternalDocSearchHit } from '@docsearch/react';

import '@docsearch/css';
import '../styles.css';

// Import DocSearchModal dynamically to reduce initial bundle size
let DocSearchModal: any = null;

// Default translations
const defaultTranslations = {
  button: {
    buttonText: 'Search',
    buttonAriaLabel: 'Search',
  },
  modal: {
    searchBox: {
      resetButtonTitle: 'Clear the query',
      resetButtonAriaLabel: 'Clear the query',
      cancelButtonText: 'Cancel',
      cancelButtonAriaLabel: 'Cancel',
    },
    startScreen: {
      recentSearchesTitle: 'Recent',
      noRecentSearchesText: 'No recent searches',
      saveRecentSearchButtonTitle: 'Save this search',
      removeRecentSearchButtonTitle: 'Remove this search from history',
      favoriteSearchesTitle: 'Favorite',
      removeFavoriteSearchButtonTitle: 'Remove this search from favorites',
    },
    errorScreen: {
      titleText: 'Unable to fetch results',
      helpText: 'You might want to check your network connection.',
    },
    footer: {
      selectText: 'to select',
      selectKeyAriaLabel: 'Enter key',
      navigateText: 'to navigate',
      navigateUpKeyAriaLabel: 'Arrow up',
      navigateDownKeyAriaLabel: 'Arrow down',
      closeText: 'to close',
      closeKeyAriaLabel: 'Escape key',
      searchByText: 'Search by',
    },
    noResultsScreen: {
      noResultsText: 'No results for',
      suggestedQueryText: 'Try searching for',
      reportMissingResultsText: 'Believe this query should return results?',
      reportMissingResultsLinkText: 'Let us know.',
    },
  },
};

async function importDocSearchModalIfNeeded() {
  if (DocSearchModal) {
    return Promise.resolve();
  }
  
  return Promise.all([
    import('@docsearch/react/modal'),
    import('@docsearch/react/style'),
    import('../styles.css'),
  ]).then(([{ DocSearchModal: Modal }]) => {
    DocSearchModal = Modal;
  });
}

function useNavigator({ externalUrlRegex }: { externalUrlRegex?: string }) {
  const history = useHistory();
  
  return {
    navigate({ itemUrl }: { itemUrl: string }) {
      if (externalUrlRegex && isRegexpStringMatch(externalUrlRegex, itemUrl)) {
        window.location.href = itemUrl;
      } else {
        history.push(itemUrl);
      }
    },
  };
}

function useSearchClient() {
  const { siteMetadata } = useDocusaurusContext();
  
  return useCallback(
    (searchClient: any) => {
      searchClient.addAlgoliaAgent('docusaurus', siteMetadata.docusaurusVersion);
      return searchClient;
    },
    [siteMetadata.docusaurusVersion],
  );
}

function useTransformItems({ transformItems }: { transformItems?: (items: any[]) => any[] }) {
  const processSearchResultUrl = useSearchResultUrlProcessor();
  
  return useCallback((items: any[]) => {
    const transformedItems = items.map((item) => ({
      ...item,
      url: processSearchResultUrl(item.url),
    }));
    
    return transformItems 
      ? transformItems(transformedItems)
      : transformedItems;
  }, [processSearchResultUrl, transformItems]);
}

function useSearchParameters({ 
  contextualSearch, 
  searchParameters 
}: { 
  contextualSearch?: boolean; 
  searchParameters?: any; 
}) {
  const contextualSearchFacetFilters = useAlgoliaContextualFacetFilters();
  
  let facetFilters = searchParameters?.facetFilters || [];
  
  if (contextualSearch && contextualSearchFacetFilters.length > 0) {
    facetFilters = Array.isArray(facetFilters[0]) 
      ? [...facetFilters, contextualSearchFacetFilters]
      : [facetFilters, contextualSearchFacetFilters].flat();
  }
  
  return {
    ...searchParameters,
    facetFilters,
  };
}

function ResultsFooter({ 
  state, 
  onClose 
}: { 
  state: any; 
  onClose: () => void; 
}) {
  const createSearchLink = useSearchLinkCreator();
  
  return (
    <div className="ai-search-footer">
      <div className="ai-search-footer-left">
        <Link 
          to={createSearchLink(state.query)} 
          onClick={onClose} 
          className="ai-search-see-all"
        >
          <Translate 
            id="theme.SearchBar.seeAll" 
            values={{ count: state.context.nbHits }}
          >
            {'See all {count} results'}
          </Translate>
        </Link>
      </div>
    </div>
  );
}

/**
 * Docusaurus AI Search component
 */
export function DocusaurusAISearch({
  algoliaConfig,
  aiConfig
}: DocusaurusAISearchProps): JSX.Element {
  const { 
    appId, 
    apiKey, 
    indexName,
    contextualSearch = false,
    externalUrlRegex,
    searchParameters,
    transformItems,
    searchPagePath,
    placeholder,
    translations
  } = algoliaConfig;
  
  const navigator = useNavigator({ externalUrlRegex });
  const computedSearchParameters = useSearchParameters({ contextualSearch, searchParameters });
  const computedTransformItems = useTransformItems({ transformItems });
  const transformSearchClient = useSearchClient();
  
  const searchContainer = useRef<HTMLDivElement | null>(null);
  const searchButtonRef = useRef<HTMLButtonElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [initialQuery, setInitialQuery] = useState<string | undefined>(undefined);
  
  const [showAIModal, setShowAIModal] = useState(false);
  const [aiQuery, setAiQuery] = useState('');
  const [searchResults, setSearchResults] = useState<InternalDocSearchHit[]>([]);
  
  const prepareSearchContainer = useCallback(() => {
    if (!searchContainer.current) {
      const divElement = document.createElement('div');
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
    if (searchButtonRef.current) {
      searchButtonRef.current.focus();
    }
    setInitialQuery(undefined);
  }, []);
  
  const handleAskAI = useCallback((query: string, results: InternalDocSearchHit[]) => {
    setAiQuery(query);
    setSearchResults(results);
    setShowAIModal(true);
    
    if (aiConfig?.onAIQuery) {
      aiConfig.onAIQuery(query, true);
    }
  }, [aiConfig]);
  
  const handleInput = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === 'f' && (event.metaKey || event.ctrlKey)) {
        return;
      }
      
      event.preventDefault();
      setInitialQuery(event.key);
      openModal();
    },
    [openModal],
  );
  
  const resultsFooterComponent = useCallback(
    ({ state }: { state: any }) => <ResultsFooter state={state} onClose={closeModal} />,
    [closeModal],
  );
  
  useDocSearchKeyboardEvents({
    isOpen,
    onOpen: openModal,
    onClose: closeModal,
    onInput: handleInput,
    searchButtonRef,
  });
  
  useEffect(() => {
    if (isOpen && aiConfig?.enabled !== false) {
      const timer = setTimeout(() => {
        const searchInput = document.querySelector('.DocSearch-Input') as HTMLInputElement;
        const searchDropdown = document.querySelector('.DocSearch-Dropdown') as HTMLElement;
        
        if (searchInput && searchDropdown) {
          let aiButtonAdded = false;
          
          const addAiButton = (query: string) => {
            if (!query || query.trim().length < 3) {
              return;
            }
            
            const existingButton = document.querySelector('.ai-search-header');
            if (existingButton) {
              existingButton.remove();
            }
            
            const aiButton = document.createElement('div');
            aiButton.className = 'ai-search-header';
            
            const buttonText = aiConfig?.ui?.aiButtonText || `Ask AI about "${query}"`;
            const buttonAriaLabel = aiConfig?.ui?.aiButtonAriaLabel || 'Ask AI about this question';
            
            aiButton.innerHTML = `
              <button class="ai-search-button-header" aria-label="${buttonAriaLabel}">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                  <path d="M21.928 11.607c-.202-.488-.635-.605-.928-.633V8c0-1.103-.897-2-2-2h-6V4.61c.305-.274.5-.668.5-1.11a1.5 1.5 0 0 0-3 0c0 .442.195.836.5 1.11V6H5c-1.103 0-2 .897-2 2v2.997l-.082.006A1 1 0 0 0 1.99 12v2a1 1 0 0 0 1 1H3v5c0 1.103.897 2 2 2h14c1.103 0 2-.897 2-2v-5a1 1 0 0 0 1-1v-1.938a1.006 1.006 0 0 0-.072-.455zM5 20V8h14l.001 3.996L19 12v2l.001.005.001 5.995H5z"></path>
                  <ellipse cx="8.5" cy="12" rx="1.5" ry="2"></ellipse>
                  <ellipse cx="15.5" cy="12" rx="1.5" ry="2"></ellipse>
                  <path d="M8 16h8v1H8z"></path>
                </svg>
                ${buttonText}
              </button>
            `;
            
            const resultsContainer = document.querySelector('.DocSearch-Dropdown-Container');
            if (resultsContainer && resultsContainer.parentNode) {
              resultsContainer.parentNode.insertBefore(aiButton, resultsContainer);
              aiButtonAdded = true;
              
              const button = aiButton.querySelector('button');
              if (button) {
                button.addEventListener('click', (e) => {
                  e.preventDefault();
                  
                  const searchResultItems = Array.from(
                    document.querySelectorAll('.DocSearch-Hit')
                  ).map((hit) => {
                    const anchor = hit.querySelector('a') as HTMLAnchorElement;
                    const titleEl = hit.querySelector('.DocSearch-Hit-title');
                    const pathEl = hit.querySelector('.DocSearch-Hit-path');
                    
                    let snippet = '';
                    const contentEls = hit.querySelectorAll('.DocSearch-Hit-content mark');
                    contentEls.forEach((mark) => {
                      snippet += mark.textContent + ' ... ';
                    });
                    
                    return {
                      url: anchor?.href || '',
                      hierarchy: {
                        lvl0: titleEl?.textContent || '',
                        lvl1: pathEl?.textContent || '',
                      },
                      content: snippet || '',
                      _snippetResult: {
                        content: {
                          value: snippet || '',
                        },
                      },
                      // Add required fields for InternalDocSearchHit
                      objectID: `result-${Math.random().toString(36).substring(2)}`,
                      type: 'lvl1',
                      _highlightResult: {},
                    };
                  });
                  
                  const rankedResults = rankSearchResultsByRelevance(query, searchResultItems as InternalDocSearchHit[]);
                  
                  handleAskAI(query, rankedResults);
                  closeModal();
                });
              }
            }
          };
          
          const observer = new MutationObserver(() => {
            const hasResults = document.querySelector('.DocSearch-Hit');
            const query = searchInput.value.trim();
            
            if (hasResults && query.length >= 3 && !aiButtonAdded) {
              addAiButton(query);
            }
          });
          
          observer.observe(searchDropdown, {
            childList: true,
            subtree: true,
            attributes: false,
            characterData: false,
          });
          
          const handleNewSearch = () => {
            setTimeout(() => {
              const hasResults = document.querySelector('.DocSearch-Hit');
              const query = searchInput.value.trim();
              
              if (hasResults && query.length >= 3) {
                addAiButton(query);
              } else if (query.length < 3) {
                const existingButton = document.querySelector('.ai-search-header');
                if (existingButton) {
                  existingButton.remove();
                  aiButtonAdded = false;
                }
              }
            }, 100); 
          };
          
          searchInput.addEventListener('click', handleNewSearch);
          
          let typingTimer: NodeJS.Timeout | null = null;
          const doneTyping = () => {
            aiButtonAdded = false;
            handleNewSearch();
          };
          
          searchInput.addEventListener('keyup', () => {
            if (typingTimer) clearTimeout(typingTimer);
            typingTimer = setTimeout(doneTyping, 500);
          });
          
          searchInput.addEventListener('keydown', () => {
            if (typingTimer) clearTimeout(typingTimer);
          });
          
          return () => {
            observer.disconnect();
            searchInput.removeEventListener('click', handleNewSearch);
            searchInput.removeEventListener('keyup', () => {});
            searchInput.removeEventListener('keydown', () => {});
            if (typingTimer) clearTimeout(typingTimer);
          };
        }
      }, 200);
      
      return () => clearTimeout(timer);
    }
  }, [isOpen, handleAskAI, closeModal, aiConfig]);
  
  return (
    <>
      <Head>
        {appId && (
          <link
            rel="preconnect"
            href={`https://${appId}-dsn.algolia.net`}
            crossOrigin="anonymous"
          />
        )}
      </Head>
      
      <DocSearchButton
        onTouchStart={importDocSearchModalIfNeeded}
        onFocus={importDocSearchModalIfNeeded}
        onMouseOver={importDocSearchModalIfNeeded}
        onClick={openModal}
        ref={searchButtonRef}
        translations={
          translations?.button ?? defaultTranslations.button
        }
      />
      
      {isOpen && DocSearchModal && searchContainer.current && createPortal(
        <DocSearchModal
          onClose={closeModal}
          initialScrollY={window.scrollY}
          initialQuery={initialQuery}
          navigator={navigator}
          transformItems={computedTransformItems}
          hitComponent={({ hit, children }: { hit: any; children: React.ReactNode }) => (
            <Link to={hit.url}>{children}</Link>
          )}
          transformSearchClient={transformSearchClient}
          {...(searchPagePath && {
            resultsFooterComponent,
          })}
          placeholder={placeholder}
          translations={translations?.modal ?? defaultTranslations.modal}
          searchParameters={computedSearchParameters}
          indexName={indexName}
          apiKey={apiKey}
          appId={appId}
        />,
        searchContainer.current
      )}
      
      {showAIModal && (
        <AISearchModal
          query={aiQuery}
          onClose={() => setShowAIModal(false)}
          searchResults={searchResults}
          config={aiConfig}
        />
      )}
    </>
  );
} 