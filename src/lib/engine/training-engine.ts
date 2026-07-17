// =============================================
// Training Engine - Orchestrator (Supabase SDK)
// Coordinates all engine components for a training session
// =============================================

import { getClient } from '../db';
import { LLMAdapter } from '../llm/llm-adapter';
import { buildPrompt, buildBuyerUserMessage } from './prompt-builder';
import { detectStateTransition } from './state-machine';
import { createInitialMemory, updateMemory } from './memory-store';
import { scoreMessage, calculateFinalScore } from './scoring-engine';
import type {
  ChatMessage,
  ConversationState,
  BuyerMemory,
  BuyerPersonaConfig,
  MarketConfigData,
  CoachIssue,
  CoachExample,
} from './types';

interface LoadedState {
  id: string;
  buyerPersona: Record<string, unknown> | null;
  marketConfig: Record<string, unknown> | null;
  scenarioConfig: Record<string, unknown> | null;
  conversationHistory: Array<Record<string, unknown>>;
  currentTurn: number;
  memory?: Record<string, unknown>;
  currentState?: string;
  deductions?: Array<{ reason: string; points: number; dimension: string }>;
  scoreSignals?: Record<string, unknown>;
}

export class TrainingEngine {
  private id = '';
  private userId: string | null = null;
  private currentState: ConversationState = 'INITIAL';
  private memory: BuyerMemory = createInitialMemory();
  private messages: ChatMessage[] = [];
  private messageCounter = 0;
  private buyerPersona: BuyerPersonaConfig | null = null;
  private marketConfig: MarketConfigData | null = null;
  private productType = 'iPhone 14 Pro 256GB';
  private productCondition = 'used';
  private listedPrice = 650;
  private sopChecklist: Array<{ step: string; required: boolean }> = [];
  private deductions: Array<{ reason: string; points: number; dimension: string }> = [];
  private scoreSignals: Record<string, unknown> = {};
  private llm: LLMAdapter;

  constructor() {
    this.llm = new LLMAdapter();
  }

  async initialize(params: {
    scenarioConfig: Record<string, unknown>;
    userId: string | null;
    mode: string;
    caseId?: string;
  }): Promise<{ id: string; buyerGreeting: string }> {
    const client = getClient();
    const scenario = params.scenarioConfig;
    const persona = scenario.buyer_persona as Record<string, unknown> | null;
    const market = scenario.market_config as Record<string, unknown> | null;

    // Build persona config
    const pt = (persona?.personality_traits as Record<string, number>) || {};
    this.buyerPersona = {
      id: (persona?.id as string) || '',
      name: (persona?.name as string) || 'Skeptical Buyer',
      personalityTraits: {
        aggressiveness: pt.aggressiveness ?? 3,
        patience: pt.patience ?? 3,
        suspicionLevel: pt.suspicion_level ?? pt.suspicionLevel ?? 3,
      },
      language: (persona?.language as string) || 'es',
      openingMessage: (persona?.opening_message as string) || 'Hola, sigue disponible?',
      behaviorRules: (persona?.behavior_rules as Record<string, unknown>) || {},
      difficulty: (persona?.difficulty as number) || 3,
    };

    this.marketConfig = {
      countryCode: (market?.country_code as string) || 'ES',
      countryName: (market?.country_name as string) || 'Spain',
      language: (market?.language as string) || 'es',
      currency: (market?.currency as string) || 'EUR',
      avgPriceRatio: Number(market?.avg_price_ratio) || 1.0,
      meetupPreference: (market?.meetup_preference as string) || 'avoid',
      shippingSupported: market?.shipping_supported !== false,
      codSupported: market?.cod_supported !== false,
    };

    this.productType = (scenario.product_type as string) || 'iPhone 14 Pro 256GB';
    this.productCondition = (scenario.product_condition as string) || 'used';
    this.listedPrice = Number(scenario.listed_price) || 650;
    this.sopChecklist = (scenario.sop_checklist as Array<{ step: string; required: boolean }>) || [];
    this.userId = params.userId;
    this.memory = createInitialMemory();

    // Create training record
    const { data: training, error } = await client
      .from('training_history')
      .insert({
        user_id: params.userId,
        scenario_id: (scenario.id as string) || null,
        case_id: params.caseId || null,
        mode: params.mode,
        status: 'active',
        buyer_persona_id: this.buyerPersona.id,
        market_config_id: (market?.id as string) || null,
        current_state: 'INITIAL',
      })
      .select('id')
      .single();
    if (error) throw new Error(`Failed to create training: ${error.message}`);

    this.id = training.id;

    // Generate first buyer message
    const buyerSystemPrompt = buildPrompt('buyer', {
      buyerPersona: this.buyerPersona,
      marketConfig: this.marketConfig,
      productType: this.productType,
      productCondition: this.productCondition,
      listedPrice: this.listedPrice,
      currentState: 'INITIAL',
      buyerMemory: this.memory,
      language: this.buyerPersona.language,
    });

    const firstMessage = await this.llm.invoke(
      [
        { role: 'system', content: buyerSystemPrompt },
        { role: 'user', content: `Generate your opening message as a buyer on Facebook Marketplace. You are interested in the ${this.productType} listed at ${this.marketConfig.currency}${this.listedPrice}. Keep it short and natural in ${this.buyerPersona.language}.` },
      ],
      { overrides: { temperature: 0.9 } }
    );

    // Save buyer's first message
    this.messageCounter++;
    await client.from('chat_message').insert({
      training_id: this.id,
      role: 'buyer',
      content: firstMessage.trim(),
      language: this.buyerPersona.language,
      message_order: this.messageCounter,
    });

    return { id: this.id, buyerGreeting: firstMessage.trim() };
  }

  loadState(state: LoadedState): void {
    this.id = state.id;
    this.messageCounter = state.currentTurn;
    this.currentState = (state.currentState as ConversationState) || 'INITIAL';
    this.deductions = state.deductions || [];
    this.scoreSignals = state.scoreSignals || {};

    if (state.memory) {
      this.memory = state.memory as unknown as BuyerMemory;
    }

    const persona = state.buyerPersona;
    if (persona) {
      const pt = (persona.personality_traits as Record<string, number>) || {};
      this.buyerPersona = {
        id: (persona.id as string) || '',
        name: (persona.name as string) || 'Buyer',
        personalityTraits: {
          aggressiveness: pt.aggressiveness ?? 3,
          patience: pt.patience ?? 3,
          suspicionLevel: pt.suspicion_level ?? pt.suspicionLevel ?? 3,
        },
        language: (persona.language as string) || 'es',
        openingMessage: (persona.opening_message as string) || '',
        behaviorRules: (persona.behavior_rules as Record<string, unknown>) || {},
        difficulty: (persona.difficulty as number) || 3,
      };
    }

    const market = state.marketConfig;
    if (market) {
      this.marketConfig = {
        countryCode: (market.country_code as string) || 'ES',
        countryName: (market.country_name as string) || 'Spain',
        language: (market.language as string) || 'es',
        currency: (market.currency as string) || 'EUR',
        avgPriceRatio: Number(market.avg_price_ratio) || 1.0,
        meetupPreference: (market.meetup_preference as string) || 'avoid',
        shippingSupported: market.shipping_supported !== false,
        codSupported: market.cod_supported !== false,
      };
    }

    const scenario = state.scenarioConfig;
    if (scenario) {
      this.productType = (scenario.product_type as string) || 'iPhone 14 Pro 256GB';
      this.productCondition = (scenario.product_condition as string) || 'used';
      this.listedPrice = Number(scenario.listed_price) || 650;
      this.sopChecklist = (scenario.sop_checklist as Array<{ step: string; required: boolean }>) || [];
    }

    // Rebuild messages from history
    this.messages = (state.conversationHistory || []).map((m) => ({
      id: m.id as string,
      trainingId: (m.training_id as string) || this.id,
      role: m.role as ChatMessage['role'],
      content: m.content as string,
      language: (m.language as string) || 'es',
      messageOrder: m.message_order as number,
      createdAt: new Date(m.created_at as string),
    }));
  }

  async processMessage(sellerMessage: string): Promise<{
    buyerResponse: string;
    deductions: Array<{ reason: string; points: number; dimension: string }>;
    scoreSignals: Record<string, unknown>;
    state: ConversationState;
    isFlagged: boolean;
  }> {
    // Score the seller message
    const scoringResult = scoreMessage(
      sellerMessage,
      this.messageCounter + 1,
      this.currentState,
      this.memory,
      this.messages
    );

    this.memory = scoringResult.updatedMemory;
    this.deductions = [...this.deductions, ...scoringResult.deductions.map(d => ({
      reason: d.reason,
      points: d.points,
      dimension: d.dimension,
    }))];

    for (const [key, value] of Object.entries(scoringResult.signals)) {
      this.scoreSignals[key] = value as unknown;
    }

    // Detect state transition
    const lastBuyerMsg = this.messages.filter(m => m.role === 'buyer').pop();
    const newState = detectStateTransition(
      this.currentState,
      lastBuyerMsg?.content || '',
      sellerMessage,
      this.memory,
      this.messages
    );
    this.currentState = newState;

    // Generate buyer reply
    let buyerReply: string;
    if (this.currentState === 'COMPLETED' || this.currentState === 'GHOSTED') {
      buyerReply = this.currentState === 'COMPLETED'
        ? 'Perfect! Deal done. Thanks!'
        : '...';
    } else {
      const buyerSystemPrompt = buildPrompt('buyer', {
        buyerPersona: this.buyerPersona!,
        marketConfig: this.marketConfig!,
        productType: this.productType,
        productCondition: this.productCondition,
        listedPrice: this.listedPrice,
        currentState: this.currentState,
        buyerMemory: this.memory,
        conversationHistory: this.messages,
        language: this.buyerPersona!.language,
      });

      const conversationForPrompt = this.messages.map(m => ({
        role: m.role,
        content: m.content,
      }));

      const buyerUserPrompt = buildBuyerUserMessage(
        conversationForPrompt,
        this.currentState,
        this.memory
      );

      buyerReply = await this.llm.invoke(
        [
          { role: 'system', content: buyerSystemPrompt },
          { role: 'user', content: buyerUserPrompt },
        ],
        { overrides: { temperature: 0.85 } }
      );
      buyerReply = buyerReply.trim();
    }

    return {
      buyerResponse: buyerReply,
      deductions: scoringResult.deductions.map(d => ({
        reason: d.reason,
        points: d.points,
        dimension: d.dimension,
      })),
      scoreSignals: scoringResult.signals as unknown as Record<string, unknown>,
      state: this.currentState,
      isFlagged: scoringResult.deductions.some(d => d.severity === 'severe'),
    };
  }

  async generateCoachReview(): Promise<{
    totalScore: number;
    ruleScore: number;
    aiScore: number;
    bonusScore: number;
    issues: CoachIssue[];
    examples: CoachExample[];
    summary: string;
    weaknesses: string[];
    scoreBreakdown: Record<string, { score: number; max: number }>;
  }> {
    const finalScore = calculateFinalScore(this.messages, this.sopChecklist);

    const conversationText = this.messages
      .map(m => `Message #${m.messageOrder} (${m.role}): ${m.content}`)
      .join('\n');

    const coachPrompt = buildPrompt('coach', {});

    const coachResponse = await this.llm.invokeJSON<{
      issues: CoachIssue[];
      examples: CoachExample[];
      totalReview: string;
      strengths: string[];
      scoreBreakdown: Record<string, { score: number; max: number }>;
    }>(
      [
        { role: 'system', content: coachPrompt },
        {
          role: 'user',
          content: `Analyze this training conversation:\n\nProduct: ${this.productType} (${this.productCondition})\nListed Price: ${this.marketConfig?.currency}${this.listedPrice}\nBuyer Type: ${this.buyerPersona?.name}\nMarket: ${this.marketConfig?.countryName}\n\n${conversationText}\n\nProvide your coaching review as JSON.`,
        },
      ],
      { preset: 'coach-review', overrides: { temperature: 0.4 } }
    );

    return {
      totalScore: finalScore.total,
      ruleScore: finalScore.ruleScore,
      aiScore: finalScore.aiScore,
      bonusScore: finalScore.bonus,
      issues: coachResponse.issues || [],
      examples: coachResponse.examples || [],
      summary: coachResponse.totalReview || 'Review unavailable',
      weaknesses: finalScore.weaknesses,
      scoreBreakdown: coachResponse.scoreBreakdown || finalScore.breakdown,
    };
  }

  getCurrentState(): ConversationState {
    return this.currentState;
  }

  getMemory(): BuyerMemory {
    return this.memory;
  }

  getDeductions(): Array<{ reason: string; points: number; dimension: string }> {
    return this.deductions;
  }

  getScoreSignals(): Record<string, unknown> {
    return this.scoreSignals;
  }
}
