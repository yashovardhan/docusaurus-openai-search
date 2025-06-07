/**
 * Proxy utility for secure backend communication
 */

import { OpenAIOptions } from '../types';
import { getLogger } from './logger';

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
  const logger = getLogger();
  const url = `${proxyUrl}${options.endpoint}`;
  
  logger.logAPIRequest(url, {
    method: options.method || 'POST',
    headers: options.headers,
    body: options.body
  });
  
  const startTime = Date.now();
  
  try {
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
      const errorMessage = error.error?.message || `Proxy request failed: ${response.statusText}`;
      logger.logAPIResponse(null, { status: response.status, error: errorMessage });
      throw new Error(errorMessage);
    }

    const data = await response.json();
    logger.logAPIResponse(data);
    logger.logPerformance(`Proxy request to ${options.endpoint}`, startTime);
    
    return data;
  } catch (error) {
    logger.logError(`Proxy request to ${options.endpoint}`, error);
    throw error;
  }
}

/**
 * Create a chat completion through the proxy
 */
export async function createProxyChatCompletion(
  proxyUrl: string,
  messages: Array<{ role: string; content: string }>,
  options: Partial<OpenAIOptions>
): Promise<any> {
  const logger = getLogger();
  
  logger.log('Creating chat completion through proxy', {
    model: options.model || 'gpt-4',
    messageCount: messages.length,
    maxTokens: options.maxTokens || 2000,
    temperature: options.temperature || 0.5
  });
  
  // Log the full prompt being sent
  logger.logPrompt(
    messages.find(m => m.role === 'system')?.content || '',
    messages.find(m => m.role === 'user')?.content || ''
  );
  
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