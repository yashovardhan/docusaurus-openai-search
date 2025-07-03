/**
 * Central export of all utility functions
 */

// Logger utilities
export { createLogger, getLogger } from './logger';
export type { AISearchLogger } from './logger';

// Search orchestration
export { SearchOrchestrator } from './searchOrchestrator';
export type { SearchStep, DocumentContent } from './searchOrchestrator';

// Response caching
export { ResponseCache } from './responseCache';

// Cleanup utilities
export { 
  CleanupManager,
  DOMCleanupUtils,
  RefCleanupUtils,
  TimerCleanupUtils,
  ModalCleanupUtils,
  useCleanup
} from './cleanup';
export type { CleanupTask } from './cleanup';

// reCAPTCHA utilities
export { 
  addRecaptchaHeader,
  getRecaptchaToken,
  loadRecaptcha,
  cleanupRecaptcha,
  isRecaptchaReady,
  getRecaptchaState,
  resetLoadAttempts,
  forceReloadRecaptcha 
} from './recaptcha';

// Error Boundary components
export { 
  ErrorBoundary, 
  withErrorBoundary, 
  useErrorBoundary 
} from '../components/ErrorBoundary';

// Export types from types.ts
export type { MultiSourceResult, AggregatedSearchResult, ConversationTurn, ConversationSession } from '../types'; 