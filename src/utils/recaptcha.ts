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

/**
 * Load reCAPTCHA script
 */
export async function loadRecaptcha(siteKey: string): Promise<void> {
  if (recaptchaLoaded) {
    return;
  }
  
  if (recaptchaLoadPromise) {
    return recaptchaLoadPromise;
  }
  
  recaptchaLoadPromise = new Promise((resolve, reject) => {
    // Check if already loaded
    if (window.grecaptcha) {
      recaptchaLoaded = true;
      resolve();
      return;
    }
    
    // Create callback
    window.onRecaptchaLoad = () => {
      recaptchaLoaded = true;
      resolve();
    };
    
    // Load script
    const script = document.createElement('script');
    script.src = `https://www.google.com/recaptcha/api.js?render=${siteKey}&onload=onRecaptchaLoad`;
    script.async = true;
    script.defer = true;
    script.onerror = () => {
      recaptchaLoadPromise = null;
      reject(new Error('Failed to load reCAPTCHA'));
    };
    
    document.head.appendChild(script);
  });
  
  return recaptchaLoadPromise;
}

/**
 * Execute reCAPTCHA and get token
 */
export async function getRecaptchaToken(
  siteKey: string, 
  action: string = 'submit'
): Promise<string | null> {
  try {
    // Ensure reCAPTCHA is loaded
    await loadRecaptcha(siteKey);
    
    if (!window.grecaptcha) {
      console.error('reCAPTCHA not loaded');
      return null;
    }
    
    // Execute reCAPTCHA
    const token = await window.grecaptcha.execute(siteKey, { action });
    return token;
  } catch (error) {
    console.error('reCAPTCHA error:', error);
    return null;
  }
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