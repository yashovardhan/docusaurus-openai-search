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
import { ErrorBoundary } from './ErrorBoundary';
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

const ResultsFooter = React.memo(({ 
  state, 
  onClose,
  seeAllResultsText
}: { 
  state: any; 
  onClose: () => void; 
  seeAllResultsText?: string;
}) => {
  const createSearchLink = useSearchLinkCreator();
  
  return (
    <div className="ai-search-footer">
      <div className="ai-search-footer-left">
        <Link 
          to={createSearchLink(state.query)} 
          onClick={onClose} 
          className="ai-search-see-all"
        >
          {seeAllResultsText ? (
            seeAllResultsText.replace('{count}', state.context.nbHits)
          ) : (
            <Translate 
              id="theme.SearchBar.seeAll" 
              values={{ count: state.context.nbHits }}
            >
              {'See all {count} results'}
            </Translate>
          )}
        </Link>
      </div>
    </div>
  );
});

/**
 * Docusaurus AI Search component
 * P4-001: Memoized to prevent unnecessary re-renders
 */
export const DocusaurusAISearch = React.memo(function DocusaurusAISearch({
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
  
  // Merge button translations with AI config
  const buttonTranslations = useMemo(() => {
    const aiButtonText = aiConfig?.ui?.searchButtonText;
    const aiButtonAriaLabel = aiConfig?.ui?.searchButtonAriaLabel;
    
    return {
      buttonText: aiButtonText || translations?.button?.buttonText || defaultTranslations.button.buttonText,
      buttonAriaLabel: aiButtonAriaLabel || translations?.button?.buttonAriaLabel || defaultTranslations.button.buttonAriaLabel,
    };
  }, [aiConfig?.ui, translations?.button]);
  
  // Get search input placeholder
  const searchPlaceholder = useMemo(() => {
    return aiConfig?.ui?.searchInputPlaceholder || placeholder || 'Search docs';
  }, [aiConfig?.ui?.searchInputPlaceholder, placeholder]);
  
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
  
  // Cleanup search container on unmount
  useEffect(() => {
    return () => {
      if (searchContainer.current && searchContainer.current.parentNode) {
        searchContainer.current.parentNode.removeChild(searchContainer.current);
        searchContainer.current = null;
      }
    };
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
  
  // P4-001: Memoize AI modal close handler to prevent unnecessary re-renders
  const closeAIModal = useCallback(() => {
    setShowAIModal(false);
  }, []);
  
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
  
  // P4-001: Memoize hitComponent to prevent unnecessary re-renders
  const hitComponent = useCallback(({ hit, children }: { hit: any; children: React.ReactNode }) => (
    <Link to={hit.url}>{children}</Link>
  ), []);
  
  const resultsFooterComponent = useCallback(
    ({ state }: { state: any }) => <ResultsFooter 
      state={state} 
      onClose={closeModal} 
      seeAllResultsText={aiConfig?.ui?.seeAllResultsText}
    />,
    [closeModal, aiConfig?.ui?.seeAllResultsText],
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
        const originalInput = document.querySelector('.DocSearch-Input') as HTMLInputElement;
        const searchDropdown = document.querySelector('.DocSearch-Dropdown') as HTMLElement;
        
        if (!originalInput) return;
        
        // Create our own input that looks exactly like DocSearch's
        const customInput = originalInput.cloneNode(false) as HTMLInputElement;
        customInput.removeAttribute('maxlength');
        customInput.removeAttribute('maxLength');
        customInput.className = originalInput.className;
        customInput.placeholder = aiConfig?.ui?.searchInputPlaceholder || originalInput.placeholder;
        
        // Hide the original input and insert our custom one
        originalInput.style.display = 'none';
        originalInput.parentNode?.insertBefore(customInput, originalInput.nextSibling);
        
        // Store the full value
        let fullValue = originalInput.value || '';
        customInput.value = fullValue;
        
        // Sync our input with DocSearch's state
        const syncToDocSearch = (value: string) => {
          // Update the hidden original input
          const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
          if (nativeInputValueSetter) {
            nativeInputValueSetter.call(originalInput, value);
          }
          
          // Trigger React's onChange
          const inputEvent = new InputEvent('input', { 
            bubbles: true,
            cancelable: true,
            data: value,
            inputType: 'insertText'
          });
          originalInput.dispatchEvent(inputEvent);
          
          // Also trigger change event
          const changeEvent = new Event('change', { bubbles: true });
          originalInput.dispatchEvent(changeEvent);
        };
        
        // Handle input events on our custom input
        customInput.addEventListener('input', (e) => {
          fullValue = customInput.value;
          syncToDocSearch(fullValue);
        });
        
        // Handle all other events
        ['keydown', 'keyup', 'keypress', 'focus', 'blur', 'paste', 'cut'].forEach(eventType => {
          customInput.addEventListener(eventType, (e) => {
            // Don't forward Enter key on keydown if there are search results and AI is enabled
            if (eventType === 'keydown' && 
                (e as KeyboardEvent).key === 'Enter' && 
                customInput.value.trim().length > 0 &&
                document.querySelector('.DocSearch-Hit') &&
                aiConfig?.enabled !== false) {
              // Let our handleKeyDown function handle this
              return;
            }
            
            // Forward the event to the original input
            const clonedEvent = new (e.constructor as any)(eventType, {
              bubbles: e.bubbles,
              cancelable: e.cancelable,
              view: (e as any).view,
              detail: (e as any).detail,
              key: (e as any).key,
              code: (e as any).code,
              keyCode: (e as any).keyCode,
              which: (e as any).which,
              altKey: (e as any).altKey,
              ctrlKey: (e as any).ctrlKey,
              metaKey: (e as any).metaKey,
              shiftKey: (e as any).shiftKey,
              clipboardData: (e as any).clipboardData,
            });
            originalInput.dispatchEvent(clonedEvent);
          });
        });
        
        // Focus our custom input when the modal opens
        customInput.focus();
        
        // Clean up when modal closes
        const cleanup = () => {
          customInput.remove();
          originalInput.style.display = '';
        };
        
        const modalElement = document.querySelector('.DocSearch-Modal');
        if (modalElement) {
          const modalObserver = new MutationObserver(() => {
            if (!document.contains(modalElement)) {
              cleanup();
              modalObserver.disconnect();
            }
          });
          modalObserver.observe(modalElement.parentElement || document.body, {
            childList: true
          });
        }
        
        // Now set up the AI button with access to the full query
        const searchInput = customInput; // Use our custom input for all operations
        
        if (searchInput && searchDropdown) {
          let aiButtonAdded = false;
          let observer: MutationObserver | null = null;
          let typingTimer: NodeJS.Timeout | null = null;
          
          const addAiButton = (query: string) => {
            if (!query || query.trim().length === 0) {
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
            const buttonAriaLabel = aiConfig?.ui?.aiButtonAriaLabel || DEFAULT_CONFIG.ui.aiButtonAriaLabel;
            
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
                  
                  const currentQuery = searchInput.value.trim();
                  
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
                  
                  handleAskAI(currentQuery, searchResultItems as InternalDocSearchHit[]);
                  closeModal();
                });
              }
            }
          };
          
          const handleMutationObserver = () => {
            const hasResults = document.querySelector('.DocSearch-Hit');
            const query = searchInput.value.trim();
            
            if (hasResults && query.length > 0 && !aiButtonAdded) {
              addAiButton(query);
            }
          };
          
          observer = new MutationObserver(handleMutationObserver);
          
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
              
              if (hasResults && query.length > 0) {
                addAiButton(query);
              } else if (query.length === 0) {
                const existingButton = document.querySelector('.ai-search-header');
                if (existingButton) {
                  existingButton.remove();
                  aiButtonAdded = false;
                }
              }
            }, 100); 
          };
          
          const doneTyping = () => {
            aiButtonAdded = false;
            handleNewSearch();
          };
          
          const handleKeyUp = () => {
            if (typingTimer) clearTimeout(typingTimer);
            typingTimer = setTimeout(doneTyping, 500);
          };
          
          const handleKeyDown = (e: KeyboardEvent) => {
            if (typingTimer) clearTimeout(typingTimer);
            
            if (e.key === 'Enter' && searchInput.value.trim().length > 0) {
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
          };
          
          searchInput.addEventListener('click', handleNewSearch);
          searchInput.addEventListener('keyup', handleKeyUp);
          searchInput.addEventListener('keydown', handleKeyDown);
          
          return () => {
            if (observer) {
              observer.disconnect();
            }
            searchInput.removeEventListener('click', handleNewSearch);
            searchInput.removeEventListener('keyup', handleKeyUp);
            searchInput.removeEventListener('keydown', handleKeyDown);
            if (typingTimer) {
              clearTimeout(typingTimer);
            }
          };
        }
      }, 200);
      
      return () => clearTimeout(timer);
    }
  }, [isOpen, handleAskAI, closeModal, aiConfig]);
  
  useEffect(() => {
    let linkAdded = false;
    let linkElement: HTMLLinkElement | null = null;
    
    if (appId && typeof document !== 'undefined') {
      const existingLink = document.querySelector(`link[href="https://${appId}-dsn.algolia.net"]`);
      if (!existingLink) {
        linkElement = document.createElement('link');
        linkElement.rel = 'preconnect';
        linkElement.href = `https://${appId}-dsn.algolia.net`;
        linkElement.crossOrigin = 'anonymous';
        document.head.appendChild(linkElement);
        linkAdded = true;
      }
    }
    
    return () => {
      if (linkAdded && linkElement && linkElement.parentNode) {
        linkElement.parentNode.removeChild(linkElement);
      }
    };
  }, [appId]);
  
  // Apply custom button styling and keyboard shortcut visibility
  useEffect(() => {
    if (typeof document !== 'undefined') {
      // Small delay to ensure button is rendered
      const timer = setTimeout(() => {
        const searchButton = searchButtonRef.current;
        
        if (searchButton) {
          // Update button text if custom text is provided
          if (aiConfig?.ui?.searchButtonText) {
            const placeholderElement = searchButton.querySelector('.DocSearch-Button-Placeholder');
            if (placeholderElement) {
              placeholderElement.textContent = aiConfig.ui.searchButtonText;
            }
          }
          
          // Add custom class name if provided
          if (aiConfig?.ui?.searchButtonClassName) {
            searchButton.classList.add(aiConfig.ui.searchButtonClassName);
          }
          
          // Handle keyboard shortcut visibility
          if (aiConfig?.ui?.showSearchButtonShortcut === false) {
            // Hide the keyboard shortcut hint
            const shortcutElement = searchButton.querySelector('.DocSearch-Button-Keys');
            if (shortcutElement) {
              (shortcutElement as HTMLElement).style.display = 'none';
            }
          }
        }
      }, 100);
      
      return () => clearTimeout(timer);
    }
  }, [aiConfig?.ui?.searchButtonText, aiConfig?.ui?.searchButtonClassName, aiConfig?.ui?.showSearchButtonShortcut]);
  
  return (
    <div className="docusaurus-openai-search">
      {aiConfig?.ui?.useCustomSearchButton ? (
        <button
          ref={searchButtonRef}
          onClick={openModal}
          onMouseOver={importDocSearchModalIfNeeded}
          onFocus={importDocSearchModalIfNeeded}
          onTouchStart={importDocSearchModalIfNeeded}
          className={`DocSearch DocSearch-Button ${aiConfig?.ui?.searchButtonClassName || ''}`}
          aria-label={buttonTranslations.buttonAriaLabel}
        >
          <span className="DocSearch-Button-Container">
            <svg className="DocSearch-Search-Icon" width="20" height="20" viewBox="0 0 20 20">
              <path
                d="M14.386 14.386l4.0877 4.0877-4.0877-4.0877c-2.9418 2.9419-7.7115 2.9419-10.6533 0-2.9419-2.9418-2.9419-7.7115 0-10.6533 2.9418-2.9419 7.7115-2.9419 10.6533 0 2.9419 2.9418 2.9419 7.7115 0 10.6533z"
                stroke="currentColor"
                fill="none"
                fillRule="evenodd"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span className="DocSearch-Button-Placeholder">
              {aiConfig?.ui?.searchButtonText || 'Search'}
            </span>
          </span>
          {aiConfig?.ui?.showSearchButtonShortcut !== false && (
            <span className="DocSearch-Button-Keys">
              <kbd className="DocSearch-Button-Key">
                {typeof window !== 'undefined' && window.navigator.platform.startsWith('Mac') ? '⌘' : 'Ctrl'}
              </kbd>
              <kbd className="DocSearch-Button-Key">K</kbd>
            </span>
          )}
        </button>
      ) : (
        <DocSearchButton
          onTouchStart={importDocSearchModalIfNeeded}
          onFocus={importDocSearchModalIfNeeded}
          onMouseOver={importDocSearchModalIfNeeded}
          onClick={openModal}
          ref={searchButtonRef}
          translations={buttonTranslations}
        />
      )}
      
      {isOpen && DocSearchModal && searchContainer.current && createPortal(
        <ErrorBoundary
          componentName="DocSearch Modal"
          enableLogging={aiConfig?.enableLogging}
          onError={(error, errorInfo) => {
            console.error('[DocusaurusAISearch] DocSearch Modal Error:', error);
            // Close modal on error to prevent stuck state
            closeModal();
          }}
          maxRetries={1}
        >
          <DocSearchModal
            onClose={closeModal}
            initialScrollY={window.scrollY}
            initialQuery={initialQuery}
            navigator={navigator}
            transformItems={computedTransformItems}
            hitComponent={hitComponent}
            transformSearchClient={transformSearchClient}
            {...(searchPagePath && {
              resultsFooterComponent,
            })}
            placeholder={searchPlaceholder}
            translations={translations?.modal ?? defaultTranslations.modal}
            searchParameters={computedSearchParameters}
            indexName={indexName}
            apiKey={apiKey}
            appId={appId}
          />
        </ErrorBoundary>,
        searchContainer.current
      )}
      
      {showAIModal && createPortal(
        <div className="docusaurus-openai-search">
          <ErrorBoundary
            componentName="AI Search Modal"
            enableLogging={aiConfig?.enableLogging}
            onError={(error, errorInfo) => {
              console.error('[DocusaurusAISearch] AI Modal Error:', error);
              if (aiConfig?.onAIQuery) {
                aiConfig.onAIQuery(aiQuery, false);
              }
            }}
            maxRetries={2}
          >
            <AISearchModal
              query={aiQuery}
              onClose={closeAIModal}
              searchResults={searchResults}
              config={aiConfig}
              themeConfig={themeConfig}
              algoliaConfig={algoliaConfig}
            />
          </ErrorBoundary>
        </div>,
        document.body
      )}
    </div>
  );
});