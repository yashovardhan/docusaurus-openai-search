import React, { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { DocSearchButton, useDocSearchKeyboardEvents } from '@docsearch/react';
import Link from '@docusaurus/Link';
import { useHistory } from '@docusaurus/router';
import { isRegexpStringMatch, useSearchLinkCreator } from '@docusaurus/theme-common';
import { useAlgoliaContextualFacetFilters, useSearchResultUrlProcessor } from '@docusaurus/theme-search-algolia/client';
import Translate from '@docusaurus/Translate';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import { AISearchModal } from './AISearchModal';
import { createLogger } from '../utils';
import { DocusaurusAISearchProps } from '../types';
import { InternalDocSearchHit } from '@docsearch/react';
import algoliasearch from 'algoliasearch';
import { DEFAULT_CONFIG } from '../config/defaults';

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
  themeConfig,
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
  } = themeConfig.algolia;
  
  // Initialize logger with enableLogging config
  useEffect(() => {
    createLogger(aiConfig?.enableLogging || false);
  }, [aiConfig?.enableLogging]);
  
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
  
  // Create Algolia search client
  const searchClient = useMemo(
    () => algoliasearch(appId, apiKey),
    [appId, apiKey]
  );
  
  // Create algoliaConfig object for AI modal
  const algoliaConfig = useMemo(
    () => ({ searchClient, indexName }),
    [searchClient, indexName]
  );
  
  const prepareSearchContainer = useCallback(() => {
    if (!searchContainer.current) {
      const divElement = document.createElement('div');
      divElement.className = 'docusaurus-openai-search';
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
            
            const buttonText = aiConfig?.ui?.aiButtonText?.replace('{query}', query) || 
                             DEFAULT_CONFIG.ui.aiButtonText.replace('{query}', query);
            const buttonAriaLabel = aiConfig?.ui?.aiButtonAriaLabel || 
                                  DEFAULT_CONFIG.ui.aiButtonAriaLabel;
            
            aiButton.innerHTML = `
              <button class="ai-search-button-header" aria-label="${buttonAriaLabel}">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                  <path d="M12 2c-4.4 0-8 3.6-8 8 0 2.8 1.5 5.3 3.7 6.7.1.1.2.2.3.2V20c0 1.1.9 2 2 2h4c1.1 0 2-.9 2-2v-3.1c.1 0 .2-.1.3-.2 2.2-1.4 3.7-3.9 3.7-6.7 0-4.4-3.6-8-8-8zm2 18h-4v-1h4v1zm0-3h-4v-1h4v1zm.5-3.6c-.2.2-.3.3-.5.4V15h-4v-1.2c-.2-.1-.3-.2-.5-.4C8 12.2 7 10.2 7 9c0-2.8 2.2-5 5-5s5 2.2 5 5c0 1.2-1 3.2-2.5 4.4z" />
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
                  
                  handleAskAI(query, searchResultItems as InternalDocSearchHit[]);
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
          
          searchInput.addEventListener('keydown', (e) => {
            if (typingTimer) clearTimeout(typingTimer);
            
            if (e.key === 'Enter' && searchInput.value.trim().length >= 3) {
              const hasResults = document.querySelector('.DocSearch-Hit');
              
              if (hasResults && aiConfig?.enabled !== false) {
                e.preventDefault();
                e.stopPropagation();
                
                const searchResultItems = Array.from(
                  document.querySelectorAll('.DocSearch-Hit')
                ).map((hit) => {
                  const hierarchy: Record<string, string> = {};
                  
                  hit.querySelectorAll('.DocSearch-Hit-title, .DocSearch-Hit-path, .DocSearch-Hit-contentTitle')
                    .forEach((el) => {
                      const level = el.className.includes('title') 
                        ? 'lvl1' 
                        : el.className.includes('path') 
                          ? 'lvl0' 
                          : 'content';
                      hierarchy[level] = el.textContent || '';
                    });
                  
                  const url = hit.querySelector('a')?.getAttribute('href');
                  
                  return {
                    hierarchy,
                    url,
                    _snippetResult: {
                      content: {
                        value: hit.querySelector('.DocSearch-Hit-content')?.textContent || ''
                      }
                    }
                  };
                });
                
                handleAskAI(searchInput.value.trim(), searchResultItems as InternalDocSearchHit[]);
                closeModal();
              }
            }
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
  
  useEffect(() => {
    if (appId && typeof document !== 'undefined') {
      const existingLink = document.querySelector(`link[href="https://${appId}-dsn.algolia.net"]`);
      if (!existingLink) {
        const link = document.createElement('link');
        link.rel = 'preconnect';
        link.href = `https://${appId}-dsn.algolia.net`;
        link.crossOrigin = 'anonymous';
        document.head.appendChild(link);
      }
    }
  }, [appId]);
  
  return (
    <div className="docusaurus-openai-search">
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
      
      {showAIModal && createPortal(
        <div className="docusaurus-openai-search">
          <AISearchModal
            query={aiQuery}
            onClose={() => setShowAIModal(false)}
            searchResults={searchResults}
            config={aiConfig}
            themeConfig={themeConfig}
            algoliaConfig={algoliaConfig}
          />
        </div>,
        document.body
      )}
    </div>
  );
} 