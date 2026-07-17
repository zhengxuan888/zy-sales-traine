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

// =============================================
// BotSIM-style 3-Layer Health Report
// Layer 1: Goal Completion Rate
// Layer 2: Error Rate (by category)
// Layer 3: Dialog Turns & Agenda Backtracking
// =============================================

/**
 * Conversation Agenda - the expected steps in a successful sale
 */
export interface ConversationAgenda {
  steps: AgendaStep[];
}

export interface AgendaStep {
  /** Step identifier */
  id: string;
  /** Display name */
  name: string;
  /** Expected state for this step */
  expectedState: string;
  /** Whether this step is required */
  required: boolean;
  /** Keywords/patterns that indicate this step was addressed */
  completionPatterns: RegExp[];
  /** Order in the conversation flow */
  order: number;
}

/**
 * Default conversation agenda for FB Marketplace sales
 */
export const DEFAULT_AGENDA: ConversationAgenda = {
  steps: [
    {
      id: 'greeting',
      name: 'Natural Greeting',
      expectedState: 'INITIAL',
      required: true,
      completionPatterns: [/^(hi|hey|hola|buenas|cześć|oi|γεια|bok|ahoj|hello|yo|sup)/i],
      order: 1,
    },
    {
      id: 'product_info',
      name: 'Product Information Provided',
      expectedState: 'INQUIRING',
      required: true,
      completionPatterns: [/\d+\s*gb|battery|bater[ií]a|screen|model|storage|condition/i],
      order: 2,
    },
    {
      id: 'authenticity',
      name: 'Product Authenticity Established',
      expectedState: 'INQUIRING',
      required: true,
      completionPatterns: [/original|genuine|authentic|real|nuevo|originalny|never repaired/i],
      order: 3,
    },
    {
      id: 'trust_building',
      name: 'Trust Building (Personal Tone)',
      expectedState: 'TRUST_BUILDING',
      required: true,
      completionPatterns: [/haha|lol|jaja|emoji|casual|friendly/i, /^(?!.*(?:sir|madam|dear customer))/i],
      order: 4,
    },
    {
      id: 'negotiation',
      name: 'Price Negotiation Handled',
      expectedState: 'NEGOTIATING',
      required: false,
      completionPatterns: [/price|precio|cena|preço|δωσ|deal|discount|descuento|rabat/i],
      order: 5,
    },
    {
      id: 'logistics',
      name: 'Logistics/Shipping Discussed',
      expectedState: 'LOGISTICS',
      required: true,
      completionPatterns: [/ship|env[ií]o|wysy[lł]|dostaw|entrega|cod|cash.*delivery|tracking/i],
      order: 6,
    },
    {
      id: 'closing',
      name: 'Sale Closed or Near-Close',
      expectedState: 'CLOSING',
      required: false,
      completionPatterns: [/deal|ok|perfect|genial|comprado|bought|sending|enviar/i],
      order: 7,
    },
  ],
};

/**
 * Layer 1: Goal Completion Rate
 * Measures what percentage of required agenda steps were completed
 */
export interface GoalCompletionResult {
  /** Overall completion rate (0-100) */
  completionRate: number;
  /** Required steps completed */
  requiredCompleted: number;
  /** Total required steps */
  requiredTotal: number;
  /** Optional steps completed */
  optionalCompleted: number;
  /** Total optional steps */
  optionalTotal: number;
  /** Per-step completion status */
  stepResults: AgendaStepResult[];
}

export interface AgendaStepResult {
  stepId: string;
  stepName: string;
  completed: boolean;
  /** Which message(s) satisfied this step */
  satisfiedBy: number[];
  /** Whether this step was required */
  required: boolean;
}

export function evaluateGoalCompletion(
  history: ChatMessage[],
  agenda: ConversationAgenda = DEFAULT_AGENDA
): GoalCompletionResult {
  const sellerMessages = history.filter(m => m.role === 'seller');
  const stepResults: AgendaStepResult[] = [];

  for (const step of agenda.steps) {
    const satisfiedBy: number[] = [];

    for (const msg of sellerMessages) {
      for (const pattern of step.completionPatterns) {
        if (pattern.test(msg.content)) {
          satisfiedBy.push(msg.messageOrder);
          break;
        }
      }
    }

    stepResults.push({
      stepId: step.id,
      stepName: step.name,
      completed: satisfiedBy.length > 0,
      satisfiedBy,
      required: step.required,
    });
  }

  const requiredSteps = stepResults.filter(s => s.required);
  const optionalSteps = stepResults.filter(s => !s.required);

  const requiredCompleted = requiredSteps.filter(s => s.completed).length;
  const optionalCompleted = optionalSteps.filter(s => s.completed).length;

  // Completion rate: required steps weighted 70%, optional 30%
  const requiredRate = requiredSteps.length > 0 ? requiredCompleted / requiredSteps.length : 1;
  const optionalRate = optionalSteps.length > 0 ? optionalCompleted / optionalSteps.length : 0;
  const completionRate = Math.round((requiredRate * 0.7 + optionalRate * 0.3) * 100);

  return {
    completionRate,
    requiredCompleted,
    requiredTotal: requiredSteps.length,
    optionalCompleted,
    optionalTotal: optionalSteps.length,
    stepResults,
  };
}

/**
 * Layer 2: Error Rate by Category
 * Categorizes and counts errors from deductions
 */
export interface ErrorRateResult {
  /** Total errors */
  totalErrors: number;
  /** Error rate (errors per seller message) */
  errorRate: number;
  /** Errors grouped by category */
  byCategory: Record<string, CategoryErrorCount>;
  /** Severity distribution */
  bySeverity: Record<string, number>;
  /** Top 3 most frequent errors */
  topErrors: Array<{ reason: string; count: number; dimension: string }>;
}

export interface CategoryErrorCount {
  count: number;
  totalPoints: number;
  messages: number[];
}

export function evaluateErrorRate(
  history: ChatMessage[],
  deductions: DeductionPoint[]
): ErrorRateResult {
  const sellerMsgCount = history.filter(m => m.role === 'seller').length;
  const byCategory: Record<string, CategoryErrorCount> = {};
  const bySeverity: Record<string, number> = {};
  const errorCounts: Record<string, { count: number; dimension: string }> = {};

  for (const d of deductions) {
    // By category
    if (!byCategory[d.dimension]) {
      byCategory[d.dimension] = { count: 0, totalPoints: 0, messages: [] };
    }
    byCategory[d.dimension].count++;
    byCategory[d.dimension].totalPoints += d.points;
    byCategory[d.dimension].messages.push(d.messageRef ?? 0);

    // By severity
    bySeverity[d.severity] = (bySeverity[d.severity] || 0) + 1;

    // Error frequency
    const key = d.reason.substring(0, 50);
    if (!errorCounts[key]) {
      errorCounts[key] = { count: 0, dimension: d.dimension };
    }
    errorCounts[key].count++;
  }

  const topErrors = Object.entries(errorCounts)
    .map(([reason, data]) => ({ reason, count: data.count, dimension: data.dimension }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);

  return {
    totalErrors: deductions.length,
    errorRate: sellerMsgCount > 0 ? Math.round((deductions.length / sellerMsgCount) * 100) / 100 : 0,
    byCategory,
    bySeverity,
    topErrors,
  };
}

/**
 * Layer 3: Dialog Turns Analysis
 * Analyzes conversation efficiency and flow
 */
export interface DialogTurnResult {
  /** Total dialog turns (pairs of buyer+seller messages) */
  totalTurns: number;
  /** Total seller messages */
  sellerMessages: number;
  /** Total buyer messages */
  buyerMessages: number;
  /** Average seller message length */
  avgSellerLength: number;
  /** Average buyer message length */
  avgBuyerLength: number;
  /** Turns to reach each agenda step */
  turnsToStep: Record<string, number>;
  /** Conversation efficiency (0-100, higher = fewer turns to complete goals) */
  efficiency: number;
}

export function evaluateDialogTurns(
  history: ChatMessage[],
  goalResult: GoalCompletionResult
): DialogTurnResult {
  const sellerMsgs = history.filter(m => m.role === 'seller');
  const buyerMsgs = history.filter(m => m.role === 'buyer');
  const totalTurns = Math.max(sellerMsgs.length, buyerMsgs.length);

  const avgSellerLength = sellerMsgs.length > 0
    ? Math.round(sellerMsgs.reduce((sum, m) => sum + m.content.length, 0) / sellerMsgs.length)
    : 0;

  const avgBuyerLength = buyerMsgs.length > 0
    ? Math.round(buyerMsgs.reduce((sum, m) => sum + m.content.length, 0) / buyerMsgs.length)
    : 0;

  // Turns to reach each completed step
  const turnsToStep: Record<string, number> = {};
  for (const step of goalResult.stepResults) {
    if (step.completed && step.satisfiedBy.length > 0) {
      turnsToStep[step.stepId] = step.satisfiedBy[0];
    }
  }

  // Efficiency: based on how quickly goals were achieved
  const completedSteps = goalResult.stepResults.filter(s => s.completed);
  const avgTurnsToComplete = completedSteps.length > 0
    ? Object.values(turnsToStep).reduce((sum, t) => sum + t, 0) / completedSteps.length
    : totalTurns;

  // Ideal: complete all required steps in ~4-5 turns
  const idealTurns = 4;
  const efficiency = Math.round(Math.max(0, Math.min(100,
    100 - Math.max(0, (avgTurnsToComplete - idealTurns) * 15)
  )));

  return {
    totalTurns,
    sellerMessages: sellerMsgs.length,
    buyerMessages: buyerMsgs.length,
    avgSellerLength,
    avgBuyerLength,
    turnsToStep,
    efficiency,
  };
}

/**
 * Agenda Backtracking - Locate "which step went wrong"
 * Traces back through the conversation to find the first missed/failed step
 */
export interface BacktrackResult {
  /** The step where things went wrong */
  failurePoint: string | null;
  /** Description of what went wrong */
  failureDescription: string | null;
  /** Message number where the issue started */
  failureMessageRef: number | null;
  /** Suggested fix */
  suggestedFix: string | null;
  /** Full trace of agenda progress */
  trace: Array<{
    stepId: string;
    stepName: string;
    status: 'completed' | 'missed' | 'skipped' | 'pending';
    messageRef: number | null;
  }>;
}

export function backtrackAgenda(
  history: ChatMessage[],
  goalResult: GoalCompletionResult,
  errorResult: ErrorRateResult
): BacktrackResult {
  const trace: BacktrackResult['trace'] = [];
  let failurePoint: string | null = null;
  let failureDescription: string | null = null;
  let failureMessageRef: number | null = null;

  // Build trace
  for (const step of goalResult.stepResults) {
    if (step.completed) {
      trace.push({
        stepId: step.stepId,
        stepName: step.stepName,
        status: 'completed',
        messageRef: step.satisfiedBy[0] || null,
      });
    } else if (step.required) {
      // Find where this step should have been addressed
      const prevCompleted = trace.filter(t => t.status === 'completed');
      const lastMsgRef = prevCompleted.length > 0
        ? prevCompleted[prevCompleted.length - 1].messageRef || 0
        : 0;

      // Check if there were errors around where this step should have been
      const relevantErrors = Object.entries(errorResult.byCategory)
        .filter(([dim]) => {
          const dimToStep: Record<string, string> = {
            productInfo: 'product_info',
            trustBuilding: 'trust_building',
            logistics: 'logistics',
            greeting: 'greeting',
            negotiation: 'negotiation',
            closing: 'closing',
          };
          return dimToStep[dim] === step.stepId;
        });

      if (relevantErrors.length > 0) {
        trace.push({
          stepId: step.stepId,
          stepName: step.stepName,
          status: 'missed',
          messageRef: lastMsgRef + 1,
        });

        if (!failurePoint) {
          failurePoint = step.stepId;
          failureDescription = `Required step "${step.stepName}" was never completed. ${relevantErrors.map(([dim, data]) => `${dim}: ${data.count} errors`).join(', ')}`;
          failureMessageRef = lastMsgRef + 1;
        }
      } else {
        trace.push({
          stepId: step.stepId,
          stepName: step.stepName,
          status: 'skipped',
          messageRef: null,
        });

        if (!failurePoint) {
          failurePoint = step.stepId;
          failureDescription = `Required step "${step.stepName}" was skipped entirely`;
          failureMessageRef = lastMsgRef + 1;
        }
      }
    } else {
      trace.push({
        stepId: step.stepId,
        stepName: step.stepName,
        status: 'pending',
        messageRef: null,
      });
    }
  }

  // Generate suggested fix
  let suggestedFix: string | null = null;
  if (failurePoint) {
    const fixMap: Record<string, string> = {
      greeting: 'Start with a casual greeting like "Hi!" or "Hey!" instead of formal language',
      product_info: 'Provide specific product details: battery health, storage, condition, any scratches',
      authenticity: 'Confirm product is original and never repaired. Use specific details like "Battery is 92%. Never repaired."',
      trust_building: 'Use casual, friendly language. Avoid customer-service phrases like "Hello sir" or "Thank you for your inquiry"',
      negotiation: 'Handle price negotiation naturally. Don\'t give in too fast, but be reasonable',
      logistics: 'Mention COD shipping and avoid specific meetup times/places. Use "I\'m abroad for work" as reason for shipping',
      closing: 'Try to close the sale naturally. Confirm address and shipping details',
    };
    suggestedFix = fixMap[failurePoint] || `Address the "${failurePoint}" step before continuing`;
  }

  return {
    failurePoint,
    failureDescription,
    failureMessageRef,
    suggestedFix,
    trace,
  };
}

/**
 * Complete 3-Layer Health Report
 */
export interface HealthReport {
  /** Layer 1: Goal Completion */
  goalCompletion: GoalCompletionResult;
  /** Layer 2: Error Rate */
  errorRate: ErrorRateResult;
  /** Layer 3: Dialog Turns */
  dialogTurns: DialogTurnResult;
  /** Agenda Backtracking */
  backtrack: BacktrackResult;
  /** Overall health score (0-100) */
  overallHealth: number;
  /** Health grade */
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
}

export function generateHealthReport(
  history: ChatMessage[],
  deductions: DeductionPoint[],
  agenda: ConversationAgenda = DEFAULT_AGENDA
): HealthReport {
  const goalCompletion = evaluateGoalCompletion(history, agenda);
  const errorRate = evaluateErrorRate(history, deductions);
  const dialogTurns = evaluateDialogTurns(history, goalCompletion);
  const backtrack = backtrackAgenda(history, goalCompletion, errorRate);

  // Overall health: weighted combination
  const goalScore = goalCompletion.completionRate;
  const errorScore = Math.max(0, 100 - errorRate.totalErrors * 10);
  const efficiencyScore = dialogTurns.efficiency;

  const overallHealth = Math.round(
    goalScore * 0.5 +
    errorScore * 0.3 +
    efficiencyScore * 0.2
  );

  // Grade
  let grade: HealthReport['grade'];
  if (overallHealth >= 90) grade = 'A';
  else if (overallHealth >= 75) grade = 'B';
  else if (overallHealth >= 60) grade = 'C';
  else if (overallHealth >= 40) grade = 'D';
  else grade = 'F';

  return {
    goalCompletion,
    errorRate,
    dialogTurns,
    backtrack,
    overallHealth,
    grade,
  };
}
