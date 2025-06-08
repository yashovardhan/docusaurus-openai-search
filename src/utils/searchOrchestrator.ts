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

  constructor(
    config: DocusaurusAISearchConfig,
    onProgress?: (step: SearchStep) => void
  ) {
    this.config = config;
    this.onProgress = onProgress;
    this.recaptchaSiteKey = config.recaptcha?.siteKey;
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
      // Step 1: Request keywords from backend
      this.updateProgress({
        step: 'requesting-keywords',
        message: 'Analyzing your question...',
        progress: 10,
      });

      const keywords = await this.getKeywordsFromBackend(query);
      
      this.updateProgress({
        step: 'keywords-received',
        message: 'Search strategy identified',
        progress: 20,
        details: { keywords }
      });

      // Step 2: Search for each keyword
      this.updateProgress({
        step: 'searching',
        message: 'Searching documentation...',
        progress: 30,
      });

      const allDocuments: DocumentContent[] = [];
      const documentLinks: string[] = [];
      
      for (let i = 0; i < keywords.length; i++) {
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
        
        const results = await this.performSingleSearch(keyword, algoliaClient, algoliaIndex);
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

      const answer = await this.generateAnswerFromBackend(query, allDocuments);

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
   * Get search keywords from backend
   */
  private async getKeywordsFromBackend(query: string): Promise<string[]> {
    let headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    
    // Add reCAPTCHA token if configured
    if (this.recaptchaSiteKey) {
      headers = await addRecaptchaHeader(headers, this.recaptchaSiteKey, 'keywords');
    }
    
    const response = await fetch(`${this.config.backend.url}/api/keywords`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        query,
        systemContext: this.config.context?.systemContext,
        maxKeywords: this.config.maxSearchQueries || 5
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Failed to get keywords');
    }

    const data = await response.json();
    return data.keywords;
  }

  /**
   * Generate answer from backend using RAG
   */
  private async generateAnswerFromBackend(
    query: string,
    documents: DocumentContent[]
  ): Promise<string> {
    let headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    
    // Add reCAPTCHA token if configured
    if (this.recaptchaSiteKey) {
      headers = await addRecaptchaHeader(headers, this.recaptchaSiteKey, 'generate_answer');
    }
    
    const response = await fetch(`${this.config.backend.url}/api/generate-answer`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        query,
        documents: documents.slice(0, 10), // Backend will handle the limit
        systemContext: this.config.context?.systemContext,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Failed to generate answer');
    }

    const data = await response.json();
    return data.answer;
  }

  /**
   * Perform a single search query
   */
  private async performSingleSearch(
    query: string,
    algoliaClient: any,
    indexName: string,
    hitsPerPage: number = 5
  ): Promise<InternalDocSearchHit[]> {
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

      return response.results[0]?.hits || [];
    } catch (error) {
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