// =============================================
// Scoring Engine
// Dual-layer scoring: Rule Score (60) + AI Score (40) + Bonus (10)
// =============================================

import type { ChatMessage, FinalScore, ScoreBreakdown, DimensionScore, DeductionPoint, ScoreSignal } from './types';
import { checkSellerMessage, checkSOP } from './rule-engine';
import { createInitialMemory, updateMemory } from './memory-store';
import type { BuyerMemory } from './types';

export interface ScoringResult {
  ruleScore: number;
  aiScore: number;
  bonus: number;
  total: number;
  breakdown: ScoreBreakdown;
  allSignals: ScoreSignal[];
  allDeductions: DeductionPoint[];
  weaknesses: string[];
  memory: BuyerMemory;
}

export function createEmptyDimension(maxScore: number): DimensionScore {
  return { score: maxScore, maxScore, deductions: [], highlights: [] };
}

export function createInitialBreakdown(): ScoreBreakdown {
  return {
    greeting: createEmptyDimension(10),
    productInfo: createEmptyDimension(15),
    trustBuilding: createEmptyDimension(15),
    negotiation: createEmptyDimension(15),
    logistics: createEmptyDimension(15),
    closing: createEmptyDimension(10),
    language: createEmptyDimension(10),
    sopCompliance: createEmptyDimension(10),
  };
}

export function scoreMessage(
  sellerMessage: string,
  messageOrder: number,
  state: string,
  memory: BuyerMemory,
  history: ChatMessage[]
): { signals: ScoreSignal[]; deductions: DeductionPoint[]; updatedMemory: BuyerMemory } {
  // Rule-based checks
  const ruleResult = checkSellerMessage(
    sellerMessage,
    messageOrder,
    state as Parameters<typeof checkSellerMessage>[2],
    memory,
    history
  );

  // Update buyer memory based on the seller's message
  const buyerReply = history[history.length - 1]?.content || '';
  const updatedMemory = updateMemory(memory, sellerMessage, buyerReply, history);

  return {
    signals: ruleResult.signals,
    deductions: ruleResult.deductions,
    updatedMemory,
  };
}

export function calculateFinalScore(
  history: ChatMessage[],
  sopChecklist?: Array<{ step: string; required: boolean }>,
  aiScoreOverride?: number,
  bonusOverride?: number
): FinalScore {
  const breakdown = createInitialBreakdown();
  let memory = createInitialMemory();
  const allDeductions: DeductionPoint[] = [];
  const allSignals: ScoreSignal[] = [];
  const dimensionMap: Record<string, keyof ScoreBreakdown> = {
    language_tone: 'language',
    conciseness: 'language',
    trust_sequence: 'trustBuilding',
    meetup_handling: 'logistics',
    payment_handling: 'logistics',
    product_info: 'productInfo',
    honesty: 'productInfo',
    greeting: 'greeting',
    negotiation: 'negotiation',
    closing: 'closing',
  };

  const sellerMessages = history.filter(m => m.role === 'seller');

  // Check greeting (first seller message)
  if (sellerMessages.length > 0) {
    const firstMsg = sellerMessages[0].content.toLowerCase();
    if (/^(hi|hey|hola|buenas|cześć|oi|γεια|bok|ahoj|hello|yo|sup)/i.test(firstMsg)) {
      breakdown.greeting.score = 10;
      breakdown.greeting.highlights.push('Natural, casual greeting');
    } else if (/^(hello\s+(sir|madam)|buenos\s+d[ií]as|szanowny|estimad)/i.test(firstMsg)) {
      breakdown.greeting.score = 3;
      breakdown.greeting.deductions.push({
        dimension: 'greeting',
        points: 7,
        reason: 'Too formal greeting. Use casual language like "Hi!" or "Hey!"',
        severity: 'moderate',
      });
    } else {
      breakdown.greeting.score = 6;
    }
  }

  // Process each seller message
  for (const msg of sellerMessages) {
    const result = checkSellerMessage(
      msg.content,
      msg.messageOrder,
      'INQUIRING' as Parameters<typeof checkSellerMessage>[2], // simplified
      memory,
      history
    );

    allSignals.push(...result.signals);
    allDeductions.push(...result.deductions);

    // Apply deductions to breakdown
    for (const deduction of result.deductions) {
      const dim = dimensionMap[deduction.dimension];
      if (dim && breakdown[dim]) {
        breakdown[dim].score = Math.max(0, breakdown[dim].score - deduction.points);
        breakdown[dim].deductions.push(deduction);
      }
    }

    // Apply positive signals
    for (const signal of result.signals) {
      if (signal.type === 'positive') {
        const dim = dimensionMap[signal.dimension];
        if (dim && breakdown[dim]) {
          breakdown[dim].highlights.push(signal.reason);
        }
      }
    }

    // Update memory
    const buyerMsg = history.find(m => m.messageOrder === msg.messageOrder - 1);
    if (buyerMsg) {
      memory = updateMemory(memory, msg.content, buyerMsg.content, history);
    }
  }

  // SOP check
  if (sopChecklist && sopChecklist.length > 0) {
    const sopResult = checkSOP(sopChecklist, history);
    const sopPassRate = sopResult.passed.length / (sopResult.passed.length + sopResult.failed.length);
    breakdown.sopCompliance.score = Math.round(sopPassRate * 10);
    if (sopResult.failed.length > 0) {
      breakdown.sopCompliance.deductions.push({
        dimension: 'sop',
        points: Math.round((1 - sopPassRate) * 10),
        reason: `Missing SOP steps: ${sopResult.failed.join(', ')}`,
        severity: 'moderate',
      });
    }
  }

  // Calculate rule score (sum of all dimensions, max 60)
  const dimensionValues = Object.values(breakdown);
  const rawRuleScore = dimensionValues.reduce((sum, d) => sum + d.score, 0);
  const ruleScore = Math.min(60, Math.round(rawRuleScore * (60 / 100)));

  // AI score (default based on overall quality heuristic, or override)
  const aiScore = aiScoreOverride ?? calculateAIHeuristicScore(history, memory);

  // Bonus
  const bonus = bonusOverride ?? calculateBonus(history, memory);

  // Identify weaknesses (bottom 3 dimensions)
  const sortedDimensions = dimensionValues
    .map((d, i) => ({ name: Object.keys(breakdown)[i], ratio: d.score / d.maxScore }))
    .sort((a, b) => a.ratio - b.ratio);
  const weaknesses = sortedDimensions.slice(0, 3).map(d => d.name);

  return {
    ruleScore,
    aiScore,
    bonus,
    total: ruleScore + aiScore + bonus,
    breakdown,
    weaknesses,
  };
}

function calculateAIHeuristicScore(history: ChatMessage[], memory: BuyerMemory): number {
  let score = 20; // base

  // Naturalness: based on average message length
  const sellerMsgs = history.filter(m => m.role === 'seller');
  if (sellerMsgs.length > 0) {
    const avgLen = sellerMsgs.reduce((sum, m) => sum + m.content.length, 0) / sellerMsgs.length;
    if (avgLen < 80) score += 8;
    else if (avgLen < 150) score += 4;
    else score -= 5;
  }

  // Effectiveness: based on buyer's purchase intent
  score += Math.round(memory.purchaseIntent / 10);

  // Adaptability: based on trust building
  score += Math.round(memory.overallTrust / 20);

  return Math.min(40, Math.max(0, score));
}

function calculateBonus(history: ChatMessage[], memory: BuyerMemory): number {
  let bonus = 0;

  // Perfect trust sequence
  if (memory.productAuthenticity.confirmed &&
      memory.logisticsReliability.confirmed &&
      memory.personalChatAuth.confirmed) {
    bonus += 5;
  }

  // High purchase intent with good trust
  if (memory.purchaseIntent > 80 && memory.overallTrust > 70) {
    bonus += 5;
  }

  return Math.min(10, bonus);
}

export function getDimensionLabel(key: string): string {
  const labels: Record<string, string> = {
    greeting: 'Greeting & First Impression',
    productInfo: 'Product Information',
    trustBuilding: 'Trust Building',
    negotiation: 'Negotiation Skills',
    logistics: 'Logistics & Shipping',
    closing: 'Closing',
    language: 'Language & Tone',
    sopCompliance: 'SOP Compliance',
  };
  return labels[key] || key;
}
