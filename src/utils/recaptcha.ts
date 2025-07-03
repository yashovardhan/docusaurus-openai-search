/**
 * Google reCAPTCHA v3 integration for frontend
 */

declare global {
  interface Window {
    grecaptcha: any;
    onRecaptchaLoad?: () => void;
  }
}

let recaptchaLoaded = false;
let recaptchaLoadPromise: Promise<void> | null = null;
let recaptchaScript: HTMLScriptElement | null = null;
let currentSiteKey: string | null = null;
let loadAttempts = 0;
const MAX_LOAD_ATTEMPTS = 3;

/**
 * P2-002: Cleanup reCAPTCHA resources and reset state
 */
export function cleanupRecaptcha(): void {
  try {
    // Reset global state
    recaptchaLoaded = false;
    recaptchaLoadPromise = null;
    currentSiteKey = null;
    loadAttempts = 0;
    
    // Remove script element if it exists
    if (recaptchaScript && recaptchaScript.parentNode) {
      recaptchaScript.parentNode.removeChild(recaptchaScript);
      recaptchaScript = null;
    }
    
    // Clear global callback
    if (window.onRecaptchaLoad) {
      delete window.onRecaptchaLoad;
    }
    
    // Clear grecaptcha if possible (note: this may not fully unload the reCAPTCHA)
    if (window.grecaptcha) {
      try {
        // Some cleanup attempts (though reCAPTCHA doesn't officially support full cleanup)
        delete window.grecaptcha;
      } catch (error) {
        // Ignore errors during cleanup
        console.debug('Could not fully cleanup grecaptcha:', error);
      }
    }
    
    console.debug('[reCAPTCHA] Cleanup completed');
  } catch (error) {
    console.error('[reCAPTCHA] Error during cleanup:', error);
  }
}

/**
 * P2-002: Enhanced reCAPTCHA script loading with multiple initialization handling and error recovery
 */
export async function loadRecaptcha(siteKey: string): Promise<void> {
  // P2-002: Handle multiple initializations - check if already loaded with same site key
  if (recaptchaLoaded && currentSiteKey === siteKey) {
    return;
  }
  
  // P2-002: Handle site key changes - cleanup if different site key
  if (recaptchaLoaded && currentSiteKey !== siteKey) {
    console.debug('[reCAPTCHA] Site key changed, cleaning up previous instance');
    cleanupRecaptcha();
  }
  
  // P2-002: Return existing promise if loading in progress
  if (recaptchaLoadPromise) {
    return recaptchaLoadPromise;
  }
  
  // P2-002: Check maximum load attempts for error recovery
  if (loadAttempts >= MAX_LOAD_ATTEMPTS) {
    throw new Error(`Failed to load reCAPTCHA after ${MAX_LOAD_ATTEMPTS} attempts`);
  }
  
  loadAttempts++;
  currentSiteKey = siteKey;
  
  recaptchaLoadPromise = new Promise((resolve, reject) => {
    // Check if already loaded
    if (window.grecaptcha && recaptchaLoaded) {
      resolve();
      return;
    }
    
    // P2-002: Enhanced callback with error handling
    window.onRecaptchaLoad = () => {
      try {
        if (window.grecaptcha) {
          recaptchaLoaded = true;
          console.debug('[reCAPTCHA] Successfully loaded');
          resolve();
        } else {
          throw new Error('reCAPTCHA loaded but grecaptcha not available');
        }
      } catch (error) {
        console.error('[reCAPTCHA] Error in load callback:', error);
        recaptchaLoadPromise = null;
        reject(error);
      }
    };
    
    // P2-002: Enhanced script creation with better error handling
    try {
      const script = document.createElement('script');
      script.src = `https://www.google.com/recaptcha/api.js?render=${siteKey}&onload=onRecaptchaLoad`;
      script.async = true;
      script.defer = true;
      
      // P2-002: Enhanced error handling with retry logic
      script.onerror = () => {
        console.error(`[reCAPTCHA] Failed to load script (attempt ${loadAttempts}/${MAX_LOAD_ATTEMPTS})`);
        recaptchaLoadPromise = null;
        
        // Remove failed script
        if (script.parentNode) {
          script.parentNode.removeChild(script);
        }
        
        const error = new Error(`Failed to load reCAPTCHA script (attempt ${loadAttempts}/${MAX_LOAD_ATTEMPTS})`);
        reject(error);
      };
      
      // P2-002: Add timeout for loading
      const timeout = setTimeout(() => {
        console.error(`[reCAPTCHA] Load timeout (attempt ${loadAttempts}/${MAX_LOAD_ATTEMPTS})`);
        recaptchaLoadPromise = null;
        
        if (script.parentNode) {
          script.parentNode.removeChild(script);
        }
        
        reject(new Error(`reCAPTCHA load timeout (attempt ${loadAttempts}/${MAX_LOAD_ATTEMPTS})`));
      }, 10000); // 10 second timeout
      
      // Clear timeout on successful load
      const originalCallback = window.onRecaptchaLoad;
      window.onRecaptchaLoad = () => {
        clearTimeout(timeout);
        if (originalCallback) originalCallback();
      };
      
      // Store script reference for cleanup
      recaptchaScript = script;
      document.head.appendChild(script);
      
      console.debug(`[reCAPTCHA] Loading script (attempt ${loadAttempts}/${MAX_LOAD_ATTEMPTS})`);
      
    } catch (error) {
      console.error('[reCAPTCHA] Error creating script:', error);
      recaptchaLoadPromise = null;
      reject(error);
    }
  });
  
  return recaptchaLoadPromise;
}

/**
 * P2-002: Enhanced reCAPTCHA token execution with better error recovery
 */
export async function getRecaptchaToken(
  siteKey: string, 
  action: string = 'submit'
): Promise<string | null> {
  let retryCount = 0;
  const maxRetries = 2;
  
  while (retryCount <= maxRetries) {
    try {
      // P2-002: Ensure reCAPTCHA is loaded with enhanced error handling
      await loadRecaptcha(siteKey);
      
      if (!window.grecaptcha) {
        throw new Error('reCAPTCHA not loaded after loadRecaptcha');
      }
      
      // P2-002: Validate that reCAPTCHA is ready
      if (typeof window.grecaptcha.execute !== 'function') {
        throw new Error('reCAPTCHA execute function not available');
      }
      
      // Execute reCAPTCHA with timeout
      const executePromise = window.grecaptcha.execute(siteKey, { action });
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('reCAPTCHA execute timeout')), 5000);
      });
      
      const token = await Promise.race([executePromise, timeoutPromise]);
      
      if (!token || typeof token !== 'string') {
        throw new Error('Invalid token received from reCAPTCHA');
      }
      
      console.debug(`[reCAPTCHA] Token obtained successfully for action: ${action}`);
      return token;
      
    } catch (error) {
      retryCount++;
      console.error(`[reCAPTCHA] Error getting token (attempt ${retryCount}/${maxRetries + 1}):`, error);
      
      // P2-002: If it's a loading issue and we have retries left, cleanup and retry
      if (retryCount <= maxRetries) {
        if (error instanceof Error && 
            (error.message.includes('not loaded') || 
             error.message.includes('not available') ||
             error.message.includes('timeout'))) {
          
          console.debug('[reCAPTCHA] Attempting cleanup and retry');
          cleanupRecaptcha();
          
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
          continue;
        }
      }
      
      // If we've exhausted retries or it's not a retryable error
      if (retryCount > maxRetries) {
        console.error('[reCAPTCHA] All retry attempts exhausted');
      }
      
      return null;
    }
  }
  
  return null;
}

/**
 * Add reCAPTCHA token to fetch headers
 */
export async function addRecaptchaHeader(
  headers: HeadersInit,
  siteKey: string,
  action: string = 'api_request'
): Promise<HeadersInit> {
  if (!siteKey) {
    return headers;
  }
  
  const token = await getRecaptchaToken(siteKey, action);
  
  if (token) {
    return {
      ...headers,
      'X-Recaptcha-Token': token
    };
  }
  
  return headers;
}

/**
 * P2-002: Additional utility functions for reCAPTCHA management
 */

/**
 * Check if reCAPTCHA is loaded and ready
 */
export function isRecaptchaReady(): boolean {
  return recaptchaLoaded && 
         window.grecaptcha && 
         typeof window.grecaptcha.execute === 'function';
}

/**
 * Get current reCAPTCHA state for debugging
 */
export function getRecaptchaState(): {
  loaded: boolean;
  siteKey: string | null;
  attempts: number;
  scriptPresent: boolean;
  grecaptchaAvailable: boolean;
} {
  return {
    loaded: recaptchaLoaded,
    siteKey: currentSiteKey,
    attempts: loadAttempts,
    scriptPresent: !!recaptchaScript,
    grecaptchaAvailable: !!window.grecaptcha
  };
}

/**
 * Reset load attempts (useful for testing or manual recovery)
 */
export function resetLoadAttempts(): void {
  loadAttempts = 0;
  console.debug('[reCAPTCHA] Load attempts reset');
}

/**
 * Force reload reCAPTCHA (cleanup and reload)
 */
export async function forceReloadRecaptcha(siteKey: string): Promise<void> {
  console.debug('[reCAPTCHA] Force reloading reCAPTCHA');
  cleanupRecaptcha();
  resetLoadAttempts();
  return loadRecaptcha(siteKey);
} 