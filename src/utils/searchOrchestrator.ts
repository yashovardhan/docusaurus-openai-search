import { InternalDocSearchHit } from '@docsearch/react';
import { getLogger } from './logger';
import { DocusaurusAISearchConfig } from '../types';
import { addRecaptchaHeader } from './recaptcha';

export interface SearchStep {
  step: 'requesting-keywords' | 'keywords-received' | 'searching' | 'documents-found' | 'generating-answer' | 'complete';
  message: string;
  progress: number;
  details?: {
    keywords?: string[];
    documentsFound?: number;
    documentLinks?: string[];
  };
}

export interface DocumentContent {
  url: string;
  title: string;
  content: string;
}

export class SearchOrchestrator {
  private logger = getLogger();
  private config: DocusaurusAISearchConfig;
  private onProgress?: (step: SearchStep) => void;
  private recaptchaSiteKey?: string;
  // P3-002: AbortController for canceling pending operations
  private abortController: AbortController | null = null;
  private pendingOperations: Set<Promise<any>> = new Set();
  private isDestroyed: boolean = false;

  constructor(
    config: DocusaurusAISearchConfig,
    onProgress?: (step: SearchStep) => void
  ) {
    this.config = config;
    this.onProgress = onProgress;
    this.recaptchaSiteKey = config.recaptcha?.siteKey;
    // Initialize abort controller for this orchestrator instance
    this.abortController = new AbortController();
  }

  /**
   * P3-002: Cancel all pending operations and cleanup resources
   */
  cancelAllOperations(): void {
    this.isDestroyed = true;
    
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    
    // Clear pending operations
    this.pendingOperations.clear();
    
    this.logger.log('SearchOrchestrator: All operations cancelled');
  }

  /**
   * P3-002: Check if operations should be aborted due to race conditions
   */
  private checkAborted(): void {
    if (this.isDestroyed || !this.abortController || this.abortController.signal.aborted) {
      throw new Error('Operation cancelled');
    }
  }

  /**
   * P3-002: Track pending operation and handle completion
   */
  private async trackOperation<T>(operation: Promise<T>, operationName: string): Promise<T> {
    this.checkAborted();
    
    this.pendingOperations.add(operation);
    
    try {
      const result = await operation;
      this.checkAborted(); // Check again after completion
      return result;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        this.logger.log(`${operationName} operation aborted`);
        throw new Error('Operation cancelled');
      }
      throw error;
    } finally {
      this.pendingOperations.delete(operation);
    }
  }

  /**
   * Main orchestration method that performs AI-powered search
   */
  async performAISearch(
    query: string,
    algoliaClient: any,
    algoliaIndex: string
  ): Promise<{ answer: string; documents: DocumentContent[] }> {
    try {
      // P3-002: Check if operation should proceed
      this.checkAborted();
      
      // Step 1: Request keywords from backend
      this.updateProgress({
        step: 'requesting-keywords',
        message: 'Analyzing your question...',
        progress: 10,
      });

      const keywords = await this.trackOperation(
        this.getKeywordsFromBackend(query),
        'getKeywords'
      );
      
      this.updateProgress({
        step: 'keywords-received',
        message: 'Search strategy identified',
        progress: 20,
        details: { keywords }
      });

      // P3-002: Check abort before continuing
      this.checkAborted();

      // Step 2: Search for each keyword
      this.updateProgress({
        step: 'searching',
        message: 'Searching documentation...',
        progress: 30,
      });

      const allDocuments: DocumentContent[] = [];
      const documentLinks: string[] = [];
      
      for (let i = 0; i < keywords.length; i++) {
        // P3-002: Check abort before each search iteration
        this.checkAborted();
        
        const keyword = keywords[i];
        this.updateProgress({
          step: 'searching',
          message: `Searching for: "${keyword}" (${i + 1}/${keywords.length})`,
          progress: 30 + (i * 30 / keywords.length),
          details: { 
            keywords,
            documentsFound: allDocuments.length,
            documentLinks 
          }
        });
        
        const results = await this.trackOperation(
          this.performSingleSearch(keyword, algoliaClient, algoliaIndex),
          `search-${keyword}`
        );
        const documents = this.extractDocuments(results);
        
        // Add unique documents
        documents.forEach(doc => {
          if (!documentLinks.includes(doc.url)) {
            allDocuments.push(doc);
            documentLinks.push(doc.url);
          }
        });
      }

      this.updateProgress({
        step: 'documents-found',
        message: `Found ${allDocuments.length} relevant documents`,
        progress: 70,
        details: { 
          keywords,
          documentsFound: allDocuments.length,
          documentLinks 
        }
      });

      // P3-002: Check abort before answer generation
      this.checkAborted();

      // Step 3: Generate answer using RAG
      this.updateProgress({
        step: 'generating-answer',
        message: 'Generating comprehensive answer...',
        progress: 80,
        details: { 
          keywords,
          documentsFound: allDocuments.length,
          documentLinks 
        }
      });

      const answer = await this.trackOperation(
        this.generateAnswerFromBackend(query, allDocuments),
        'generateAnswer'
      );

      this.updateProgress({
        step: 'complete',
        message: 'Answer ready!',
        progress: 100,
        details: { 
          keywords,
          documentsFound: allDocuments.length,
          documentLinks 
        }
      });

      return { answer, documents: allDocuments };
    } catch (error) {
      this.logger.logError('SearchOrchestrator', error);
      throw error;
    }
  }

  /**
   * P3-002: Enhanced get search keywords from backend with AbortController
   */
  private async getKeywordsFromBackend(query: string): Promise<string[]> {
    this.checkAborted();
    
    let headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    
    // Add reCAPTCHA token if configured
    if (this.recaptchaSiteKey) {
      headers = await addRecaptchaHeader(headers, this.recaptchaSiteKey, 'keywords');
    }
    
    // P3-002: Check abort after potentially async reCAPTCHA operation
    this.checkAborted();
    
    const response = await fetch(`${this.config.backend.url}/api/keywords`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        query,
        systemContext: this.config.context?.systemContext,
        maxKeywords: this.config.maxSearchQueries || 5
      }),
      // P3-002: Add abort signal to fetch
      signal: this.abortController?.signal,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Failed to get keywords');
    }

    const data = await response.json();
    return data.keywords;
  }

  /**
   * P3-002: Enhanced generate answer from backend using RAG with AbortController
   */
  private async generateAnswerFromBackend(
    query: string,
    documents: DocumentContent[]
  ): Promise<string> {
    this.checkAborted();
    
    let headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    
    // Add reCAPTCHA token if configured
    if (this.recaptchaSiteKey) {
      headers = await addRecaptchaHeader(headers, this.recaptchaSiteKey, 'generate_answer');
    }
    
    // P3-002: Check abort after potentially async reCAPTCHA operation
    this.checkAborted();
    
    const response = await fetch(`${this.config.backend.url}/api/generate-answer`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        query,
        documents: documents.slice(0, 10), // Backend will handle the limit
        systemContext: this.config.context?.systemContext,
      }),
      // P3-002: Add abort signal to fetch
      signal: this.abortController?.signal,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Failed to generate answer');
    }

    const data = await response.json();
    return data.answer;
  }

  /**
   * P3-002: Enhanced perform a single search query with abort checking
   */
  private async performSingleSearch(
    query: string,
    algoliaClient: any,
    indexName: string,
    hitsPerPage: number = 5
  ): Promise<InternalDocSearchHit[]> {
    this.checkAborted();
    
    try {
      const response = await algoliaClient.search([{
        indexName,
        query,
        params: {
          hitsPerPage,
          attributesToRetrieve: ['*'],
          attributesToHighlight: ['*']
        }
      }]);

      // P3-002: Check abort after Algolia operation
      this.checkAborted();

      return response.results[0]?.hits || [];
    } catch (error) {
      // P3-002: Handle abort errors specifically
      if (error instanceof Error && error.message === 'Operation cancelled') {
        throw error;
      }
      
      this.logger.log(`Search failed for query "${query}":`, error);
      return [];
    }
  }

  /**
   * Extract document content from search results
   */
  private extractDocuments(searchResults: InternalDocSearchHit[]): DocumentContent[] {
    return searchResults.map(result => {
      let content = '';
      
      // Build content from hierarchy
      if (result.hierarchy) {
        const levels = ['lvl0', 'lvl1', 'lvl2', 'lvl3', 'lvl4', 'lvl5'] as const;
        const hierarchyParts: string[] = [];
        
        levels.forEach(level => {
          const value = result.hierarchy[level];
          if (value && !hierarchyParts.includes(value)) {
            hierarchyParts.push(value);
          }
        });
        
        if (hierarchyParts.length > 0) {
          content += hierarchyParts.join(' > ') + '\n\n';
        }
      }
      
      // Add main content
      if (result.content) {
        content += result.content + '\n\n';
      }
      
      // Add highlighted content if different
      if (result._highlightResult?.content?.value) {
        const highlighted = result._highlightResult.content.value
          .replace(/<em>/g, '')
          .replace(/<\/em>/g, '')
          .replace(/<[^>]*>/g, '');
        if (!content.includes(highlighted)) {
          content += `Relevant excerpt: ${highlighted}\n`;
        }
      }
      
      const title = result.hierarchy?.lvl1 || 
                    result.hierarchy?.lvl0 || 
                    'Documentation';
      
      return {
        url: result.url,
        title: title.replace(/<[^>]*>/g, ''),
        content: content.trim() || 'No content available'
      };
    });
  }

  /**
   * Update progress
   */
  private updateProgress(step: SearchStep): void {
    if (this.onProgress) {
      this.onProgress(step);
    }
    this.logger.log(`Search step: ${step.step} - ${step.message}`);
  }
} 