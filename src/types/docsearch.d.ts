// Type declarations for DocSearch modules

declare module '@docsearch/react' {
  import React from 'react';

  export interface DocSearchHit {
    url: string;
    hierarchy?: {
      lvl0?: string;
      lvl1?: string;
      lvl2?: string;
      lvl3?: string;
      lvl4?: string;
      lvl5?: string;
      lvl6?: string;
    };
    content?: string | null;
    type?: string;
    objectID: string;
    _snippetResult?: {
      content?: {
        value: string;
      };
    };
    [key: string]: any;
  }

  export interface InternalDocSearchHit extends DocSearchHit {
    url_without_anchor: string;
    type: string;
    anchor: string | null;
    __docsearch_parent: InternalDocSearchHit | null;
  }

  export interface StoredDocSearchHit extends DocSearchHit {
    __docsearch_parent?: StoredDocSearchHit;
  }

  export interface DocSearchTransformClient {
    addAlgoliaAgent: (name: string, version: string) => void;
    [key: string]: any;
  }

  export type ContentType = 'content' | 'lvl1' | 'lvl2' | 'lvl3' | 'lvl4' | 'lvl5' | 'lvl6';

  export interface DocSearchModalProps {
    appId?: string;
    apiKey: string;
    indexName: string;
    placeholder?: string;
    searchParameters?: Record<string, any>;
    transformSearchClient?: (searchClient: DocSearchTransformClient) => DocSearchTransformClient;
    transformItems?: (items: DocSearchHit[]) => DocSearchHit[];
    hitComponent?: React.ComponentType<{ hit: DocSearchHit | StoredDocSearchHit; children: React.ReactNode }>;
    resultsFooterComponent?: React.ComponentType<{ state: AutocompleteState<DocSearchHit> }>;
    navigator?: {
      navigate: (params: { itemUrl: string }) => void;
    };
    initialScrollY?: number;
    onClose?: () => void;
    initialQuery?: string;
    translations?: {
      button?: {
        buttonText?: string;
        buttonAriaLabel?: string;
      };
      modal?: {
        searchBox?: Record<string, string>;
        startScreen?: Record<string, string>;
        errorScreen?: Record<string, string>;
        footer?: Record<string, string>;
        noResultsScreen?: Record<string, string>;
      };
    };
    [key: string]: any;
  }

  export interface AutocompleteState<TItem> {
    query: string;
    collections: Array<{ items: TItem[] }>;
    completion: string | null;
    context: {
      nbHits: number;
      [key: string]: any;
    };
    isOpen: boolean;
    activeItemId: string | null;
    status: string;
  }

  export const DocSearchButton: React.ComponentType<React.HTMLAttributes<HTMLButtonElement> & {
    translations?: DocSearchModalProps['translations']['button'];
  }>;

  export function useDocSearchKeyboardEvents({
    isOpen,
    onOpen,
    onClose,
    onInput,
    searchButtonRef,
  }: {
    isOpen: boolean;
    onOpen: () => void;
    onClose: () => void;
    onInput: (event: KeyboardEvent) => void;
    searchButtonRef: React.RefObject<HTMLButtonElement>;
  }): void;

  export const DocSearchModal: React.ComponentType<DocSearchModalProps>;

  export const Hit: React.ComponentType<{ hit: DocSearchHit; children: React.ReactNode }>;
}

declare module '@docsearch/react/modal' {
  export * from '@docsearch/react';
}

declare module '@docsearch/react/style' {
  const styles: any;
  export default styles;
}

declare module 'algoliasearch/lite' {
  export type FacetFilters = string | string[] | string[][];
} 