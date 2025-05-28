/**
 * Proxy utility for secure backend communication
 */

import { OpenAIOptions } from '../types';

export interface ProxyRequestOptions {
  endpoint: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: any;
  headers?: Record<string, string>;
}

/**
 * Make a request to the proxy server
 */
export async function makeProxyRequest(
  proxyUrl: string,
  options: ProxyRequestOptions
): Promise<any> {
  const url = `${proxyUrl}${options.endpoint}`;
  
  const response = await fetch(url, {
    method: options.method || 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
    credentials: 'include' // Include cookies for session management if needed
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: { message: 'Unknown error' } }));
    throw new Error(error.error?.message || `Proxy request failed: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Create a chat completion through the proxy
 */
export async function createProxyChatCompletion(
  proxyUrl: string,
  messages: Array<{ role: string; content: string }>,
  options: Partial<OpenAIOptions>
): Promise<any> {
  return makeProxyRequest(proxyUrl, {
    endpoint: '/api/chat/completions',
    method: 'POST',
    body: {
      model: options.model || 'gpt-4',
      messages,
      max_tokens: options.maxTokens || 2000,
      temperature: options.temperature || 0.5
    }
  });
}

/**
 * Summarize content through the proxy
 */
export async function createProxySummarization(
  proxyUrl: string,
  query: string,
  content: string[],
  options?: {
    model?: string;
    maxTokens?: number;
    systemPrompt?: string;
  }
): Promise<string> {
  const response = await makeProxyRequest(proxyUrl, {
    endpoint: '/api/summarize',
    method: 'POST',
    body: {
      query,
      content,
      model: options?.model,
      maxTokens: options?.maxTokens,
      systemPrompt: options?.systemPrompt
    }
  });

  return response.summary;
} 