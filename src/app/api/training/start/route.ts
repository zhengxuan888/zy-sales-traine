import { NextRequest, NextResponse } from 'next/server';
import { getClient } from '@/lib/db';
import { validateBuyerResponse, getFallbackBuyerResponse } from '@/lib/engine/response-validator';
import { resolveUserId } from '@/lib/utils';

// Default fallback greeting per language
const FALLBACK_GREETINGS: Record<string, string> = {
  es: 'Hola! El iPhone que publicas sigue disponible? Cuanto pides?',
  pl: 'Czesc! Ten iPhone nadal dostepny? Jaka cena?',
  cs: 'Ahoj! Je ten iPhone stale k dispozici? Jakou cenu?',
  pt: 'Ola! O iPhone que anunciou ainda esta disponivel? Qual o preco?',
  el: 'Geia! Auto to iPhone einai diathesimo? Poso to dinis?',
  hr: 'Bok! Je li taj iPhone jos dostupan? Koja je cijena?',
  en: 'Hi! Is this iPhone still available? What price?',
};

function getFallbackGreeting(language: string): string {
  return FALLBACK_GREETINGS[language?.toLowerCase()] || FALLBACK_GREETINGS.en;
}

// Default fallback dynamic buyer
function getDefaultDynamicBuyer(baseDifficulty: number) {
  return {
    ageGroup: '25-35' as const,
    occupation: 'office_worker',
    personality: 'neutral' as const,
    communicationStyle: 'balanced' as const,
    budgetRange: { min: 400, max: 700 },
    specialRequest: null,
    scenarioSeed: { seedText: 'General inquiry', difficultyBoost: 0, category: 'general' as const },
    effectiveDifficulty: baseDifficulty,
    personaPrompt: 'A general buyer interested in purchasing a used phone.',
  };
}

export async function POST(request: NextRequest) {
  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    // Empty body is OK, use defaults
  }

  const { buyerPersonaId, marketConfigId, scenarioId, userId } = body;
  const effectiveUserId = resolveUserId(userId as string | null);
  const client = getClient();

  // === Step 1: Get buyer persona (with fallback) ===
  let persona: Record<string, unknown> | null = null;
  try {
    if (buyerPersonaId) {
      const { data } = await client
        .from('buyer_persona')
        .select('*')
        .eq('id', buyerPersonaId as string)
        .single();
      persona = data;
    }
    if (!persona) {
      const { data: personas } = await client
        .from('buyer_persona')
        .select('*')
        .limit(1);
      persona = personas?.[0] || null;
    }
  } catch (err) {
    console.error('[Training Start] Failed to fetch persona:', err);
  }

  // Hard fallback: if DB has no personas, use a minimal object
  if (!persona) {
    persona = {
      id: '00000000-0000-0000-0000-000000000001',
      name: 'General Buyer',
      description: 'A standard buyer',
      difficulty: 3,
      language: 'en',
      patience: 5,
      negotiation_style: 'moderate',
      technical_knowledge: 3,
      trust_sensitivity: 3,
    };
  }

  // === Step 2: Get market config (with fallback) ===
  let market: Record<string, unknown> | null = null;
  try {
    if (marketConfigId) {
      const { data } = await client
        .from('market_config')
        .select('*')
        .eq('id', marketConfigId as string)
        .single();
      market = data;
    }
    if (!market) {
      const { data: markets } = await client
        .from('market_config')
        .select('*')
        .eq('country_code', 'ES')
        .limit(1);
      market = markets?.[0] || null;
    }
    if (!market) {
      // Any market will do
      const { data: markets } = await client
        .from('market_config')
        .select('*')
        .limit(1);
      market = markets?.[0] || null;
    }
  } catch (err) {
    console.error('[Training Start] Failed to fetch market:', err);
  }

  // Hard fallback: if DB has no markets
  if (!market) {
    market = {
      id: '00000000-0000-0000-0000-000000000002',
      country_name: 'Spain',
      country_code: 'ES',
      language: 'es',
      currency: 'EUR',
      avg_price_ratio: 1.0,
      meetup_preference: 'avoid',
      shipping_supported: true,
      cod_supported: true,
    };
  }

  // === Step 3: Get scenario if specified ===
  let scenario: Record<string, unknown> | null = null;
  if (scenarioId) {
    try {
      const { data: scenarioData } = await client
        .from('scenario_config')
        .select('*')
        .eq('id', scenarioId as string)
        .single();
      scenario = scenarioData;
    } catch (err) {
      console.warn('[Training Start] Failed to fetch scenario:', err);
    }
  }

  // === Step 4: Generate dynamic buyer (with fallback) ===
  let dynamicBuyer;
  try {
    const { generateDynamicBuyer } = await import('@/lib/engine/buyer-generator');
    dynamicBuyer = await generateDynamicBuyer({
      buyerPersonaId: persona.id as string,
      buyerPersonaName: (persona.name as string) || 'General Buyer',
      baseDifficulty: (persona.difficulty as number) || 3,
      userId: effectiveUserId,
      productType: (body.productType as string) || 'iPhone 14 Pro 256GB',
    });
  } catch (err) {
    console.error('[Training Start] Dynamic buyer generation failed, using defaults:', err);
    dynamicBuyer = getDefaultDynamicBuyer((persona.difficulty as number) || 3);
  }

  // === Step 5: Build scenarioConfig ===
  const productType = (body.productType as string) || 'iPhone 14 Pro 256GB';
  const scenarioConfig: Record<string, unknown> = scenario ? { ...scenario } : {
    buyer_persona: persona,
    market_config: market,
    product_type: productType,
    product_condition: 'used',
    listed_price: dynamicBuyer.budgetRange.max + 50,
    sop_checklist: [
      { step: 'greeting', required: true },
      { step: 'product_info', required: true },
      { step: 'trust_build', required: true },
      { step: 'logistics', required: true },
      { step: 'closing', required: true },
    ],
    dynamic_persona: dynamicBuyer,
    scenario_seed: dynamicBuyer.scenarioSeed,
    persona_prompt: dynamicBuyer.personaPrompt,
  };

  if (scenario && !scenario.buyer_persona) {
    scenarioConfig.buyer_persona = persona;
  }
  if (scenario && !scenario.market_config) {
    scenarioConfig.market_config = market;
  }

  // === Step 6: Initialize training engine (with fallback greeting) ===
  let session: { id: string; buyerGreeting: string };
  try {
    const { TrainingEngine } = await import('@/lib/engine');
    const engine = new TrainingEngine();
    session = await engine.initialize({
      scenarioConfig,
      userId: effectiveUserId,
      mode: scenarioId ? 'case' : 'free',
    });
  } catch (err) {
    console.error('[Training Start] TrainingEngine.initialize failed, creating minimal session:', err);
    // Create a minimal training record directly in DB
    const { data: training, error: insertError } = await client
      .from('training_history')
      .insert({
        user_id: effectiveUserId,
        scenario_id: scenario?.id as string || null,
        mode: scenarioId ? 'case' : 'free',
        status: 'active',
        buyer_persona_id: (persona.id as string) || null,
        market_config_id: (market.id as string) || null,
        current_state: 'INITIAL',
      })
      .select('id')
      .single();

    if (insertError) {
      console.error('[Training Start] CRITICAL: Even fallback DB insert failed:', insertError);
      return NextResponse.json(
        {
          code: 'DB_ERROR',
          message: 'Failed to create training session',
          detail: insertError.message,
        },
        { status: 500 }
      );
    }

    const language = (market.language as string) || 'en';
    session = {
      id: training.id,
      buyerGreeting: getFallbackGreeting(language),
    };
  }

  // === Step 7: Store generated persona (non-blocking) ===
  try {
    await client
      .from('training_history')
      .update({
        generated_persona: {
          ageGroup: dynamicBuyer.ageGroup,
          occupation: dynamicBuyer.occupation,
          personality: dynamicBuyer.personality,
          communicationStyle: dynamicBuyer.communicationStyle,
          budgetRange: dynamicBuyer.budgetRange,
          specialRequest: dynamicBuyer.specialRequest,
          scenarioSeed: dynamicBuyer.scenarioSeed.seedText,
          difficultyBoost: dynamicBuyer.scenarioSeed.difficultyBoost,
          effectiveDifficulty: dynamicBuyer.effectiveDifficulty,
          personaPrompt: dynamicBuyer.personaPrompt,
        },
      })
      .eq('id', session.id);
  } catch (err) {
    console.warn('[Training Start] Failed to store generated persona (non-critical):', err);
  }

  // === Step 8: Validate greeting (with fallback) ===
  let greeting = session.buyerGreeting;
  try {
    const marketForValidation = market as unknown as Parameters<typeof validateBuyerResponse>[1];
    const validation = validateBuyerResponse(greeting, marketForValidation);
    if (!validation.valid) {
      console.warn('[Start] Greeting failed validation:', validation.reasons);
      greeting = getFallbackBuyerResponse(marketForValidation);
    }
  } catch (err) {
    console.warn('[Start] Greeting validation failed, using fallback:', err);
    greeting = getFallbackGreeting((market.language as string) || 'en');
  }

  // If greeting is still empty, use hard fallback
  if (!greeting) {
    greeting = getFallbackGreeting((market.language as string) || 'en');
  }

  return NextResponse.json({
    success: true,
    data: {
      sessionId: session.id,
      buyerGreeting: greeting,
      buyerPersona: {
        name: persona.name,
        description: persona.description,
        difficulty: persona.difficulty,
      },
      generatedPersona: {
        ageGroup: dynamicBuyer.ageGroup,
        occupation: dynamicBuyer.occupation,
        personality: dynamicBuyer.personality,
        communicationStyle: dynamicBuyer.communicationStyle,
        budgetRange: dynamicBuyer.budgetRange,
        specialRequest: dynamicBuyer.specialRequest,
        effectiveDifficulty: dynamicBuyer.effectiveDifficulty,
      },
      scenarioSeed: dynamicBuyer.scenarioSeed.seedText,
      market: {
        country: market.country_name,
        language: market.language,
      },
      scenario: scenario ? { name: scenario.name, description: scenario.description } : null,
      sopChecklist: (scenarioConfig.sop_checklist as Array<{ step: string; required: boolean }>) || [],
    },
  });
}
