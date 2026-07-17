// =============================================
// LLM Adapter - Unified interface for LLM calls
// Phase 1: Uses coze-coding-dev-sdk (doubao-seed)
// Interface designed for multi-model support
// =============================================

import { LLMClient, Config, HeaderUtils } from 'coze-coding-dev-sdk';

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMAdapterConfig {
  model?: string;
  temperature?: number;
  thinking?: 'enabled' | 'disabled';
}

export class LLMAdapter {
  private client: LLMClient;
  private defaultConfig: LLMAdapterConfig;

  constructor(customHeaders?: Record<string, string>) {
    const config = new Config();
    this.client = new LLMClient(config, customHeaders);
    this.defaultConfig = {
      model: 'doubao-seed-2-0-lite-260215',
      temperature: 0.8,
      thinking: 'disabled',
    };
  }

  async invoke(
    messages: LLMMessage[],
    adapterConfig?: LLMAdapterConfig
  ): Promise<string> {
    const mergedConfig = { ...this.defaultConfig, ...adapterConfig };

    const response = await this.client.invoke(
      messages.map(m => ({ role: m.role, content: m.content })),
      {
        model: mergedConfig.model,
        temperature: mergedConfig.temperature,
        thinking: mergedConfig.thinking,
      }
    );

    return response.content;
  }

  async *stream(
    messages: LLMMessage[],
    adapterConfig?: LLMAdapterConfig
  ): AsyncGenerator<string> {
    const mergedConfig = { ...this.defaultConfig, ...adapterConfig };

    const stream = this.client.stream(
      messages.map(m => ({ role: m.role, content: m.content })),
      {
        model: mergedConfig.model,
        temperature: mergedConfig.temperature,
        thinking: mergedConfig.thinking,
      }
    );

    for await (const chunk of stream) {
      if (chunk.content) {
        yield chunk.content.toString();
      }
    }
  }

  // Convenience method for structured JSON responses
  async invokeJSON<T>(
    messages: LLMMessage[],
    adapterConfig?: LLMAdapterConfig
  ): Promise<T> {
    const response = await this.invoke(messages, {
      ...adapterConfig,
      temperature: adapterConfig?.temperature ?? 0.3,
    });

    try {
      // Try to extract JSON from the response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]) as T;
      }
      return JSON.parse(response) as T;
    } catch {
      console.error('[LLM] Failed to parse JSON response:', response.substring(0, 200));
      throw new Error('LLM response is not valid JSON');
    }
  }
}

// Singleton instance
let adapterInstance: LLMAdapter | null = null;

export function getLLMAdapter(headers?: Record<string, string>): LLMAdapter {
  if (!adapterInstance) {
    adapterInstance = new LLMAdapter(headers);
  }
  return adapterInstance;
}
