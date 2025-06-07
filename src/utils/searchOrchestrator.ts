import { InternalDocSearchHit } from '@docsearch/react';
import { getLogger } from './logger';
import { createProxyChatCompletion } from './proxy';
import { DocusaurusAISearchConfig } from '../types';
import { ResponseCache } from './responseCache';
import { DEFAULT_CONFIG, ENHANCED_QUERY_ANALYSIS_PROMPT } from '../config/defaults';

export interface SearchStep {
  step: 'analyzing' | 'searching' | 'retrieving' | 'synthesizing';
  message: string;
  progress: number;
  details?: string[];
}

export interface QueryIntent {
  searchQueries: string[];
  queryType?: 'how-to' | 'concept' | 'troubleshooting' | 'api-reference' | 'general';
  explanation?: string;
}

export interface DocumentContent {
  url: string;
  title: string;
  content: string;
  relevanceScore?: number;
}

export class SearchOrchestrator {
  private logger = getLogger();
  private config: DocusaurusAISearchConfig;
  private onProgress?: (step: SearchStep) => void;
  private cache = ResponseCache.getInstance();
  private queryIntent?: QueryIntent;

  constructor(
    config: DocusaurusAISearchConfig,
    onProgress?: (step: SearchStep) => void
  ) {
    this.config = config;
    this.onProgress = onProgress;
  }

  /**
   * Main orchestration method that performs intelligent search
   */
  async performIntelligentSearch(
    query: string,
    algoliaClient: any,
    algoliaIndex: string,
    maxDocuments?: number
  ): Promise<DocumentContent[]> {
    const documentsToRetrieve = maxDocuments || 
      this.config.prompts?.maxDocuments || 
      DEFAULT_CONFIG.prompts.maxDocuments;
    
    const maxSearchQueries = this.config.maxSearchQueries || DEFAULT_CONFIG.maxSearchQueries;
    const enableCaching = this.config.enableCaching ?? DEFAULT_CONFIG.enableCaching;
    const cacheTTL = this.config.cacheTTL || DEFAULT_CONFIG.cacheTTL;

    try {
      // Check cache first if enabled
      if (enableCaching) {
        const cached = this.cache.getCached(query, cacheTTL);
        if (cached && cached.documents) {
          this.updateProgress({
            step: 'synthesizing',
            message: 'Using cached results',
            progress: 100,
          });
          return cached.documents as DocumentContent[];
        }
      }

      // Step 1: Analyze query intent with AI
      this.updateProgress({
        step: 'analyzing',
        message: 'Understanding your question...',
        progress: 20,
        details: ['Using AI to analyze query intent...']
      });
      
      this.queryIntent = await this.analyzeQueryIntent(query, maxSearchQueries);
      
      this.updateProgress({
        step: 'analyzing',
        message: 'Query analysis complete',
        progress: 25,
        details: [
          `Identified ${this.queryIntent.searchQueries.length} search strategies`,
          this.queryIntent.explanation || ''
        ].filter(Boolean)
      });
      
      // Step 2: Perform intelligent searches
      this.updateProgress({
        step: 'searching',
        message: 'Searching documentation with multiple strategies...',
        progress: 40,
      });
      
      const allSearchResults: InternalDocSearchHit[] = [];
      const searchDetails: string[] = [];
      
      for (let i = 0; i < this.queryIntent.searchQueries.length; i++) {
        const searchQuery = this.queryIntent.searchQueries[i];
        this.updateProgress({
          step: 'searching',
          message: `Searching: "${searchQuery}" (${i + 1}/${this.queryIntent.searchQueries.length})`,
          progress: 40 + (i * 20 / this.queryIntent.searchQueries.length),
          details: [...searchDetails, `🔍 Searching for: "${searchQuery}"`]
        });
        
        const results = await this.performSingleSearch(searchQuery, algoliaClient, algoliaIndex, 5);
        allSearchResults.push(...results);
        searchDetails.push(`✓ Found ${results.length} results for "${searchQuery}"`);
      }
      
      // Step 3: Retrieve and intelligently rank content
      this.updateProgress({
        step: 'retrieving',
        message: 'Analyzing and ranking search results...',
        progress: 70,
        details: [`Processing ${allSearchResults.length} total results...`]
      });
      
      const documents = await this.retrieveAndRankContent(allSearchResults, query);
      
      // Step 4: Return top documents
      this.updateProgress({
        step: 'synthesizing',
        message: 'Preparing most relevant documents...',
        progress: 90,
        details: [`Selected top ${Math.min(documentsToRetrieve, documents.length)} documents`]
      });
      
      const finalDocuments = documents.slice(0, documentsToRetrieve);
      
      // Cache results if enabled
      if (enableCaching) {
        this.cache.set(query, null, this.queryIntent.explanation, finalDocuments);
      }
      
      return finalDocuments;
    } catch (error) {
      this.logger.logError('SearchOrchestrator', error);
      throw error;
    }
  }

  /**
   * Get query analysis context for external use
   */
  get context() {
    return {
      queryAnalysisResult: this.queryIntent?.explanation,
      aiCallCount: 1 // We make one AI call for query analysis
    };
  }

  /**
   * Analyze query intent using enhanced AI understanding
   */
  private async analyzeQueryIntent(query: string, maxQueries: number): Promise<QueryIntent> {
    try {
      const model = this.config.openAI.model || DEFAULT_CONFIG.openAI.model;
      const proxyUrl = this.config.openAI.proxyUrl;
      
      // Build context-aware prompt
      const systemPrompt = `${ENHANCED_QUERY_ANALYSIS_PROMPT}

The user is searching documentation for ${this.config.prompts?.siteName || 'this product'}.
${this.config.prompts?.systemContext ? `Additional context: ${this.config.prompts.systemContext}` : ''}

Return ONLY a JSON array of up to ${maxQueries} search queries.`;
      
      const response = await createProxyChatCompletion(
        proxyUrl,
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: query }
        ],
        {
          model: model,
          maxTokens: 300,
          temperature: 0.3,
        }
      );

      const content = response.choices[0]?.message?.content || '[]';
      const searchQueries = JSON.parse(content) as string[];
      
      // Ensure we have valid queries
      if (!Array.isArray(searchQueries) || searchQueries.length === 0) {
        throw new Error('Invalid AI response');
      }
      
      return {
        searchQueries: searchQueries.slice(0, maxQueries),
        explanation: `Found ${searchQueries.length} search strategies for: "${query}"`
      };
    } catch (error) {
      // Fallback to basic search
      this.logger.log('AI query analysis failed, using fallback:', error);
      
      // Simple keyword extraction fallback
      const keywords = query.toLowerCase()
        .split(/\s+/)
        .filter(word => word.length > 2);
      
      return {
        searchQueries: [query, ...keywords.slice(0, 2)].slice(0, maxQueries),
        explanation: `Basic search for: "${query}"`
      };
    }
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
   * Retrieve content and intelligently rank by relevance
   */
  private async retrieveAndRankContent(
    searchResults: InternalDocSearchHit[],
    originalQuery: string
  ): Promise<DocumentContent[]> {
    // De-duplicate results by URL
    const uniqueResults = new Map<string, InternalDocSearchHit>();
    searchResults.forEach(result => {
      if (!uniqueResults.has(result.url)) {
        uniqueResults.set(result.url, result);
      }
    });
    
    const documents: DocumentContent[] = [];
    
    // Process each unique result
    for (const [url, searchResult] of uniqueResults) {
      const doc = await this.extractDocumentContent(searchResult);
      if (doc) {
        // Calculate intelligent relevance score
        doc.relevanceScore = this.calculateRelevanceScore(doc, originalQuery, searchResult);
        documents.push(doc);
      }
    }
    
    // Sort by relevance score
    return documents.sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0));
  }

  /**
   * Extract comprehensive content from search result
   */
  private async extractDocumentContent(searchResult: InternalDocSearchHit): Promise<DocumentContent | null> {
    let content = '';
    
    // Build comprehensive content from all available fields
    
    // 1. Hierarchy provides structured context
    if (searchResult.hierarchy) {
      const levels = ['lvl0', 'lvl1', 'lvl2', 'lvl3', 'lvl4', 'lvl5'] as const;
      const hierarchyParts: string[] = [];
      
      levels.forEach(level => {
        const value = searchResult.hierarchy[level];
        if (value && !hierarchyParts.includes(value)) {
          hierarchyParts.push(value);
        }
      });
      
      if (hierarchyParts.length > 0) {
        content += hierarchyParts.join(' > ') + '\n\n';
      }
    }
    
    // 2. Main content
    if (searchResult.content) {
      content += searchResult.content + '\n\n';
    }
    
    // 3. Highlighted content (often contains the most relevant parts)
    if (searchResult._highlightResult?.content?.value) {
      const highlighted = searchResult._highlightResult.content.value
        .replace(/<em>/g, '**')
        .replace(/<\/em>/g, '**');
      content += `Relevant excerpt: ${highlighted}\n\n`;
    }
    
    // 4. Snippet (search-specific excerpt)
    if (searchResult._snippetResult?.content?.value) {
      const snippet = searchResult._snippetResult.content.value
        .replace(/<em>/g, '')
        .replace(/<\/em>/g, '')
        .replace(/<[^>]*>/g, '');
      if (!content.includes(snippet)) {
        content += `Search snippet: ${snippet}\n`;
      }
    }
    
    // 5. Additional metadata
    if (searchResult.type) {
      content = `[${searchResult.type}]\n${content}`;
    }
    
    const title = searchResult.hierarchy?.lvl1 || 
                  searchResult.hierarchy?.lvl0 || 
                  searchResult._highlightResult?.hierarchy?.lvl1?.value ||
                  'Documentation';
    
    return {
      url: searchResult.url,
      title: title.replace(/<[^>]*>/g, ''), // Strip HTML tags
      content: content.trim() || 'No content available',
      relevanceScore: 0
    };
  }

  /**
   * Calculate intelligent relevance score
   */
  private calculateRelevanceScore(
    doc: DocumentContent,
    query: string,
    searchResult: InternalDocSearchHit
  ): number {
    let score = 0;
    const queryLower = query.toLowerCase();
    const queryWords = queryLower.split(/\s+/).filter(w => w.length > 2);
    
    // 1. Title relevance (highest weight)
    const titleLower = doc.title.toLowerCase();
    if (titleLower === queryLower) {
      score += 100; // Exact title match
    } else if (titleLower.includes(queryLower)) {
      score += 50; // Full query in title
    } else {
      // Check individual words
      queryWords.forEach(word => {
        if (titleLower.includes(word)) {
          score += 10;
        }
      });
    }
    
    // 2. Content relevance
    const contentLower = doc.content.toLowerCase();
    const queryOccurrences = (contentLower.match(new RegExp(queryLower, 'g')) || []).length;
    score += queryOccurrences * 5;
    
    // Word occurrences
    queryWords.forEach(word => {
      const wordOccurrences = (contentLower.match(new RegExp(word, 'g')) || []).length;
      score += Math.min(wordOccurrences * 2, 20); // Cap per-word score
    });
    
    // 3. Search result relevance (Algolia's ranking)
    if (searchResult._rankingInfo?.matchedGeoLocation) {
      score += 30;
    }
    
    // 4. Content type bonus
    if (searchResult.type === 'lvl1' || searchResult.type === 'content') {
      score += 15; // Main content pages
    }
    
    // 5. Highlighted content bonus (indicates Algolia found it relevant)
    if (searchResult._highlightResult?.content?.matchLevel === 'full') {
      score += 25;
    } else if (searchResult._highlightResult?.content?.matchLevel === 'partial') {
      score += 15;
    }
    
    // 6. URL path relevance
    const urlLower = doc.url.toLowerCase();
    queryWords.forEach(word => {
      if (urlLower.includes(word)) {
        score += 5;
      }
    });
    
    return score;
  }

  /**
   * Update progress with optional details
   */
  private updateProgress(step: SearchStep): void {
    if (this.onProgress) {
      this.onProgress(step);
    }
    this.logger.log(`Search step: ${step.step} - ${step.message}`);
  }
} 