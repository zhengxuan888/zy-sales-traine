/**
 * Dynamic Buyer Generator
 * 
 * Generates unique buyer personas for each training session by combining:
 * - Base buyer type (from buyer_persona table)
 * - Random personality attributes
 * - Scenario seed (opening situation)
 * - Difficulty auto-progression based on employee history
 */

import { getClient } from '@/lib/db';

const db = getClient();

// ============ Types ============

export interface GeneratedPersona {
  // Base info
  buyerPersonaId: string;
  buyerPersonaName: string;
  
  // Random attributes
  ageGroup: AgeGroup;
  occupation: Occupation;
  personality: Personality;
  communicationStyle: CommunicationStyle;
  
  // Dynamic context
  budgetRange: { min: number; max: number };
  specialRequest: SpecialRequest | null;
  scenarioSeed: ScenarioSeed;
  
  // Difficulty
  baseDifficulty: number;
  difficultyBoost: number;
  effectiveDifficulty: number;
  
  // Prompt injection
  personaPrompt: string;
}

export interface ScenarioSeed {
  id: string;
  seedText: string;
  difficultyBoost: number;
  tags: string[];
}

// ============ Attribute Pools ============

type AgeGroup = '18-25' | '26-35' | '36-50' | '50+';
type Occupation = 'student' | 'office_worker' | 'freelancer' | 'retired' | 'housewife';
type Personality = 'impatient' | 'cautious' | 'direct' | 'suspicious' | 'friendly';
type CommunicationStyle = 'talkative' | 'concise' | 'emoji_heavy' | 'formal' | 'neutral';
type SpecialRequest = 'invoice' | 'warranty' | 'free_case' | 'buying_for_friend' | 'resell';

const AGE_GROUPS: AgeGroup[] = ['18-25', '26-35', '36-50', '50+'];
const OCCUPATIONS: Occupation[] = ['student', 'office_worker', 'freelancer', 'retired', 'housewife'];
const PERSONALITIES: Personality[] = ['impatient', 'cautious', 'direct', 'suspicious', 'friendly'];
const COMM_STYLES: CommunicationStyle[] = ['talkative', 'concise', 'emoji_heavy', 'formal'];
const SPECIAL_REQUESTS: SpecialRequest[] = ['invoice', 'warranty', 'free_case', 'buying_for_friend', 'resell'];

// ============ Personality Effects ============

const PERSONALITY_EFFECTS: Record<Personality, {
  patienceLevel: number;      // 1-5, how many messages before getting annoyed
  bargainAggressiveness: number; // 0-100, how hard they bargain
  trustBaseline: number;      // 0-100, starting trust level
  emojiUsage: boolean;
  formalityLevel: 'casual' | 'neutral' | 'formal';
}> = {
  impatient: { patienceLevel: 2, bargainAggressiveness: 60, trustBaseline: 40, emojiUsage: false, formalityLevel: 'casual' },
  cautious: { patienceLevel: 4, bargainAggressiveness: 30, trustBaseline: 20, emojiUsage: false, formalityLevel: 'neutral' },
  direct: { patienceLevel: 3, bargainAggressiveness: 50, trustBaseline: 50, emojiUsage: false, formalityLevel: 'casual' },
  suspicious: { patienceLevel: 3, bargainAggressiveness: 70, trustBaseline: 10, emojiUsage: false, formalityLevel: 'neutral' },
  friendly: { patienceLevel: 5, bargainAggressiveness: 20, trustBaseline: 70, emojiUsage: true, formalityLevel: 'casual' },
};

const AGE_EFFECTS: Record<AgeGroup, {
  techSavviness: number;  // 1-5
  priceSensitivity: number; // 0-100
  preferredStyle: CommunicationStyle;
}> = {
  '18-25': { techSavviness: 5, priceSensitivity: 80, preferredStyle: 'emoji_heavy' },
  '26-35': { techSavviness: 4, priceSensitivity: 60, preferredStyle: 'concise' },
  '36-50': { techSavviness: 3, priceSensitivity: 50, preferredStyle: 'neutral' },
  '50+': { techSavviness: 2, priceSensitivity: 40, preferredStyle: 'formal' },
};

const OCCUPATION_EFFECTS: Record<Occupation, {
  budgetMultiplier: number;  // 0.5-2.0
  availabilityPattern: string;
}> = {
  student: { budgetMultiplier: 0.6, availabilityPattern: 'evenings and weekends' },
  office_worker: { budgetMultiplier: 1.0, availabilityPattern: 'after work hours' },
  freelancer: { budgetMultiplier: 0.8, availabilityPattern: 'flexible, anytime' },
  retired: { budgetMultiplier: 0.7, availabilityPattern: 'mornings, weekdays' },
  housewife: { budgetMultiplier: 0.9, availabilityPattern: 'midday, weekdays' },
};

// ============ Utility Functions ============

function randomPick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomRange(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Weighted random based on difficulty tier
function weightedPersonalityPick(tier: 'easy' | 'medium' | 'hard'): Personality {
  if (tier === 'easy') {
    // Favor friendly, direct
    return randomPick(['friendly', 'friendly', 'direct', 'cautious', 'impatient']);
  } else if (tier === 'hard') {
    // Favor suspicious, impatient
    return randomPick(['suspicious', 'suspicious', 'impatient', 'cautious', 'direct']);
  }
  // Medium: balanced
  return randomPick(PERSONALITIES);
}

// ============ Core Generator ============

/**
 * Get employee's performance tier based on history
 */
async function getPerformanceTier(userId: string | null): Promise<{ tier: 'easy' | 'medium' | 'hard'; avgScore: number }> {
  if (!userId) return { tier: 'medium', avgScore: 0 };
  
  try {
    const { data } = await db
      .from('training_history')
      .select('final_score')
      .eq('user_id', userId)
      .not('final_score', 'is', null);
    
    if (!data || data.length === 0) {
      // New employee: start easy
      return { tier: 'easy', avgScore: 0 };
    }
    
    const avgScore = data.reduce((sum: number, r: { final_score: number }) => sum + (r.final_score || 0), 0) / data.length;
    
    if (avgScore < 60) return { tier: 'easy', avgScore };
    if (avgScore > 80) return { tier: 'hard', avgScore };
    return { tier: 'medium', avgScore };
  } catch {
    return { tier: 'medium', avgScore: 0 };
  }
}

/**
 * Fetch a random scenario seed based on difficulty tier
 */
async function fetchScenarioSeed(tier: 'easy' | 'medium' | 'hard'): Promise<ScenarioSeed> {
  let boostFilter: string;
  if (tier === 'easy') {
    boostFilter = 'difficulty_boost < 1';
  } else if (tier === 'hard') {
    boostFilter = 'difficulty_boost > 0';
  } else {
    boostFilter = 'difficulty_boost >= 0';
  }
  
  const { data, count } = await db
    .from('scenario_seeds')
    .select('*')
    .eq('is_active', true)
    .filter('difficulty_boost', tier === 'easy' ? 'lt' : tier === 'hard' ? 'gt' : 'gte', tier === 'medium' ? 0 : 1)
    .limit(100);
  
  // Fallback: just get any active seed
  if (!data || data.length === 0) {
    const { data: fallback } = await db
      .from('scenario_seeds')
      .select('*')
      .eq('is_active', true)
      .limit(1);
    
    if (fallback && fallback.length > 0) {
      return { id: fallback[0].id, seedText: fallback[0].seed_text, difficultyBoost: fallback[0].difficulty_boost, tags: fallback[0].tags || [] };
    }
    
    // Ultimate fallback
    return { id: 'fallback', seedText: 'Normal buyer, no special situation', difficultyBoost: 0, tags: [] };
  }
  
  const seed = randomPick(data) as { id: string; seed_text: string; difficulty_boost: number; tags: string[] | null };
  return { id: seed.id, seedText: seed.seed_text, difficultyBoost: seed.difficulty_boost, tags: seed.tags || [] };
}

/**
 * Generate budget range based on product type and occupation
 */
function generateBudgetRange(productType: string, occupation: Occupation): { min: number; max: number } {
  // Base price estimation from product type
  let basePrice = 400; // default
  const productLower = productType.toLowerCase();
  
  if (productLower.includes('iphone 16') || productLower.includes('s24 ultra')) basePrice = 800;
  else if (productLower.includes('iphone 15') || productLower.includes('s24')) basePrice = 600;
  else if (productLower.includes('iphone 14') || productLower.includes('s23')) basePrice = 450;
  else if (productLower.includes('iphone 13') || productLower.includes('s22')) basePrice = 350;
  else if (productLower.includes('oneplus')) basePrice = 350;
  else if (productLower.includes('pixel')) basePrice = 400;
  
  // Apply occupation budget multiplier
  const multiplier = OCCUPATION_EFFECTS[occupation].budgetMultiplier;
  const adjustedBase = basePrice * multiplier;
  
  // Random range: +/- 10-30%
  const variance = randomRange(10, 30) / 100;
  const min = Math.round(adjustedBase * (1 - variance));
  const max = Math.round(adjustedBase * (1 + variance));
  
  return { min, max };
}

/**
 * Build the persona prompt injection
 */
function buildPersonaPrompt(persona: Omit<GeneratedPersona, 'personaPrompt'>): string {
  const personalityEffects = PERSONALITY_EFFECTS[persona.personality];
  const ageEffects = AGE_EFFECTS[persona.ageGroup];
  const occupationEffects = OCCUPATION_EFFECTS[persona.occupation];
  
  const parts: string[] = [];
  
  // Age & occupation
  parts.push(`You are a ${persona.ageGroup} year old ${persona.occupation.replace('_', ' ')}.`);
  
  // Personality
  parts.push(`Your personality is ${persona.personality}. You have ${personalityEffects.patienceLevel}/5 patience level.`);
  
  // Communication style
  if (persona.communicationStyle === 'concise') {
    parts.push('Keep your messages SHORT - 1-2 sentences max. No unnecessary words.');
  } else if (persona.communicationStyle === 'talkative') {
    parts.push('You tend to chat a lot, share personal stories, and ask multiple questions at once.');
  } else if (persona.communicationStyle === 'emoji_heavy') {
    parts.push('You use lots of emojis in your messages 😊👍🤔💰');
  } else if (persona.communicationStyle === 'formal') {
    parts.push('You speak formally and politely, using proper grammar.');
  }
  
  // Budget
  parts.push(`Your budget is between ${persona.budgetRange.min}-${persona.budgetRange.max} (in local currency). You want a good deal but won't go below ${persona.budgetRange.min}.`);
  
  // Special request
  if (persona.specialRequest) {
    const requestTexts: Record<SpecialRequest, string> = {
      invoice: 'You need an invoice/receipt for expense report.',
      warranty: 'You want some kind of warranty or guarantee.',
      free_case: 'You want a free phone case or accessories included.',
      buying_for_friend: 'You are buying this as a gift for a friend.',
      resell: 'You are a reseller looking for good margin.',
    };
    parts.push(`Special: ${requestTexts[persona.specialRequest]}`);
  }
  
  // Scenario seed
  parts.push(`Opening situation: ${persona.scenarioSeed.seedText}`);
  
  // Trust baseline
  parts.push(`Your initial trust level in the seller is ${personalityEffects.trustBaseline}/100.`);
  
  // Bargaining style
  if (personalityEffects.bargainAggressiveness > 60) {
    parts.push('You bargain HARD. Push for 20-30% discount. Use comparisons and threats to leave.');
  } else if (personalityEffects.bargainAggressiveness > 30) {
    parts.push('You try to negotiate but will accept reasonable prices.');
  } else {
    parts.push('You are not a big negotiator. Accept reasonable prices easily.');
  }
  
  // Availability
  parts.push(`You are available ${occupationEffects.availabilityPattern}.`);
  
  return parts.join(' ');
}

/**
 * Main generator function
 */
export async function generateDynamicBuyer(params: {
  buyerPersonaId: string;
  buyerPersonaName: string;
  baseDifficulty: number;
  userId: string | null;
  productType: string;
}): Promise<GeneratedPersona> {
  const { buyerPersonaId, buyerPersonaName, baseDifficulty, userId, productType } = params;
  
  // 1. Get performance tier
  const { tier, avgScore } = await getPerformanceTier(userId);
  
  // 2. Generate random attributes
  const ageGroup = randomPick(AGE_GROUPS);
  const occupation = randomPick(OCCUPATIONS);
  const personality = weightedPersonalityPick(tier);
  
  // Communication style influenced by age
  const agePreferred = AGE_EFFECTS[ageGroup].preferredStyle;
  const communicationStyle = Math.random() < 0.6 ? agePreferred : randomPick(COMM_STYLES);
  
  // 3. Generate budget range
  const budgetRange = generateBudgetRange(productType, occupation);
  
  // 4. Special request (40% chance of having one)
  const specialRequest = Math.random() < 0.4 ? randomPick(SPECIAL_REQUESTS) : null;
  
  // 5. Fetch scenario seed
  const scenarioSeed = await fetchScenarioSeed(tier);
  
  // 6. Calculate effective difficulty
  const difficultyBoost = scenarioSeed.difficultyBoost;
  const tierAdjustment = tier === 'easy' ? -1 : tier === 'hard' ? 1 : 0;
  const effectiveDifficulty = Math.max(1, Math.min(5, baseDifficulty + difficultyBoost + tierAdjustment));
  
  // 7. Build persona
  const personaBase = {
    buyerPersonaId,
    buyerPersonaName,
    ageGroup,
    occupation,
    personality,
    communicationStyle,
    budgetRange,
    specialRequest,
    scenarioSeed,
    baseDifficulty,
    difficultyBoost,
    effectiveDifficulty,
  };
  
  const personaPrompt = buildPersonaPrompt(personaBase);
  
  return {
    ...personaBase,
    personaPrompt,
  };
}

/**
 * Get recent personas to avoid repetition
 */
export async function getRecentPersonas(userId: string | null, limit: number = 5): Promise<GeneratedPersona[]> {
  if (!userId) return [];
  
  try {
    const { data } = await db
      .from('training_history')
      .select('generated_persona')
      .eq('user_id', userId)
      .not('generated_persona', 'is', null)
      .order('created_at', { ascending: false })
      .limit(limit);
    
    if (!data) return [];
    return data.map((r: { generated_persona: GeneratedPersona }) => r.generated_persona).filter(Boolean);
  } catch {
    return [];
  }
}
