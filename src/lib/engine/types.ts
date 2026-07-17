// =============================================
// AI Training Platform - Core Type Definitions
// =============================================

// --- Conversation & Message Types ---

export type MessageRole = 'buyer' | 'seller' | 'system';

export interface ChatMessage {
  id?: string;
  trainingId: string;
  role: MessageRole;
  content: string;
  language: string;
  metadata?: Record<string, unknown>;
  scoreSignals?: ScoreSignal[];
  deductionPoints?: DeductionPoint[];
  isFlagged?: boolean;
  messageOrder: number;
  createdAt?: Date;
}

// --- State Machine Types ---

export type ConversationState =
  | 'INITIAL'         // 买家刚发消息
  | 'INQUIRING'       // 买家在询问产品信息
  | 'NEGOTIATING'     // 砍价阶段
  | 'TRUST_BUILDING'  // 建立信任
  | 'LOGISTICS'       // 讨论物流/面交
  | 'CLOSING'         // 即将成交
  | 'RESISTANT'       // 买家抗拒/犹豫
  | 'GHOSTED'         // 买家消失
  | 'COMPLETED';      // 对话结束

export interface StateConfig {
  state: ConversationState;
  allowedActions: string[];
  blockedActions: string[];
  transitions: StateTransition[];
}

export interface StateTransition {
  to: ConversationState;
  trigger: string; // condition description
}

// --- Scoring Types ---

export interface ScoreSignal {
  type: 'positive' | 'negative' | 'neutral';
  dimension: string;
  points: number;
  reason: string;
  messageRef?: number;
}

export interface DeductionPoint {
  dimension: string;
  points: number;
  reason: string;
  severity: 'minor' | 'moderate' | 'severe';
  messageRef?: number;
}

export interface ScoreBreakdown {
  greeting: DimensionScore;
  productInfo: DimensionScore;
  trustBuilding: DimensionScore;
  negotiation: DimensionScore;
  logistics: DimensionScore;
  closing: DimensionScore;
  language: DimensionScore;
  sopCompliance: DimensionScore;
}

export interface DimensionScore {
  score: number;
  maxScore: number;
  deductions: DeductionPoint[];
  highlights: string[];
}

export interface FinalScore {
  ruleScore: number;      // 0-60
  aiScore: number;        // 0-40
  bonus: number;          // 0-10
  total: number;          // 0-110
  breakdown: ScoreBreakdown;
  weaknesses: string[];
}

// --- Buyer Memory Types ---

export interface BuyerMemory {
  // 6 types of information confirmation
  productAuthenticity: TrustStatus;
  logisticsReliability: TrustStatus;
  personalChatAuth: TrustStatus;
  priceSatisfaction: TrustStatus;
  conditionClarity: TrustStatus;
  sellerCredibility: TrustStatus;
  // Overall
  overallTrust: number;   // 0-100
  purchaseIntent: number; // 0-100
  mood: 'positive' | 'neutral' | 'suspicious' | 'frustrated' | 'happy';
}

export interface TrustStatus {
  level: number;          // 0-100
  confirmed: boolean;
  details: string[];
}

// --- Prompt Types ---

export type PromptType = 'buyer' | 'coach' | 'judge';

export interface PromptContext {
  buyerPersona?: BuyerPersonaConfig;
  marketConfig?: MarketConfigData;
  productType?: string;
  productCondition?: string;
  listedPrice?: number;
  currentState?: ConversationState;
  allowedActions?: string[];
  blockedActions?: string[];
  buyerMemory?: BuyerMemory;
  conversationHistory?: ChatMessage[];
  language?: string;
}

export interface BuyerPersonaConfig {
  id: string;
  name: string;
  personalityTraits: {
    aggressiveness: number;
    patience: number;
    suspicionLevel: number;
  };
  language: string;
  openingMessage: string;
  behaviorRules: Record<string, unknown>;
  difficulty: number;
}

export interface MarketConfigData {
  countryCode: string;
  countryName: string;
  language: string;
  currency: string;
  avgPriceRatio: number;
  meetupPreference: string;
  shippingSupported: boolean;
  codSupported: boolean;
}

// --- Training Session Types ---

export interface TrainingSession {
  id: string;
  userId: string;
  scenarioId?: string;
  caseId?: string;
  mode: 'free_training' | 'case_practice' | 'wrong_retry';
  status: 'active' | 'paused' | 'completed' | 'abandoned';
  buyerPersonaId: string;
  totalMessages: number;
  durationSeconds: number;
  finalScore?: number;
  ruleScore?: number;
  aiScore?: number;
  bonusScore?: number;
  scoreBreakdown?: ScoreBreakdown;
  weaknesses?: string[];
  coachReview?: string;
  coachIssues?: CoachIssue[];
  coachExamples?: CoachExample[];
  startedAt: Date;
  completedAt?: Date;
}

export interface CoachIssue {
  id: number;
  messageRef: number;
  dimension: string;
  problem: string;
  severity: 'minor' | 'moderate' | 'severe';
  suggestion: string;
}

export interface CoachExample {
  scenario: string;
  badResponse: string;
  goodResponse: string;
  explanation: string;
}

// --- Case Types ---

export interface CaseData {
  id: string;
  title: string;
  description?: string;
  source: string;
  conversationData: ConversationTurn[];
  keyMoments?: KeyMoment[];
  bestResponses?: BestResponse[];
  difficulty: number;
  tags?: string[];
}

export interface ConversationTurn {
  role: MessageRole;
  content: string;
  timestamp?: string;
  note?: string;
}

export interface KeyMoment {
  messageIndex: number;
  type: 'critical' | 'opportunity' | 'risk';
  description: string;
}

export interface BestResponse {
  messageIndex: number;
  idealResponse: string;
  why: string;
}

// --- API Request/Response Types ---

export interface StartTrainingRequest {
  userId: string;
  scenarioId?: string;
  caseId?: string;
  mode: 'free_training' | 'case_practice' | 'wrong_retry';
  buyerPersonaId?: string;
}

export interface StartTrainingResponse {
  success: boolean;
  trainingId: string;
  firstMessage: string;
  buyerPersona: string;
  scenario: string;
}

export interface SendMessageRequest {
  content: string;
  language?: string;
}

export interface SendMessageResponse {
  success: boolean;
  buyerReply: string;
  scoreSignals: ScoreSignal[];
  deductionPoints: DeductionPoint[];
  currentScore: number;
  conversationState: ConversationState;
  isFlagged: boolean;
}

export interface CompleteTrainingResponse {
  success: boolean;
  finalScore: FinalScore;
  coachReview: string;
  issues: CoachIssue[];
  examples: CoachExample[];
}

// --- Admin Types ---

export interface UserStats {
  userId: string;
  name: string;
  trainingCount: number;
  avgScore: number;
  top3Weaknesses: string[];
  lastTrainingAt?: Date;
  trend: 'up' | 'down' | 'stable';
}
