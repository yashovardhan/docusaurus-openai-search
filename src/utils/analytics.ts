/**
 * Analytics utilities for tracking AI search queries
 */

/**
 * Tracks AI queries for analytics purposes
 */
export function trackAIQuery(query: string, success: boolean = true): void {
  try {
    if (typeof window !== "undefined" && (window as any).gtag) {
      (window as any).gtag("event", "ai_search", {
        event_category: "search",
        event_label: query,
        value: success ? 1 : 0,
      });
    }
  } catch (e) {
    // Silently handle error
  }
} 