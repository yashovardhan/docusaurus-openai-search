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
  private readonly maxSize: number = 100; // Configurable size limit
  
  private constructor() {}
  
  static getInstance(): ResponseCache {
    if (!ResponseCache.instance) {
      ResponseCache.instance = new ResponseCache();
    }
    return ResponseCache.instance;
  }
  
  /**
   * Reset the singleton instance (for cleanup/testing)
   */
  static reset(): void {
    if (ResponseCache.instance) {
      ResponseCache.instance.clear();
      ResponseCache.instance = null as any;
    }
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
    
    // Enforce size limits - remove oldest entries if cache is full
    if (this.cache.size >= this.maxSize) {
      this.evictOldest();
    }
    
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
   * Get maximum cache size
   */
  getMaxSize(): number {
    return this.maxSize;
  }
  
  /**
   * Remove expired entries from cache
   */
  cleanupExpired(ttl: number): void {
    const now = Date.now();
    let removedCount = 0;
    
    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp > ttl * 1000) {
        this.cache.delete(key);
        removedCount++;
      }
    }
    
    if (removedCount > 0) {
      this.logger.log(`Cleaned up ${removedCount} expired cache entries`);
    }
  }
  
  /**
   * Get all cache keys (for debugging/monitoring)
   */
  getKeys(): string[] {
    return Array.from(this.cache.keys());
  }
  
  /**
   * Evict oldest entries when cache is full
   */
  private evictOldest(): void {
    if (this.cache.size === 0) return;
    
    let oldestKey: string | null = null;
    let oldestTime = Date.now();
    
    // Find the oldest entry
    for (const [key, value] of this.cache.entries()) {
      if (value.timestamp < oldestTime) {
        oldestTime = value.timestamp;
        oldestKey = key;
      }
    }
    
    if (oldestKey) {
      this.cache.delete(oldestKey);
      this.logger.log('Evicted oldest cache entry to make room for new entry');
    }
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