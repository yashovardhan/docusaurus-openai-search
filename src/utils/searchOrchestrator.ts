import { InternalDocSearchHit } from '@docsearch/react';
import { getLogger } from './logger';
import { createProxyChatCompletion } from './proxy';
import { DocusaurusAISearchConfig } from '../types';
import { ResponseCache } from './responseCache';
import {
  QUERY_ANALYSIS_SYSTEM_PROMPT,
  ENHANCED_QUERY_ANALYSIS_SYSTEM_PROMPT,
  SITEMAP_PATTERNS,
  COMMON_DOC_PATTERNS,
  CONTENT_EXCLUSION_SELECTORS,
  MAIN_CONTENT_SELECTORS,
  DEFAULT_CONFIG,
} from '../config/defaults';

export interface SearchStep {
  step: 'analyzing' | 'searching' | 'retrieving' | 'synthesizing';
  message: string;
  progress: number;
  details?: string[];
}

export interface SearchContext {
  query: string;
  intent?: QueryIntent;
  searchQueries?: string[];
  searchResults?: InternalDocSearchHit[];
  sitemapUrls?: string[];
  discoveredContent?: DocumentContent[];
  queryAnalysisResult?: string;
  aiCallCount?: number;
  startTime?: number;
}

export interface QueryIntent {
  type: 'how-to' | 'concept' | 'troubleshooting' | 'api-reference' | 'general';
  keywords: string[];
  suggestedSearches: string[];
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
  private sitemap?: SitemapEntry[];
  public context?: SearchContext;
  private cache = ResponseCache.getInstance();
  private aiCallCount = 0;

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
    const context: SearchContext = { 
      query,
      aiCallCount: 0,
      startTime: Date.now()
    };
    this.context = context;
    this.aiCallCount = 0;
    
    const documentsToRetrieve = maxDocuments || 
      this.config.research?.maxDocuments || 
      DEFAULT_CONFIG.research.maxDocuments;
    
    const maxAICalls = this.config.research?.maxAICalls || DEFAULT_CONFIG.research.maxAICalls;
    const timeout = (this.config.research?.timeoutSeconds || DEFAULT_CONFIG.research.timeoutSeconds) * 1000;
    const enableCaching = this.config.research?.enableCaching ?? DEFAULT_CONFIG.research.enableCaching;
    const cacheTTL = this.config.research?.cacheTTL || DEFAULT_CONFIG.research.cacheTTL;

    try {
      // Check cache first if enabled
      if (enableCaching) {
        const cached = this.cache.getCached(query, cacheTTL);
        if (cached && cached.documents) {
          this.updateProgress({
            step: 'synthesizing',
            message: 'Using cached results',
            progress: 100,
            details: ['Found cached response for your query']
          });
          return cached.documents as DocumentContent[];
        }
      }

      // Check if we're within AI call budget
      if (this.aiCallCount >= maxAICalls) {
        throw new Error(`AI call limit reached (${maxAICalls} calls)`);
      }

      // Step 1: Analyze query intent with AI for better accuracy
      this.updateProgress({
        step: 'analyzing',
        message: 'Analyzing your question to understand what you\'re looking for...',
        progress: 10,
        details: ['Using AI to understand your query...']
      });
      
      // Check timeout
      if (Date.now() - context.startTime! > timeout) {
        throw new Error('Search timeout exceeded');
      }
      
      try {
        // Try AI analysis first for better accuracy
        context.intent = await this.analyzeQueryIntent(query);
        this.aiCallCount++;
        context.aiCallCount = this.aiCallCount;
        context.queryAnalysisResult = context.intent.explanation;
        
        this.logger.log('AI Query analysis:', context.intent);
        
        // Update progress with AI's understanding
        this.updateProgress({
          step: 'analyzing',
          message: 'Query analysis complete',
          progress: 20,
          details: [
            `AI understood: ${context.intent.explanation}`,
            `Search strategy: ${context.intent.suggestedSearches.length} targeted searches`,
            `AI calls used: ${this.aiCallCount}/${maxAICalls}`
          ]
        });
      } catch (error) {
        // Fallback to simple keyword extraction if AI analysis fails
        this.logger.log('AI analysis failed, falling back to keyword extraction:', error);
        
        const keywords = query.toLowerCase()
          .split(/\s+/)
          .filter(word => word.length > 2 && !['the', 'and', 'for', 'with', 'how', 'what', 'when', 'where', 'why'].includes(word));
        
        context.intent = {
          type: 'general',
          keywords: keywords,
          suggestedSearches: [query],
          explanation: `Searching for: ${query}`
        };
      }

      // Step 2: Generate targeted search queries
      const maxSearchQueries = this.config.research?.maxSearchQueries || DEFAULT_CONFIG.research.maxSearchQueries;
      const searchQueriesToUse = Math.min(
        context.intent.suggestedSearches.length,
        maxSearchQueries
      );
      
      this.updateProgress({
        step: 'searching',
        message: 'Preparing targeted searches...',
        progress: 30,
        details: [
          `Will perform ${searchQueriesToUse} searches`,
          `Search queries: ${context.intent.suggestedSearches.slice(0, searchQueriesToUse).join(', ')}`
        ]
      });
      context.searchQueries = context.intent.suggestedSearches.slice(0, searchQueriesToUse);

      // Step 3: Perform multi-faceted search based on AI analysis
      const searchProgress: string[] = [];
      const searchResults: InternalDocSearchHit[] = [];
      
      for (let i = 0; i < context.searchQueries.length; i++) {
        // Check timeout before each search
        if (Date.now() - context.startTime! > timeout) {
          throw new Error('Search timeout exceeded');
        }
        
        const searchQuery = context.searchQueries[i];
        this.updateProgress({
          step: 'searching',
          message: `Searching documentation (${i + 1}/${context.searchQueries.length})...`,
          progress: 30 + (i * 20 / context.searchQueries.length),
          details: [...searchProgress, `🔍 Searching for: "${searchQuery}"`]
        });
        
        const results = await this.performSingleSearch(searchQuery, algoliaClient, algoliaIndex, 5); // Get 5 results per query
        searchResults.push(...results);
        searchProgress.push(`✓ Found ${results.length} results for "${searchQuery}"`);
      }
      
      context.searchResults = searchResults;
      
      this.updateProgress({
        step: 'searching',
        message: 'Search complete',
        progress: 50,
        details: [
          `Total documents found: ${searchResults.length}`,
          `Time elapsed: ${Math.round((Date.now() - context.startTime!) / 1000)}s`
        ]
      });

      // Step 4: Retrieve and rank content with progress
      // Check timeout before retrieval
      if (Date.now() - context.startTime! > timeout) {
        throw new Error('Search timeout exceeded');
      }
      
      this.updateProgress({
        step: 'retrieving',
        message: 'Retrieving document content...',
        progress: 60,
        details: [`Processing ${searchResults.length} documents...`]
      });
      
      const allUrls = [...new Set(searchResults.map(r => r.url))];
      const documents = await this.retrieveAndRankContent(allUrls, context, searchResults);

      // Step 5: Filter and prepare final documents
      this.updateProgress({
        step: 'synthesizing',
        message: 'Preparing final results for AI synthesis...',
        progress: 90,
        details: [
          `Retrieved content from ${documents.length} documents`,
          `Selecting top ${documentsToRetrieve} most relevant documents`,
          `Total time: ${Math.round((Date.now() - context.startTime!) / 1000)}s`
        ]
      });
      
      context.discoveredContent = documents.slice(0, documentsToRetrieve);
      
      // Don't cache partial results - let AISearchModal cache the complete response
      // This prevents cache entries with null responses
      
      return context.discoveredContent;
    } catch (error) {
      this.logger.logError('SearchOrchestrator', error);
      throw error;
    }
  }

  /**
   * Analyze query intent using AI with enhanced system context
   */
  private async analyzeQueryIntent(query: string): Promise<QueryIntent> {
    try {
      // Use the user's configured model (single model for all operations)
      const model = this.config.openAI.model || DEFAULT_CONFIG.openAI.model;
      const proxyUrl = this.config.openAI.proxyUrl;
      
      // Build a context-aware system prompt
      const systemPrompt = `${ENHANCED_QUERY_ANALYSIS_SYSTEM_PROMPT}

The user is searching documentation for ${this.config.prompts?.siteName || 'this product'}.
${this.config.prompts?.systemContext ? `Additional context: ${this.config.prompts.systemContext}` : ''}`;
      
      const response = await createProxyChatCompletion(
        proxyUrl,
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Query: "${query}"` }
        ],
        {
          model: model,
          // Use smaller token limit for query analysis to be cost-effective
          maxTokens: Math.min(this.config.openAI.maxTokens || DEFAULT_CONFIG.openAI.maxTokens, 500),
          // Use lower temperature for more consistent analysis
          temperature: Math.min(this.config.openAI.temperature || DEFAULT_CONFIG.openAI.temperature, 0.3),
        }
      );

      const content = response.choices[0]?.message?.content || '{}';
      const intent = JSON.parse(content) as QueryIntent;
      
      // Ensure we have the required fields
      if (!intent.explanation) {
        intent.explanation = `Searching for information about: ${query}`;
      }
      if (!intent.suggestedSearches || intent.suggestedSearches.length === 0) {
        intent.suggestedSearches = [query];
      }
      
      return intent;
    } catch (error) {
      // Fallback to basic intent extraction
      return {
        type: 'general',
        keywords: query.toLowerCase().split(' ').filter(word => word.length > 3),
        suggestedSearches: [query],
        explanation: `Searching for: ${query}`
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
    hitsPerPage: number = 2
  ): Promise<InternalDocSearchHit[]> {
    try {
      const response = await algoliaClient.search([{
        indexName,
        query,
        params: {
          hitsPerPage
        }
      }]);

      return response.results[0]?.hits || [];
    } catch (error) {
      this.logger.log(`Search failed for query "${query}":`, error);
      return [];
    }
  }

  /**
   * Load sitemap from the documentation site
   */
  private async loadSitemap(): Promise<SitemapEntry[]> {
    try {
      // Try sitemap patterns from config
      for (const url of SITEMAP_PATTERNS) {
        try {
          const response = await fetch(url);
          if (response.ok) {
            const text = await response.text();
            return this.parseSitemap(text);
          }
        } catch (e) {
          continue;
        }
      }

      // Fallback: try to discover pages from common patterns
      return await this.discoverPagesFromPatterns();
    } catch (error) {
      this.logger.log('Failed to load sitemap, continuing without it');
      return [];
    }
  }

  /**
   * Parse sitemap XML
   */
  private parseSitemap(xml: string): SitemapEntry[] {
    if (typeof DOMParser === 'undefined') {
      // Server-side, return empty array
      return [];
    }
    
    const parser = new DOMParser();
    const doc = parser.parseFromString(xml, 'text/xml');
    const urls = doc.querySelectorAll('url');
    
    const entries: SitemapEntry[] = [];
    urls.forEach(url => {
      const loc = url.querySelector('loc')?.textContent;
      const lastmod = url.querySelector('lastmod')?.textContent;
      const priority = url.querySelector('priority')?.textContent;
      
      if (loc) {
        entries.push({
          url: loc,
          lastModified: lastmod || undefined,
          priority: priority ? parseFloat(priority) : undefined
        });
      }
    });

    return entries;
  }

  /**
   * Discover pages from common documentation patterns
   */
  private async discoverPagesFromPatterns(): Promise<SitemapEntry[]> {
    const entries: SitemapEntry[] = [];
    
    for (const pattern of COMMON_DOC_PATTERNS) {
      try {
        const response = await fetch(pattern);
        if (response.ok) {
          entries.push({ url: pattern });
        }
      } catch (e) {
        continue;
      }
    }

    return entries;
  }

  /**
   * Consolidate URLs from different sources
   */
  private consolidateUrls(
    searchResults: InternalDocSearchHit[],
    sitemapUrls: string[]
  ): string[] {
    const allUrls = new Set<string>();
    
    // Add search result URLs
    searchResults.forEach(result => allUrls.add(result.url));
    
    // Add sitemap URLs
    sitemapUrls.forEach(url => allUrls.add(url));
    
    return Array.from(allUrls);
  }

  /**
   * Retrieve content and rank by relevance
   */
  private async retrieveAndRankContent(
    urls: string[],
    context: SearchContext,
    searchResults: InternalDocSearchHit[]
  ): Promise<DocumentContent[]> {
    const documents: DocumentContent[] = [];
    
    // Create a map of URLs to search results for fallback content
    const urlToSearchResult = new Map<string, InternalDocSearchHit>();
    searchResults.forEach(result => {
      urlToSearchResult.set(result.url, result);
    });
    
    // Retrieve content in parallel
    const retrievalPromises = urls.map(async url => {
      try {
        const content = await this.fetchDocumentContent(url);
        if (content) {
          documents.push({
            url,
            title: this.extractTitle(content),
            content,
            relevanceScore: 0
          });
        } else {
          // For external URLs or failed fetches, use Algolia search result content
          const searchResult = urlToSearchResult.get(url);
          if (searchResult) {
            let fallbackContent = '';
            
            // Build content from search result hierarchy
            if (searchResult.hierarchy) {
              const levels = ['lvl0', 'lvl1', 'lvl2', 'lvl3', 'lvl4', 'lvl5'] as const;
              levels.forEach(level => {
                const value = searchResult.hierarchy[level];
                if (value) {
                  fallbackContent += `${value}\n`;
                }
              });
            }
            
            // Add snippet if available
            if (searchResult._snippetResult?.content?.value) {
              const snippet = searchResult._snippetResult.content.value
                .replace(/<em>/g, '')
                .replace(/<\/em>/g, '')
                .replace(/<[^>]*>/g, '');
              fallbackContent += `\n${snippet}\n`;
            }
            
            // Add full content if available
            if (searchResult.content) {
              fallbackContent += `\n${searchResult.content}`;
            }
            
            documents.push({
              url,
              title: searchResult.hierarchy?.lvl1 || searchResult.hierarchy?.lvl0 || this.extractTitleFromUrl(url),
              content: fallbackContent || `Content from ${url} (external site)`,
              relevanceScore: 0
            });
          } else {
            // No search result available, use minimal fallback
            documents.push({
              url,
              title: this.extractTitleFromUrl(url),
              content: `Content from ${url} (external site - content not available)`,
              relevanceScore: 0
            });
          }
        }
      } catch (error) {
        this.logger.log(`Failed to retrieve ${url}:`, error);
      }
    });

    await Promise.all(retrievalPromises);

    // Score documents for relevance
    for (const doc of documents) {
      doc.relevanceScore = this.calculateRelevanceScore(doc, context);
    }

    // Sort by relevance score
    return documents.sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0));
  }

  /**
   * Fetch and extract content from a document URL
   */
  private async fetchDocumentContent(url: string): Promise<string | null> {
    try {
      // Check if this is an external URL
      if (typeof window !== 'undefined') {
        const urlObj = new URL(url, window.location.origin);
        if (urlObj.origin !== window.location.origin) {
          this.logger.log(`Skipping external URL: ${url}`);
          return null;
        }
      }

      const response = await fetch(url);
      if (!response.ok) return null;

      const html = await response.text();
      return this.extractContentFromHTML(html);
    } catch (error) {
      this.logger.log(`Failed to fetch document from ${url}:`, error);
      return null;
    }
  }

  /**
   * Extract main content from HTML
   */
  private extractContentFromHTML(html: string): string {
    if (typeof document === 'undefined') {
      // Server-side, return empty string
      return '';
    }
    
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;

    // Remove non-content elements using selectors from config
    CONTENT_EXCLUSION_SELECTORS.forEach(selector => {
      tempDiv.querySelectorAll(selector).forEach(el => el.remove());
    });

    // Find main content using selectors from config
    let mainContent: Element | null = null;
    for (const selector of MAIN_CONTENT_SELECTORS) {
      mainContent = tempDiv.querySelector(selector);
      if (mainContent) break;
    }

    return mainContent?.textContent?.trim() || '';
  }

  /**
   * Extract title from content
   */
  private extractTitle(content: string): string {
    const lines = content.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.length > 0 && trimmed.length < 100) {
        return trimmed;
      }
    }
    return 'Untitled Document';
  }

  /**
   * Extract title from URL
   */
  private extractTitleFromUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      
      // Remove file extension and convert path to title
      const segments = pathname.split('/').filter(s => s);
      if (segments.length > 0) {
        const lastSegment = segments[segments.length - 1]
          .replace(/\.[^/.]+$/, '') // Remove file extension
          .replace(/[-_]/g, ' ') // Replace hyphens and underscores with spaces
          .replace(/\b\w/g, l => l.toUpperCase()); // Capitalize first letter of each word
        
        return lastSegment || 'Untitled';
      }
    } catch (error) {
      // Fallback for invalid URLs
    }
    
    return 'External Document';
  }

  /**
   * Calculate relevance score for a document
   */
  private calculateRelevanceScore(
    doc: DocumentContent,
    context: SearchContext
  ): number {
    let score = 0;
    const contentLower = doc.content.toLowerCase();
    const queryLower = context.query.toLowerCase();

    // Query match
    if (contentLower.includes(queryLower)) {
      score += 10;
    }

    // Keyword matches
    if (context.intent?.keywords) {
      context.intent.keywords.forEach(keyword => {
        const keywordLower = keyword.toLowerCase();
        const count = (contentLower.match(new RegExp(keywordLower, 'g')) || []).length;
        score += Math.min(count * 2, 10);
      });
    }

    // Title relevance
    const titleLower = doc.title.toLowerCase();
    if (titleLower.includes(queryLower)) {
      score += 15;
    }

    // Intent-based scoring
    if (context.intent?.type) {
      switch (context.intent.type) {
        case 'how-to':
          if (contentLower.includes('guide') || contentLower.includes('tutorial')) {
            score += 5;
          }
          break;
        case 'api-reference':
          if (contentLower.includes('api') || contentLower.includes('reference')) {
            score += 5;
          }
          break;
        case 'troubleshooting':
          if (contentLower.includes('error') || contentLower.includes('fix')) {
            score += 5;
          }
          break;
      }
    }

    return score;
  }

  /**
   * Update progress callback
   */
  private updateProgress(step: SearchStep): void {
    if (this.onProgress) {
      this.onProgress(step);
    }
    this.logger.log(`Search step: ${step.step} - ${step.message}`);
  }
}

interface SitemapEntry {
  url: string;
  lastModified?: string;
  priority?: number;
} 