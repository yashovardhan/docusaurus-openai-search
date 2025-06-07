import { getLogger } from './logger';

interface CachedResponse {
  response: any;
  timestamp: number;
  queryAnalysis?: string;
  documents?: any[];
}

/**
 * Simple in-memory cache for AI responses
 */
export class ResponseCache {
  private static instance: ResponseCache;
  private cache = new Map<string, CachedResponse>();
  private logger = getLogger();
  
  private constructor() {}
  
  static getInstance(): ResponseCache {
    if (!ResponseCache.instance) {
      ResponseCache.instance = new ResponseCache();
    }
    return ResponseCache.instance;
  }
  
  /**
   * Get cached response for a query
   */
  getCached(query: string, ttl: number): CachedResponse | null {
    const normalized = this.normalizeQuery(query);
    const cached = this.cache.get(normalized);
    
    if (cached && Date.now() - cached.timestamp < ttl * 1000) {
      this.logger.log('Cache hit for query:', query);
      return cached;
    }
    
    if (cached) {
      this.logger.log('Cache expired for query:', query);
      this.cache.delete(normalized);
    }
    
    return null;
  }
  
  /**
   * Cache a response
   */
  set(query: string, response: any, queryAnalysis?: string, documents?: any[]): void {
    const normalized = this.normalizeQuery(query);
    this.cache.set(normalized, {
      response,
      timestamp: Date.now(),
      queryAnalysis,
      documents
    });
    this.logger.log('Cached response for query:', query);
  }
  
  /**
   * Clear all cached responses
   */
  clear(): void {
    this.cache.clear();
    this.logger.log('Cache cleared');
  }
  
  /**
   * Get cache size
   */
  size(): number {
    return this.cache.size;
  }
  
  /**
   * Normalize query for consistent caching
   */
  private normalizeQuery(query: string): string {
    // Normalize query to increase cache hits:
    // - Convert to lowercase
    // - Trim whitespace
    // - Replace multiple spaces with single space
    // - Remove punctuation and special characters
    // - Sort words alphabetically (so "react integrate" matches "integrate react")
    return query
      .toLowerCase()
      .trim()
      .replace(/\s+/g, ' ')  // Replace multiple spaces with single space
      .replace(/[^\w\s]/g, '') // Remove non-alphanumeric characters
      .split(' ')
      .sort() // Sort words to handle different word orders
      .join(' ');
  }
} 