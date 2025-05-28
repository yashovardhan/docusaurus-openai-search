/**
 * Logger utility for Docusaurus AI Search
 * Provides comprehensive logging for debugging RAG pipeline
 */

export interface LoggerConfig {
  enabled: boolean;
  prefix?: string;
}

export class AISearchLogger {
  private enabled: boolean;
  private prefix: string;

  constructor(config: LoggerConfig) {
    this.enabled = config.enabled;
    this.prefix = config.prefix || '[AI Search]';
  }

  /**
   * Log general information
   */
  log(message: string, data?: any): void {
    if (!this.enabled) return;
    
    console.log(`${this.prefix} ${message}`, data || '');
  }

  /**
   * Log search query information
   */
  logQuery(query: string, searchResults: any[]): void {
    if (!this.enabled) return;
    
    console.group(`${this.prefix} Query: "${query}"`);
    console.log('Number of search results:', searchResults.length);
    console.log('Search results:', searchResults.map((result, idx) => ({
      index: idx,
      url: result.url,
      title: result.hierarchy?.lvl0 || result.hierarchy?.lvl1 || 'No title',
      snippet: result._snippetResult?.content?.value?.substring(0, 100) + '...' || 'No snippet'
    })));
    console.groupEnd();
  }

  /**
   * Log content retrieval process
   */
  logContentRetrieval(url: string, success: boolean, content?: string): void {
    if (!this.enabled) return;
    
    console.group(`${this.prefix} Content Retrieval: ${url}`);
    console.log('Success:', success);
    if (success && content) {
      console.log('Content length:', content.length);
      console.log('Content preview:', content.substring(0, 200) + '...');
    } else {
      console.log('Failed to retrieve content');
    }
    console.groupEnd();
  }

  /**
   * Log RAG content preparation
   */
  logRAGContent(documentContents: string[]): void {
    if (!this.enabled) return;
    
    console.group(`${this.prefix} RAG Content Preparation`);
    console.log('Number of documents:', documentContents.length);
    documentContents.forEach((content, idx) => {
      console.log(`Document ${idx + 1}:`, {
        length: content.length,
        preview: content.substring(0, 150) + '...'
      });
    });
    console.groupEnd();
  }

  /**
   * Log prompt generation
   */
  logPrompt(systemPrompt: string, userPrompt: string): void {
    if (!this.enabled) return;
    
    console.group(`${this.prefix} Prompt Generation`);
    console.log('System Prompt:', systemPrompt);
    console.log('User Prompt:', userPrompt);
    console.log('Total prompt length:', systemPrompt.length + userPrompt.length);
    console.groupEnd();
  }

  /**
   * Log AI API request
   */
  logAPIRequest(endpoint: string, payload: any): void {
    if (!this.enabled) return;
    
    console.group(`${this.prefix} API Request to ${endpoint}`);
    console.log('Payload:', payload);
    console.groupEnd();
  }

  /**
   * Log AI API response
   */
  logAPIResponse(response: any, error?: any): void {
    if (!this.enabled) return;
    
    console.group(`${this.prefix} API Response`);
    if (error) {
      console.error('Error:', error);
    } else {
      console.log('Response:', response);
      if (response.choices?.[0]?.message?.content) {
        console.log('Generated answer length:', response.choices[0].message.content.length);
      }
    }
    console.groupEnd();
  }

  /**
   * Log summarization process
   */
  logSummarization(originalContent: string[], summarizedContent: string): void {
    if (!this.enabled) return;
    
    console.group(`${this.prefix} Content Summarization`);
    console.log('Original content count:', originalContent.length);
    console.log('Original total length:', originalContent.reduce((sum, c) => sum + c.length, 0));
    console.log('Summarized length:', summarizedContent.length);
    console.log('Compression ratio:', (summarizedContent.length / originalContent.reduce((sum, c) => sum + c.length, 0) * 100).toFixed(2) + '%');
    console.groupEnd();
  }

  /**
   * Log performance metrics
   */
  logPerformance(operation: string, startTime: number): void {
    if (!this.enabled) return;
    
    const duration = Date.now() - startTime;
    console.log(`${this.prefix} Performance - ${operation}: ${duration}ms`);
  }

  /**
   * Log error with context
   */
  logError(context: string, error: any): void {
    if (!this.enabled) return;
    
    console.error(`${this.prefix} Error in ${context}:`, error);
  }
}

// Create a singleton logger instance
let loggerInstance: AISearchLogger | null = null;

export function createLogger(enabled: boolean = false): AISearchLogger {
  if (!loggerInstance) {
    loggerInstance = new AISearchLogger({ enabled });
  } else {
    // Update enabled state if needed
    loggerInstance = new AISearchLogger({ enabled });
  }
  return loggerInstance;
}

export function getLogger(): AISearchLogger {
  if (!loggerInstance) {
    loggerInstance = new AISearchLogger({ enabled: false });
  }
  return loggerInstance;
} 