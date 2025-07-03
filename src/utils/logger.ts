/**
 * Simple logger utility for Docusaurus AI Search
 */

export class AISearchLogger {
  private enabled: boolean;
  private prefix: string = '[AI Search]';

  constructor(enabled: boolean) {
    this.enabled = enabled;
  }

  /**
   * Log general information
   */
  log(message: string, data?: any): void {
    if (!this.enabled) return;
    
    if (data !== undefined) {
      console.log(`${this.prefix} ${message}`, data);
    } else {
      console.log(`${this.prefix} ${message}`);
    }
  }

  /**
   * Log error with context
   */
  logError(context: string, error: any): void {
    if (!this.enabled) return;
    
    console.error(`${this.prefix} Error in ${context}:`, error);
  }
  
  /**
   * Log error (interface compatibility)
   */
  error(...args: any[]): void {
    if (!this.enabled) return;
    console.error(this.prefix, ...args);
  }
  
  /**
   * Log warning
   */
  warn(...args: any[]): void {
    if (!this.enabled) return;
    console.warn(this.prefix, ...args);
  }
  
  /**
   * Enable or disable logging
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }
  
  /**
   * Get current logging state
   */
  isEnabled(): boolean {
    return this.enabled;
  }
  
  /**
   * Reset logger state
   */
  reset(): void {
    this.enabled = false;
  }
}

// Create a singleton logger instance
let loggerInstance: AISearchLogger | null = null;

export function createLogger(enabled: boolean = false): AISearchLogger {
  loggerInstance = new AISearchLogger(enabled);
  return loggerInstance;
}

export function getLogger(): AISearchLogger {
  if (!loggerInstance) {
    loggerInstance = new AISearchLogger(false);
  }
  return loggerInstance;
}

/**
 * Reset the logger instance (for cleanup/testing)
 */
export function resetLogger(): void {
  if (loggerInstance) {
    loggerInstance = null;
  }
}

/**
 * Check if logger instance exists
 */
export function hasLoggerInstance(): boolean {
  return loggerInstance !== null;
} 