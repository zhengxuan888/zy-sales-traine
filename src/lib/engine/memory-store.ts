// =============================================
// Buyer Memory Store - Agnai Memory Books 5-Stage Algorithm
// Stage 1: Enablement filtering
// Stage 2: Keyword regex matching
// Stage 3: Priority sorting
// Stage 4: Token budget trimming
// Stage 5: Weight sorting
//
// Prevents context overflow while maintaining relevant memories
// =============================================

import type { BuyerMemory, TrustStatus, ChatMessage, MessageRole, ConversationState } from './types';

// --- Memory Entry Types ---

export interface MemoryEntry {
  /** Unique key */
  key: string;
  /** Category of memory */
  category: MemoryCategory;
  /** The actual memory content */
  content: string;
  /** Regex patterns that trigger this memory */
  triggers: RegExp[];
  /** Priority (higher = more important) */
  priority: number;
  /** Weight (for final sorting) */
  weight: number;
  /** Whether this memory is currently active */
  enabled: boolean;
  /** Last accessed turn */
  lastAccessed: number;
  /** Access count */
  accessCount: number;
  /** Estimated tokens */
  tokenEstimate: number;
}

export type MemoryCategory =
  | 'product_info'       // Product details confirmed
  | 'buyer_personality'  // Buyer's personality traits observed
  | 'trust_status'       // Current trust levels
  | 'price_discussion'   // Price negotiation state
  | 'logistics'          // Shipping/meetup info
  | 'stuck_point'        // Where the conversation is blocked
  | 'key_moment'         // Important conversation moments
  | 'seller_behavior';   // Seller's behavior patterns

// --- Memory Book Configuration ---

export interface MemoryBookConfig {
  /** Max tokens for memory injection */
  maxTokenBudget: number;
  /** Max number of entries to inject */
  maxEntries: number;
  /** Minimum priority to consider */
  minPriority: number;
  /** Decay factor for old memories (per turn) */
  decayFactor: number;
  /** Boost factor for recently accessed memories */
  recencyBoost: number;
}

const DEFAULT_CONFIG: MemoryBookConfig = {
  maxTokenBudget: 500,
  maxEntries: 12,
  minPriority: 1,
  decayFactor: 0.95,
  recencyBoost: 1.2,
};

// --- Core Memory Store ---

export function createInitialMemory(): BuyerMemory {
  const emptyTrust = (): TrustStatus => ({
    level: 0,
    confirmed: false,
    details: [],
  });

  return {
    productAuthenticity: emptyTrust(),
    logisticsReliability: emptyTrust(),
    personalChatAuth: emptyTrust(),
    priceSatisfaction: emptyTrust(),
    conditionClarity: emptyTrust(),
    sellerCredibility: emptyTrust(),
    overallTrust: 20,
    purchaseIntent: 30,
    mood: 'neutral',
  };
}

// --- 5-Stage Algorithm ---

/**
 * Stage 1: Enablement Filtering
 * Only include memories that are currently active/enabled
 */
function stage1_enablementFilter(
  entries: MemoryEntry[],
  _state: ConversationState
): MemoryEntry[] {
  return entries.filter(e => e.enabled);
}

/**
 * Stage 2: Keyword Regex Matching
 * Match memories against current conversation context
 */
function stage2_keywordMatch(
  entries: MemoryEntry[],
  recentMessages: ChatMessage[],
  currentState: ConversationState
): MemoryEntry[] {
  const contextText = recentMessages.map(m => m.content).join(' ').toLowerCase();

  return entries.map(entry => {
    let matches = 0;
    for (const trigger of entry.triggers) {
      if (trigger.test(contextText)) {
        matches++;
      }
    }

    // State-based relevance boost
    const stateRelevance = getStateRelevance(entry.category, currentState);

    return {
      ...entry,
      weight: entry.weight * (1 + matches * 0.3) * stateRelevance,
      lastAccessed: matches > 0 ? recentMessages.length : entry.lastAccessed,
      accessCount: entry.accessCount + matches,
    };
  }).filter(e => e.weight > 0.1); // Filter out zero-relevance
}

/**
 * Stage 3: Priority Sorting
 * Sort by priority (descending), then by weight
 */
function stage3_prioritySort(entries: MemoryEntry[]): MemoryEntry[] {
  return [...entries].sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    return b.weight - a.weight;
  });
}

/**
 * Stage 4: Token Budget Trimming
 * Fit memories within token budget, dropping lowest-priority first
 */
function stage4_tokenTrim(
  entries: MemoryEntry[],
  config: MemoryBookConfig
): MemoryEntry[] {
  const result: MemoryEntry[] = [];
  let totalTokens = 0;

  for (const entry of entries) {
    if (result.length >= config.maxEntries) break;
    if (totalTokens + entry.tokenEstimate > config.maxTokenBudget) continue;

    result.push(entry);
    totalTokens += entry.tokenEstimate;
  }

  return result;
}

/**
 * Stage 5: Weight Sorting (Final Order)
 * Final sort by computed weight for injection order
 */
function stage5_weightSort(entries: MemoryEntry[]): MemoryEntry[] {
  return [...entries].sort((a, b) => b.weight - a.weight);
}

/**
 * Full 5-stage pipeline: process memories for injection into prompt
 */
export function processMemoryBook(
  entries: MemoryEntry[],
  recentMessages: ChatMessage[],
  currentState: ConversationState,
  config: MemoryBookConfig = DEFAULT_CONFIG
): MemoryEntry[] {
  let result = entries;

  // Stage 1: Filter enabled
  result = stage1_enablementFilter(result, currentState);

  // Stage 2: Match keywords
  result = stage2_keywordMatch(result, recentMessages, currentState);

  // Stage 3: Priority sort
  result = stage3_prioritySort(result);

  // Stage 4: Token trim
  result = stage4_tokenTrim(result, config);

  // Stage 5: Final weight sort
  result = stage5_weightSort(result);

  return result;
}

// --- Helper Functions ---

function getStateRelevance(category: MemoryCategory, state: ConversationState): number {
  const relevanceMap: Record<ConversationState, Partial<Record<MemoryCategory, number>>> = {
    INITIAL: { buyer_personality: 1.3, product_info: 1.1 },
    INQUIRING: { product_info: 1.5, trust_status: 1.3 },
    NEGOTIATING: { price_discussion: 1.5, buyer_personality: 1.2 },
    TRUST_BUILDING: { trust_status: 1.5, seller_behavior: 1.3 },
    LOGISTICS: { logistics: 1.5, trust_status: 1.2 },
    CLOSING: { price_discussion: 1.3, logistics: 1.2, trust_status: 1.1 },
    RESISTANT: { stuck_point: 1.5, buyer_personality: 1.3 },
    GHOSTED: { stuck_point: 1.4, key_moment: 1.2 },
    COMPLETED: {},
  };

  return relevanceMap[state]?.[category] ?? 1.0;
}

/**
 * Estimate token count for a string (rough: 1 token ≈ 4 chars for English, 2 for CJK)
 */
function estimateTokens(text: string): number {
  const cjkChars = (text.match(/[\u4e00-\u9fff\u3000-\u303f\uff00-\uffef]/g) || []).length;
  const otherChars = text.length - cjkChars;
  return Math.ceil(cjkChars / 2 + otherChars / 4);
}

// --- Memory Entry Builders ---

/**
 * Create a memory entry from trust status
 */
export function trustToMemoryEntry(memory: BuyerMemory, key: string, trust: TrustStatus, category: MemoryCategory): MemoryEntry {
  const content = trust.confirmed
    ? `${key}: CONFIRMED`
    : `${key}: ${trust.level}%`;

  return {
    key: `trust_${key}`,
    category,
    content,
    triggers: [new RegExp(key.replace(/_/g, ' '), 'i')],
    priority: trust.confirmed ? 5 : 3,
    weight: trust.level / 100,
    enabled: true,
    lastAccessed: 0,
    accessCount: 0,
    tokenEstimate: estimateTokens(content),
  };
}

/**
 * Build memory entries from current buyer memory state
 */
export function buildMemoryEntries(memory: BuyerMemory, currentTurn: number): MemoryEntry[] {
  const entries: MemoryEntry[] = [];

  // Trust status entries
  entries.push(trustToMemoryEntry(memory, 'product_authenticity', memory.productAuthenticity, 'trust_status'));
  entries.push(trustToMemoryEntry(memory, 'condition_clarity', memory.conditionClarity, 'trust_status'));
  entries.push(trustToMemoryEntry(memory, 'logistics_reliability', memory.logisticsReliability, 'trust_status'));
  entries.push(trustToMemoryEntry(memory, 'seller_credibility', memory.sellerCredibility, 'trust_status'));
  entries.push(trustToMemoryEntry(memory, 'personal_chat', memory.personalChatAuth, 'trust_status'));
  entries.push(trustToMemoryEntry(memory, 'price_satisfaction', memory.priceSatisfaction, 'trust_status'));

  // Overall state
  entries.push({
    key: 'overall_trust',
    category: 'trust_status',
    content: `Overall trust: ${memory.overallTrust}%, Purchase intent: ${memory.purchaseIntent}%, Mood: ${memory.mood}`,
    triggers: [/trust|intent|mood|buy|purchase/i],
    priority: 4,
    weight: memory.overallTrust / 100,
    enabled: true,
    lastAccessed: currentTurn,
    accessCount: currentTurn,
    tokenEstimate: 20,
  });

  // Stuck point detection
  if (memory.mood === 'suspicious' || memory.mood === 'frustrated') {
    entries.push({
      key: 'stuck_point',
      category: 'stuck_point',
      content: `Buyer is ${memory.mood}. Trust is low (${memory.overallTrust}%). Need to address concerns before proceeding.`,
      triggers: [/stuck|blocked|issue|problem|concern/i],
      priority: 5,
      weight: 0.9,
      enabled: true,
      lastAccessed: currentTurn,
      accessCount: 1,
      tokenEstimate: 25,
    });
  }

  return entries;
}

/**
 * Format processed memory entries into a prompt-ready string
 */
export function formatMemoryForPrompt(entries: MemoryEntry[]): string {
  if (entries.length === 0) return '';

  const lines = entries.map(e => `- ${e.content}`);
  return `[Buyer Memory]\n${lines.join('\n')}`;
}

// --- Trust Update Logic (existing, enhanced) ---

const TRUST_SEQUENCE = ['productAuthenticity', 'conditionClarity', 'logisticsReliability', 'sellerCredibility', 'personalChatAuth', 'priceSatisfaction'] as const;

export function updateMemory(
  memory: BuyerMemory,
  sellerMessage: string,
  buyerMessage: string,
  messageHistory: ChatMessage[]
): BuyerMemory {
  const updated = { ...memory };
  const sellerMsg = sellerMessage.toLowerCase();
  const buyerMsg = buyerMessage.toLowerCase();

  // 1. Product Authenticity signals
  if (/original|genuine|authentic|real|nuevo|originalny|prawdziwy|oryginal/i.test(sellerMsg)) {
    updated.productAuthenticity = boostTrust(updated.productAuthenticity, 15, 'Seller claims product is authentic');
  }
  if (/battery.*\d+%|bater[ií]a.*\d+%|bateria.*\d+%|health.*\d+/i.test(sellerMsg)) {
    updated.productAuthenticity = boostTrust(updated.productAuthenticity, 20, 'Seller provided specific battery health');
  }
  if (/never repaired|no reparad|nigdy nie naprawian|sem reparo/i.test(sellerMsg)) {
    updated.productAuthenticity = boostTrust(updated.productAuthenticity, 15, 'Seller confirmed no repairs');
  }

  // 2. Condition Clarity signals
  if (/scratches?|damage|defect|ara[nñ]a|rysa|poškozen/i.test(sellerMsg)) {
    updated.conditionClarity = boostTrust(updated.conditionClarity, 10, 'Seller is honest about condition');
  }
  if (/\d+\s*gb|storage|almacenamiento|pam[iě]ť/i.test(sellerMsg)) {
    updated.conditionClarity = boostTrust(updated.conditionClarity, 10, 'Seller provided storage info');
  }
  if (/model|year|a[ñn]o|rok|version|versi[oó]n/i.test(sellerMsg)) {
    updated.conditionClarity = boostTrust(updated.conditionClarity, 10, 'Seller provided model/year info');
  }

  // 3. Logistics Reliability signals
  if (/cod|cash.*delivery|contrareembolso|za pobraniem|pagamento.*entrega/i.test(sellerMsg)) {
    updated.logisticsReliability = boostTrust(updated.logisticsReliability, 20, 'Seller offers COD payment');
  }
  if (/ship|env[ií]o|wysy[lł]|dostaw|entrega|envio/i.test(sellerMsg) &&
      !/meet|pickup|recoger|osobist/i.test(sellerMsg)) {
    updated.logisticsReliability = boostTrust(updated.logisticsReliability, 10, 'Seller offers shipping');
  }
  if (/tracking|seguimiento|[sś]ledzenie|rastreamento/i.test(sellerMsg)) {
    updated.logisticsReliability = boostTrust(updated.logisticsReliability, 10, 'Seller mentions tracking');
  }

  // 4. Seller Credibility signals
  if (/i travel|i.*m.*abroad|estoy en el extranjero|jestem za granic/i.test(sellerMsg)) {
    updated.sellerCredibility = boostTrust(updated.sellerCredibility, 10, 'Seller provides plausible reason for shipping');
  }

  // 5. Personal Chat Authenticity signals
  if (/emoji|haha|lol|jaja|rsrs/i.test(sellerMsg)) {
    updated.personalChatAuth = boostTrust(updated.personalChatAuth, 5, 'Seller uses casual language');
  }
  if (/you.*welcome|de nada|prosz[ię]|obrigado|parakal[oó]/i.test(sellerMsg) &&
      /thank|gracias|dzi[ię]k|obrigad|efcharist[oó]/i.test(buyerMsg)) {
    updated.personalChatAuth = boostTrust(updated.personalChatAuth, 10, 'Natural conversational exchange');
  }

  // 6. Price Satisfaction
  if (/discount|descuento|rabat|desconto|έκπτωση/i.test(sellerMsg) &&
      /ok|deal|perfect|vale|zgoda|ok/i.test(buyerMsg)) {
    updated.priceSatisfaction = boostTrust(updated.priceSatisfaction, 20, 'Buyer accepted price/discount');
  }
  if (/price.*fixed|precio.*fijo|cena.*sta[lł]a|pre[cç]o.*fixo/i.test(sellerMsg)) {
    updated.priceSatisfaction = boostTrust(updated.priceSatisfaction, -10, 'Seller is firm on price');
  }

  // Negative signals
  if (/hola se[nñ]or|buenos d[ií]as se[nñ]or|szanowny panie|estimad/i.test(sellerMsg)) {
    updated.personalChatAuth = boostTrust(updated.personalChatAuth, -20, 'Too formal, customer-service-like');
    updated.sellerCredibility = boostTrust(updated.sellerCredibility, -15, 'Sounds like a business, not individual');
  }

  if (/guarantee|warranty|garant[ií]a|gwarancja|garantia/i.test(sellerMsg) &&
      messageHistory.filter(m => m.role === 'seller').length < 3) {
    updated.sellerCredibility = boostTrust(updated.sellerCredibility, -10, 'Guarantee offered too early');
  }

  // Buyer mood signals
  if (/scam|fake|estafa|oszustwo|golp/i.test(buyerMsg)) {
    updated.mood = 'suspicious';
    updated.overallTrust = Math.max(0, updated.overallTrust - 15);
  } else if (/great|perfect|awesome|genial|perfecto|super|genialne/i.test(buyerMsg)) {
    updated.mood = 'happy';
    updated.overallTrust = Math.min(100, updated.overallTrust + 10);
  } else if (/whatever|never mind|no thanks|daj spok|n[aã]o obrigado|deja/i.test(buyerMsg)) {
    updated.mood = 'frustrated';
    updated.purchaseIntent = Math.max(0, updated.purchaseIntent - 20);
  }

  // Calculate overall trust
  updated.overallTrust = calculateOverallTrust(updated);
  updated.purchaseIntent = calculatePurchaseIntent(updated);

  return updated;
}

function boostTrust(status: TrustStatus, delta: number, detail: string): TrustStatus {
  const newLevel = Math.max(0, Math.min(100, status.level + delta));
  return {
    level: newLevel,
    confirmed: newLevel >= 70,
    details: [...status.details, `${delta > 0 ? '+' : ''}${delta}: ${detail}`].slice(-10),
  };
}

function calculateOverallTrust(memory: BuyerMemory): number {
  const productTrust = (memory.productAuthenticity.level + memory.conditionClarity.level) / 2;
  const logisticsTrust = memory.logisticsReliability.level;
  const personalTrust = (memory.sellerCredibility.level + memory.personalChatAuth.level) / 2;

  // Sequence enforcement
  const effectiveLogistics = Math.min(logisticsTrust, productTrust + 20);
  const effectivePersonal = Math.min(personalTrust, effectiveLogistics + 20);

  const overall = (productTrust * 0.35 + effectiveLogistics * 0.35 + effectivePersonal * 0.30);
  return Math.round(Math.max(0, Math.min(100, overall)));
}

function calculatePurchaseIntent(memory: BuyerMemory): number {
  let intent = memory.priceSatisfaction.level * 0.4 +
    memory.overallTrust * 0.3 +
    memory.conditionClarity.level * 0.15 +
    memory.logisticsReliability.level * 0.15;

  if (memory.mood === 'happy') intent += 10;
  if (memory.mood === 'suspicious') intent -= 15;
  if (memory.mood === 'frustrated') intent -= 25;

  return Math.round(Math.max(0, Math.min(100, intent)));
}

export function getMemorySummary(memory: BuyerMemory): string {
  const parts: string[] = [];

  if (memory.productAuthenticity.confirmed) parts.push('Product authenticity: confirmed');
  else parts.push(`Product authenticity: ${memory.productAuthenticity.level}%`);

  if (memory.conditionClarity.confirmed) parts.push('Condition clarity: confirmed');
  else parts.push(`Condition clarity: ${memory.conditionClarity.level}%`);

  if (memory.logisticsReliability.confirmed) parts.push('Logistics trust: confirmed');
  else parts.push(`Logistics trust: ${memory.logisticsReliability.level}%`);

  parts.push(`Overall trust: ${memory.overallTrust}%`);
  parts.push(`Purchase intent: ${memory.purchaseIntent}%`);
  parts.push(`Mood: ${memory.mood}`);

  return parts.join(' | ');
}

/**
 * Get trust sequence status - shows which trust stages are complete
 */
export function getTrustSequenceStatus(memory: BuyerMemory): {
  stage: string;
  status: 'confirmed' | 'building' | 'not_started';
  level: number;
}[] {
  return TRUST_SEQUENCE.map(key => {
    const trust = memory[key];
    let status: 'confirmed' | 'building' | 'not_started';
    if (trust.confirmed) status = 'confirmed';
    else if (trust.level > 0) status = 'building';
    else status = 'not_started';

    return {
      stage: key,
      status,
      level: trust.level,
    };
  });
}
