import { InternalDocSearchHit } from '@docsearch/react';
import { getLogger } from './logger';
import { DocusaurusAISearchConfig } from '../types';
import { addRecaptchaHeader } from './recaptcha';

export interface SearchStep {
  step: 'requesting-keywords' | 'keywords-received' | 'searching' | 'documents-found' | 'generating-answer' | 'multi-source-search' | 'aggregating-results' | 'complete';
  message: string;
  progress: number;
  details?: {
    keywords?: string[];
    documentsFound?: number;
    documentLinks?: string[];
    sourcesFound?: { [key: string]: number };
  };
}

export interface DocumentContent {
  url: string;
  title: string;
  content: string;
}

export interface MultiSourceResult {
  source: 'documentation' | 'github' | 'blog' | 'changelog';
  title: string;
  url: string;
  content: string;
  metadata: {
    weight: number;
    timestamp?: string;
    author?: string;
    type?: string;
  };
}

export interface AggregatedSearchResult {
  answer: string;
  sources: MultiSourceResult[];
  aggregationMetrics: {
    totalSources: number;
    sourceBreakdown: Record<string, number>;
    confidenceScore: number;
  };
  validation?: {
    confidence?: string;
    isNotFound?: boolean;
    hasSources?: boolean;
    score?: number;
    qualityMetrics?: any;
    warnings?: string[];
  };
  // Week 6: Intelligence layer enhancements
  followUpQuestions?: string[];
  sessionId?: string;
}

// Week 6: Conversational memory types
export interface ConversationTurn {
  query: string;
  answer: string;
  timestamp: Date;
  queryAnalysis?: any;
}

export interface SessionInfo {
  sessionId: string;
  createdAt: Date;
  lastActiveAt: Date;
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
  
  // Week 6: Session management
  private currentSessionId: string | null = null;

  constructor(
    config: DocusaurusAISearchConfig,
    onProgress?: (step: SearchStep) => void
  ) {
    this.config = config;
    this.onProgress = onProgress;
    this.recaptchaSiteKey = config.recaptcha?.siteKey;
    // Initialize abort controller for this orchestrator instance
    this.abortController = new AbortController();
    
    // Week 6: Initialize session if conversational memory is enabled
    if (config.features?.conversationalMemory?.enabled) {
      this.initializeSession();
    }
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
   * Week 2 Enhancement: Returns validation data along with answer and documents
   */
  async performAISearch(
    query: string,
    algoliaClient: any,
    algoliaIndex: string
  ): Promise<{ 
    answer: string; 
    documents: DocumentContent[];
    validation?: {
      confidence?: string;
      isNotFound?: boolean;
      hasSources?: boolean;
      score?: number;
      qualityMetrics?: any;
      warnings?: string[];
    };
    queryAnalysis?: {
      type?: string;
      intent?: string;
      complexity?: string;
    };
    enhancement?: {
      recursiveEnhanced?: boolean;
      documentsAnalyzed?: number;
      fineTunedModelUsed?: boolean;
    };
  }> {
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

      const result = await this.trackOperation(
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

      return { 
        answer: result.answer, 
        documents: allDocuments,
        validation: result.validation, // Week 2: Pass validation data through
        queryAnalysis: result.queryAnalysis, // Week 3: Pass query analysis data through
        enhancement: result.enhancement // Stage 3: Pass recursive enhancement data through
      };
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
   * Week 2 Enhancement: Returns both answer and validation data
   */
  private async generateAnswerFromBackend(
    query: string,
    documents: DocumentContent[]
  ): Promise<{ 
    answer: string; 
    validation?: {
      confidence?: string;
      isNotFound?: boolean;
      hasSources?: boolean;
      score?: number;
      qualityMetrics?: any;
      warnings?: string[];
    };
    queryAnalysis?: {
      type?: string;
      intent?: string;
      complexity?: string;
    };
    enhancement?: {
      recursiveEnhanced?: boolean;
      documentsAnalyzed?: number;
      fineTunedModelUsed?: boolean;
    };
  }> {
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
    return {
      answer: data.answer,
      validation: data.validation, // Week 2: Capture validation data
      queryAnalysis: data.queryAnalysis, // Week 3: Capture query analysis data
      enhancement: data.enhancement // Stage 3: Capture recursive enhancement data
    };
  }

  /**
   * Expand query with variations and synonyms for better search results
   */
  private expandQuery(query: string): string[] {
    const variations = [query];
    
    // Remove special characters version
    const cleanQuery = query.replace(/[^a-zA-Z0-9\s]/g, ' ').trim();
    if (cleanQuery !== query) {
      variations.push(cleanQuery);
    }
    
    // Common substitutions
    const substitutions = [
      ['use', 'usage'],
      ['config', 'configuration'],
      ['auth', 'authentication'],
      ['docs', 'documentation'],
      ['api', 'API'],
      ['intro', 'introduction'],
      ['dev', 'development'],
      ['prod', 'production']
    ];
    
    substitutions.forEach(([from, to]) => {
      if (query.toLowerCase().includes(from)) {
        variations.push(query.replace(new RegExp(from, 'gi'), to));
      }
    });
    
    return [...new Set(variations)].slice(0, 3); // Max 3 variations
  }

  /**
   * P3-002: Enhanced perform a single search query with query expansion and abort checking
   */
  private async performSingleSearch(
    query: string,
    algoliaClient: any,
    indexName: string,
    hitsPerPage: number = 10  // Increased from 5
  ): Promise<InternalDocSearchHit[]> {
    this.checkAborted();
    
    const allHits: InternalDocSearchHit[] = [];
    const seenUrls = new Set<string>();
    
    // Try query variations
    const queries = this.expandQuery(query);
    
    for (const q of queries) {
      try {
        const response = await algoliaClient.search([{
          indexName,
          query: q,
          params: {
            hitsPerPage,
            attributesToRetrieve: ['*'],
            attributesToHighlight: ['*'],
            highlightPreTag: '<mark>',
            highlightPostTag: '</mark>',
            // Add these for better results
            removeWordsIfNoResults: 'allOptional',
            queryType: 'prefixLast'
          }
        }]);
        
        const hits = response.results[0]?.hits || [];
        
        // Deduplicate by URL
        hits.forEach((hit: InternalDocSearchHit) => {
          if (hit.url && !seenUrls.has(hit.url)) {
            seenUrls.add(hit.url);
            allHits.push(hit);
          }
        });
      } catch (error) {
        this.logger.log(`Search failed for query variant "${q}":`, error);
      }
    }
    
    return allHits.slice(0, hitsPerPage); // Return top N unique results
  }

  /**
   * Extract document content from search results with enhanced context
   */
  private extractDocuments(searchResults: InternalDocSearchHit[]): DocumentContent[] {
    return searchResults.map(result => {
      let content = '';
      
      // Build complete hierarchy path for context
      const hierarchyPath: string[] = [];
      const levels = ['lvl0', 'lvl1', 'lvl2', 'lvl3', 'lvl4', 'lvl5'] as const;
      
      levels.forEach(level => {
        const value = result.hierarchy[level];
        if (value && !hierarchyPath.includes(value)) {
          hierarchyPath.push(value);
        }
      });
      
      // Add section path as context
      if (hierarchyPath.length > 0) {
        content += `Section: ${hierarchyPath.join(' > ')}\n\n`;
      }
      
      // Add main content
      if (result.content) {
        content += `${result.content}\n\n`;
      }
      
      // Add highlighted snippets
      if (result._highlightResult?.content?.value) {
        const highlighted = result._highlightResult.content.value
          .replace(/<mark>/g, '')
          .replace(/<\/mark>/g, '')
          .replace(/<[^>]*>/g, '');
        
        // Only add if it's different from main content
        if (!content.includes(highlighted)) {
          content += `Key excerpt: ${highlighted}\n\n`;
        }
      }
      
      // Extract any code blocks from snippets
      if (result._snippetResult?.content?.value) {
        const snippet = result._snippetResult.content.value;
        const codeMatch = snippet.match(/```[\s\S]*?```/g);
        if (codeMatch) {
          content += `Code example found:\n${codeMatch[0]}\n\n`;
        }
      }
      
      const title = hierarchyPath[hierarchyPath.length - 1] || 
                    result.hierarchy?.lvl1 || 
                    'Documentation';
      
      return {
        url: result.url,
        title: title.replace(/<[^>]*>/g, ''),
        content: content.trim()
      };
    }).filter(doc => doc.content); // Remove empty documents
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

  /**
   * Stage 2: Enhanced AI search with multi-source capabilities
   */
  async performMultiSourceAISearch(
    query: string,
    searchClient: any,
    indexName: string,
    multiSourceConfig?: {
      github?: { repository: string; };
      blog?: { url: string; };
      changelog?: { url: string; };
    }
  ): Promise<AggregatedSearchResult> {
    try {
      // P3-002: Check if operation should proceed
      this.checkAborted();
      
      // Step 1: Request keywords from backend
      this.updateProgress({
        step: 'requesting-keywords',
        message: 'Analyzing your question...',
        progress: 5,
      });

      const keywords = await this.trackOperation(
        this.getKeywordsFromBackend(query),
        'getKeywords'
      );
      
      this.updateProgress({
        step: 'keywords-received',
        message: 'Search strategy identified',
        progress: 10,
        details: { keywords }
      });

      // P3-002: Check abort before continuing
      this.checkAborted();

      // Step 2: Search documentation (traditional search)
      this.updateProgress({
        step: 'searching',
        message: 'Searching documentation...',
        progress: 20,
      });

      const allDocuments: DocumentContent[] = [];
      const documentLinks: string[] = [];
      
      for (let i = 0; i < keywords.length; i++) {
        // P3-002: Check abort before each search iteration
        this.checkAborted();
        
        const keyword = keywords[i];
        this.updateProgress({
          step: 'searching',
          message: `Searching documentation: "${keyword}" (${i + 1}/${keywords.length})`,
          progress: 20 + (i * 20 / keywords.length),
          details: { 
            keywords,
            documentsFound: allDocuments.length,
            documentLinks 
          }
        });
        
        const results = await this.trackOperation(
          this.performSingleSearch(keyword, searchClient, indexName),
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
        message: `Found ${allDocuments.length} documentation sources`,
        progress: 40,
        details: { 
          keywords,
          documentsFound: allDocuments.length,
          documentLinks 
        }
      });

      // P3-002: Check abort before multi-source search
      this.checkAborted();

      // Step 3: Multi-source search
      this.updateProgress({
        step: 'multi-source-search',
        message: 'Searching additional sources...',
        progress: 50,
      });

      const multiSourceResult = await this.trackOperation(
        this.performMultiSourceSearch(query, allDocuments, multiSourceConfig),
        'multiSourceSearch'
      );

      this.updateProgress({
        step: 'aggregating-results',
        message: 'Aggregating results from all sources...',
        progress: 80,
        details: {
          keywords,
          documentsFound: allDocuments.length,
          documentLinks,
          sourcesFound: multiSourceResult.aggregationMetrics.sourceBreakdown
        }
      });

      // P3-002: Check abort before completion
      this.checkAborted();

      this.updateProgress({
        step: 'complete',
        message: 'Search completed successfully',
        progress: 100,
        details: {
          keywords,
          documentsFound: allDocuments.length,
          documentLinks,
          sourcesFound: multiSourceResult.aggregationMetrics.sourceBreakdown
        }
      });

      return multiSourceResult;
    } catch (error: any) {
      // P3-002: Handle cancellation gracefully
      if (error.message === 'Operation cancelled') {
        this.logger.log('Multi-source AI search cancelled');
        throw error;
      }
      
      this.logger.error('Multi-source AI search failed:', error);
      
      // Fallback to basic search
      const fallbackResult = await this.performAISearch(query, searchClient, indexName);
      
      return {
        answer: fallbackResult.answer,
        sources: fallbackResult.documents.map(doc => ({
          source: 'documentation' as const,
          title: doc.title,
          url: doc.url,
          content: doc.content,
          metadata: {
            weight: 0.5,
            type: 'documentation'
          }
        })),
        aggregationMetrics: {
          totalSources: fallbackResult.documents.length,
          sourceBreakdown: {
            documentation: fallbackResult.documents.length,
            github: 0,
            blog: 0,
            changelog: 0
          },
          confidenceScore: 50
        },
        validation: fallbackResult.validation
      };
    }
  }

  /**
   * Stage 2: Multi-source search backend integration
   */
  private async performMultiSourceSearch(
    query: string,
    documents: DocumentContent[],
    multiSourceConfig?: {
      github?: { repository: string; };
      blog?: { url: string; };
      changelog?: { url: string; };
    }
  ): Promise<AggregatedSearchResult> {
    const requestBody = {
      query,
      documents,
      systemContext: this.config.systemContext,
      config: multiSourceConfig || {}
    };

    const requestOptions: RequestInit = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'docusaurus-ai-search/1.0',
      },
      body: JSON.stringify(requestBody),
      signal: this.abortController?.signal
    };

    // Add reCAPTCHA header if enabled
    if (this.recaptchaSiteKey) {
      await addRecaptchaHeader(requestOptions.headers as Record<string, string>, this.recaptchaSiteKey, 'multi_source_search');
    }

    const response = await fetch(`${this.config.backend.url}/api/multi-source-search`, requestOptions);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Multi-source search failed: ${errorData.error?.message || response.statusText}`);
    }

    const data = await response.json();
    
    return {
      answer: data.answer,
      sources: data.sources || [],
      aggregationMetrics: data.aggregationMetrics || {
        totalSources: 0,
        sourceBreakdown: { documentation: 0, github: 0, blog: 0, changelog: 0 },
        confidenceScore: 0
      },
      validation: data.validation
    };
  }

  /**
   * Week 6: Initialize a new conversation session
   */
  private async initializeSession(): Promise<void> {
    try {
      const response = await fetch(`${this.config.backend.url}/api/session/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          systemContext: this.config.context?.systemContext
        }),
        signal: this.abortController?.signal
      });

      if (response.ok) {
        const data = await response.json();
        this.currentSessionId = data.sessionId;
        this.logger.log(`Session initialized: ${this.currentSessionId}`);
      }
    } catch (error) {
      this.logger.error('Failed to initialize session:', error);
      // Continue without session if creation fails
    }
  }

  /**
   * Week 6: Get current session ID
   */
  getSessionId(): string | null {
    return this.currentSessionId;
  }

  /**
   * Week 6: Get conversation history for current session
   */
  async getConversationHistory(): Promise<ConversationTurn[]> {
    if (!this.currentSessionId) {
      return [];
    }

    try {
      const response = await fetch(
        `${this.config.backend.url}/api/session/${this.currentSessionId}/history`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
          signal: this.abortController?.signal
        }
      );

      if (response.ok) {
        const data = await response.json();
        return data.turns || [];
      }
    } catch (error) {
      this.logger.error('Failed to get conversation history:', error);
    }

    return [];
  }

  /**
   * Week 6: Enhanced AI search with conversational memory
   */
  async performConversationalAISearch(
    query: string,
    algoliaClient: any,
    algoliaIndex: string
  ): Promise<{ 
    answer: string; 
    documents: DocumentContent[];
    validation?: {
      confidence?: string;
      isNotFound?: boolean;
      hasSources?: boolean;
      score?: number;
      qualityMetrics?: any;
      warnings?: string[];
    };
    queryAnalysis?: {
      type?: string;
      intent?: string;
      complexity?: string;
    };
    followUpQuestions?: string[];
    sessionId?: string;
  }> {
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

      // Step 3: Generate answer with conversational memory
      this.updateProgress({
        step: 'generating-answer',
        message: 'Generating comprehensive answer with context...',
        progress: 80,
      });

      const answerResult = await this.trackOperation(
        this.generateAnswerWithMemory(query, allDocuments),
        'generateAnswerWithMemory'
      );

      this.updateProgress({
        step: 'complete',
        message: 'Search completed successfully',
        progress: 100,
        details: { 
          keywords,
          documentsFound: allDocuments.length,
          documentLinks 
        }
      });

      return {
        answer: answerResult.answer,
        documents: allDocuments,
        validation: answerResult.validation,
        queryAnalysis: answerResult.queryAnalysis,
        followUpQuestions: answerResult.followUpQuestions,
        sessionId: answerResult.sessionId || this.currentSessionId || undefined
      };
    } catch (error: any) {
      // P3-002: Handle cancellation gracefully
      if (error.message === 'Operation cancelled') {
        this.logger.log('Conversational AI search cancelled');
        throw error;
      }
      
      this.logger.error('Conversational AI search failed:', error);
      
      // Fallback to basic search
      const fallbackResult = await this.performAISearch(query, algoliaClient, algoliaIndex);
      
      return {
        ...fallbackResult,
        followUpQuestions: [],
        sessionId: this.currentSessionId || undefined
      };
    }
  }

  /**
   * Week 6: Generate answer with conversational memory
   */
  private async generateAnswerWithMemory(
    query: string,
    documents: DocumentContent[]
  ): Promise<{ 
    answer: string; 
    validation?: {
      confidence?: string;
      isNotFound?: boolean;
      hasSources?: boolean;
      score?: number;
      qualityMetrics?: any;
      warnings?: string[];
    };
    queryAnalysis?: {
      type?: string;
      intent?: string;
      complexity?: string;
    };
    followUpQuestions?: string[];
    sessionId?: string;
  }> {
    const requestBody = {
      query,
      documents,
      systemContext: this.config.context?.systemContext,
      sessionId: this.currentSessionId
    };

    const requestOptions: RequestInit = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'docusaurus-ai-search/1.0',
      },
      body: JSON.stringify(requestBody),
      signal: this.abortController?.signal
    };

    // Add reCAPTCHA if enabled
    if (this.recaptchaSiteKey) {
      await addRecaptchaHeader(requestOptions.headers as Record<string, string>, this.recaptchaSiteKey, 'generate_answer_with_memory');
    }

    const response = await fetch(`${this.config.backend.url}/api/generate-answer-with-memory`, requestOptions);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Answer generation failed: ${errorData.error?.message || response.statusText}`);
    }

    const data = await response.json();
    
    // Update session ID if returned from backend
    if (data.sessionId && !this.currentSessionId) {
      this.currentSessionId = data.sessionId;
    }
    
    return {
      answer: data.answer,
      validation: data.validation,
      queryAnalysis: data.queryAnalysis,
      followUpQuestions: data.followUpQuestions || [],
      sessionId: data.sessionId
    };
  }

  /**
   * Week 6: Generate follow-up questions for a given query and answer
   */
  async generateFollowUpQuestions(
    query: string,
    answer: string,
    queryAnalysis?: any
  ): Promise<string[]> {
    try {
      const requestBody = {
        sessionId: this.currentSessionId,
        query,
        answer,
        queryAnalysis
      };

      const response = await fetch(`${this.config.backend.url}/api/follow-up-questions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
        signal: this.abortController?.signal
      });

      if (response.ok) {
        const data = await response.json();
        return data.followUpQuestions || [];
      }
    } catch (error) {
      this.logger.error('Failed to generate follow-up questions:', error);
    }

    return [];
  }
} 