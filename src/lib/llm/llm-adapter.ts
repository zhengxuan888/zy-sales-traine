// =============================================
// LLM Adapter - Agnai-style Three-Layer Registry
// Layer 1: AI_ADAPTERS registry (model capabilities)
// Layer 2: Format mapping (preset → API dialect)
// Layer 3: serviceGenMap (parameter translation table)
//
// Adding a new model = add one entry to the registry
// =============================================

import { LLMClient, Config } from 'coze-coding-dev-sdk';

// --- Layer 1: Model Registry ---
// Each entry defines a model's capabilities and constraints

export interface ModelCapability {
  /** Model identifier used in API calls */
  modelId: string;
  /** Display name */
  displayName: string;
  /** Provider (for routing) */
  provider: 'doubao' | 'deepseek' | 'kimi' | 'openai' | 'custom';
  /** Max context tokens */
  maxContextTokens: number;
  /** Supports streaming */
  supportsStreaming: boolean;
  /** Supports structured output (JSON mode) */
  supportsJsonMode: boolean;
  /** Supports thinking/reasoning mode */
  supportsThinking: boolean;
  /** Cost tier for budget management */
  costTier: 'low' | 'medium' | 'high';
  /** Best use cases */
  bestFor: ('buyer' | 'coach' | 'judge')[];
}

/**
 * AI_ADAPTERS Registry - All available models
 * To add a new model: just add an entry here + a format mapping below
 */
export const AI_ADAPTERS: Record<string, ModelCapability> = {
  'doubao-seed-lite': {
    modelId: 'doubao-seed-2-0-lite-260215',
    displayName: 'Doubao Seed 2.0 Lite',
    provider: 'doubao',
    maxContextTokens: 32000,
    supportsStreaming: true,
    supportsJsonMode: true,
    supportsThinking: false,
    costTier: 'low',
    bestFor: ['buyer'],
  },
  'doubao-seed-pro': {
    modelId: 'doubao-seed-2-0-pro-260215',
    displayName: 'Doubao Seed 2.0 Pro',
    provider: 'doubao',
    maxContextTokens: 64000,
    supportsStreaming: true,
    supportsJsonMode: true,
    supportsThinking: true,
    costTier: 'high',
    bestFor: ['coach', 'judge'],
  },
  'doubao-seed-mini': {
    modelId: 'doubao-seed-2-0-mini-260215',
    displayName: 'Doubao Seed 2.0 Mini',
    provider: 'doubao',
    maxContextTokens: 32000,
    supportsStreaming: true,
    supportsJsonMode: true,
    supportsThinking: false,
    costTier: 'low',
    bestFor: ['buyer'],
  },
  'deepseek-v3': {
    modelId: 'deepseek-v3-2-251201',
    displayName: 'DeepSeek V3',
    provider: 'deepseek',
    maxContextTokens: 64000,
    supportsStreaming: true,
    supportsJsonMode: true,
    supportsThinking: false,
    costTier: 'medium',
    bestFor: ['buyer', 'coach'],
  },
  'kimi-k2': {
    modelId: 'kimi-k2-5-260127',
    displayName: 'Kimi K2.5',
    provider: 'kimi',
    maxContextTokens: 128000,
    supportsStreaming: true,
    supportsJsonMode: true,
    supportsThinking: true,
    costTier: 'high',
    bestFor: ['coach', 'judge'],
  },
};

// --- Layer 2: Format Mapping ---
// Maps unified "preset" to model-specific API parameters

export interface PresetConfig {
  /** Preset name */
  name: string;
  /** Description */
  description: string;
  /** Base temperature */
  temperature: number;
  /** Max tokens for response */
  maxTokens: number;
  /** Top-p sampling */
  topP: number;
  /** Frequency penalty */
  frequencyPenalty: number;
  /** Presence penalty */
  presencePenalty: number;
  /** Thinking mode (if supported) */
  thinking?: 'enabled' | 'disabled';
  /** System prompt prefix */
  systemPrefix?: string;
}

/**
 * Preset registry - unified configurations for different use cases
 * These are model-agnostic; the serviceGenMap translates them per-model
 */
export const PRESETS: Record<string, PresetConfig> = {
  'buyer-chat': {
    name: 'Buyer Chat',
    description: 'Casual, natural buyer conversation',
    temperature: 0.85,
    maxTokens: 200,
    topP: 0.95,
    frequencyPenalty: 0.3,
    presencePenalty: 0.2,
  },
  'buyer-aggressive': {
    name: 'Aggressive Buyer',
    description: 'More confrontational buyer persona',
    temperature: 0.9,
    maxTokens: 200,
    topP: 0.9,
    frequencyPenalty: 0.4,
    presencePenalty: 0.3,
  },
  'coach-review': {
    name: 'Coach Review',
    description: 'Detailed coaching analysis',
    temperature: 0.4,
    maxTokens: 2000,
    topP: 0.9,
    frequencyPenalty: 0.1,
    presencePenalty: 0.1,
    systemPrefix: 'You are an expert sales coach.',
  },
  'judge-scoring': {
    name: 'Judge Scoring',
    description: 'Precise scoring evaluation',
    temperature: 0.2,
    maxTokens: 1500,
    topP: 0.85,
    frequencyPenalty: 0.0,
    presencePenalty: 0.0,
    systemPrefix: 'You are a precise scoring judge.',
  },
  'case-analysis': {
    name: 'Case Analysis',
    description: 'Compare and analyze case conversations',
    temperature: 0.3,
    maxTokens: 3000,
    topP: 0.9,
    frequencyPenalty: 0.1,
    presencePenalty: 0.1,
  },
};

// --- Layer 3: serviceGenMap (Parameter Translation) ---
// Translates unified preset → model-specific API parameters
// Each model provider may interpret parameters differently

export interface TranslatedParams {
  model: string;
  temperature: number;
  maxTokens: number;
  topP: number;
  thinking?: 'enabled' | 'disabled';
  /** Provider-specific extra params */
  extra?: Record<string, unknown>;
}

/**
 * Service Generation Map - per-provider parameter translation rules
 * Each provider can override how presets map to actual API parameters
 */
const SERVICE_GEN_MAP: Record<string, (preset: PresetConfig, model: ModelCapability) => TranslatedParams> = {
  doubao: (preset, model) => ({
    model: model.modelId,
    temperature: preset.temperature,
    maxTokens: preset.maxTokens,
    topP: preset.topP,
    thinking: model.supportsThinking ? preset.thinking : undefined,
    extra: {
      frequency_penalty: preset.frequencyPenalty,
      presence_penalty: preset.presencePenalty,
    },
  }),
  deepseek: (preset, model) => ({
    model: model.modelId,
    // DeepSeek works better with slightly lower temperature
    temperature: Math.max(0.1, preset.temperature - 0.05),
    maxTokens: preset.maxTokens,
    topP: preset.topP,
    extra: {
      frequency_penalty: preset.frequencyPenalty * 0.8,
      presence_penalty: preset.presencePenalty * 0.8,
    },
  }),
  kimi: (preset, model) => ({
    model: model.modelId,
    temperature: preset.temperature,
    maxTokens: preset.maxTokens,
    topP: preset.topP,
    thinking: model.supportsThinking ? preset.thinking : undefined,
    extra: {
      // Kimi handles penalties differently
      frequency_penalty: Math.min(0.5, preset.frequencyPenalty),
      presence_penalty: Math.min(0.5, preset.presencePenalty),
    },
  }),
  openai: (preset, model) => ({
    model: model.modelId,
    temperature: preset.temperature,
    maxTokens: preset.maxTokens,
    topP: preset.topP,
    extra: {
      frequency_penalty: preset.frequencyPenalty,
      presence_penalty: preset.presencePenalty,
    },
  }),
};

// --- Unified LLM Client ---

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMInvokeOptions {
  /** Model key from AI_ADAPTERS registry */
  modelKey?: string;
  /** Preset key from PRESETS registry */
  preset?: string;
  /** Override specific preset params */
  overrides?: Partial<PresetConfig>;
  /** Thinking mode */
  thinking?: 'enabled' | 'disabled';
}

export class LLMAdapter {
  private client: LLMClient;
  private defaultModelKey: string;
  private defaultPreset: string;

  constructor(customHeaders?: Record<string, string>) {
    const config = new Config();
    this.client = new LLMClient(config, customHeaders);
    this.defaultModelKey = 'doubao-seed-lite';
    this.defaultPreset = 'buyer-chat';
  }

  /**
   * Resolve a preset + model into translated API parameters
   */
  private resolveParams(options: LLMInvokeOptions): TranslatedParams {
    const modelKey = options.modelKey || this.defaultModelKey;
    const presetKey = options.preset || this.defaultPreset;

    const model = AI_ADAPTERS[modelKey];
    if (!model) {
      throw new Error(`Unknown model: ${modelKey}. Available: ${Object.keys(AI_ADAPTERS).join(', ')}`);
    }

    const basePreset = PRESETS[presetKey];
    if (!basePreset) {
      throw new Error(`Unknown preset: ${presetKey}. Available: ${Object.keys(PRESETS).join(', ')}`);
    }

    // Merge overrides
    const preset: PresetConfig = {
      ...basePreset,
      ...options.overrides,
      thinking: options.thinking ?? basePreset.thinking,
    };

    // Translate via serviceGenMap
    const translator = SERVICE_GEN_MAP[model.provider];
    if (!translator) {
      throw new Error(`No serviceGenMap for provider: ${model.provider}`);
    }

    return translator(preset, model);
  }

  /**
   * Get the best model for a given use case
   */
  static getBestModel(useCase: 'buyer' | 'coach' | 'judge', costPreference: 'low' | 'medium' | 'high' = 'low'): string {
    const candidates = Object.entries(AI_ADAPTERS)
      .filter(([_, m]) => m.bestFor.includes(useCase) && m.costTier === costPreference)
      .sort((a, b) => b[1].maxContextTokens - a[1].maxContextTokens);

    return candidates[0]?.[0] || 'doubao-seed-lite';
  }

  /**
   * Invoke LLM with unified interface
   */
  async invoke(
    messages: LLMMessage[],
    options: LLMInvokeOptions = {}
  ): Promise<string> {
    const params = this.resolveParams(options);

    const response = await this.client.invoke(
      messages.map(m => ({ role: m.role, content: m.content })),
      {
        model: params.model,
        temperature: params.temperature,
        thinking: params.thinking,
      }
    );

    return response.content;
  }

  /**
   * Stream LLM response
   */
  async *stream(
    messages: LLMMessage[],
    options: LLMInvokeOptions = {}
  ): AsyncGenerator<string> {
    const params = this.resolveParams(options);

    const stream = this.client.stream(
      messages.map(m => ({ role: m.role, content: m.content })),
      {
        model: params.model,
        temperature: params.temperature,
        thinking: params.thinking,
      }
    );

    for await (const chunk of stream) {
      if (chunk.content) {
        yield chunk.content.toString();
      }
    }
  }

  /**
   * Invoke and parse JSON response
   */
  async invokeJSON<T>(
    messages: LLMMessage[],
    options: LLMInvokeOptions = {}
  ): Promise<T> {
    const response = await this.invoke(messages, {
      ...options,
      overrides: { ...options.overrides, temperature: options.overrides?.temperature ?? 0.3 },
    });

    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]) as T;
      }
      return JSON.parse(response) as T;
    } catch {
      console.error('[LLM] Failed to parse JSON:', response.substring(0, 200));
      throw new Error('LLM response is not valid JSON');
    }
  }

  /**
   * Get model info for a given key
   */
  static getModelInfo(modelKey: string): ModelCapability | null {
    return AI_ADAPTERS[modelKey] || null;
  }

  /**
   * List all available models
   */
  static listModels(): Array<{ key: string; capability: ModelCapability }> {
    return Object.entries(AI_ADAPTERS).map(([key, capability]) => ({ key, capability }));
  }
}

// Singleton instance
let adapterInstance: LLMAdapter | null = null;

export function getLLMAdapter(): LLMAdapter {
  if (!adapterInstance) {
    adapterInstance = new LLMAdapter();
  }
  return adapterInstance;
}
