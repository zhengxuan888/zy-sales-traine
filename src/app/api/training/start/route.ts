import { NextRequest, NextResponse } from 'next/server';
import { getClient } from '@/lib/db';
import { TrainingEngine } from '@/lib/engine';
import { validateBuyerResponse, getFallbackBuyerResponse } from '@/lib/engine/response-validator';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { buyerPersonaId, marketConfigId, scenarioId, userId } = body;

    const client = getClient();

    // Get buyer persona
    let persona = null;
    if (buyerPersonaId) {
      const { data } = await client
        .from('buyer_persona')
        .select('*')
        .eq('id', buyerPersonaId)
        .single();
      persona = data;
    }
    if (!persona) {
      // Use default persona
      const { data: personas } = await client
        .from('buyer_persona')
        .select('*')
        .limit(1);
      persona = personas?.[0] || null;
    }

    // Get market config
    let market = null;
    if (marketConfigId) {
      const { data } = await client
        .from('market_config')
        .select('*')
        .eq('id', marketConfigId)
        .single();
      market = data;
    }
    if (!market) {
      // Use default market (Spain)
      const { data: markets } = await client
        .from('market_config')
        .select('*')
        .eq('country_code', 'ES')
        .limit(1);
      market = markets?.[0] || null;
    }

    if (!persona || !market) {
      return NextResponse.json(
        { code: 'CONFIG_NOT_FOUND', message: 'Buyer persona or market config not found', detail: null },
        { status: 404 }
      );
    }

    // Get scenario if specified
    let scenario = null;
    if (scenarioId) {
      const { data: scenarioData } = await client
        .from('scenario_config')
        .select('*')
        .eq('id', scenarioId)
        .single();
      scenario = scenarioData;
    }

    // Build scenarioConfig for engine
    const scenarioConfig: Record<string, unknown> = scenario || {
      buyer_persona: persona,
      market_config: market,
      product_type: 'iPhone 14 Pro 256GB',
      product_condition: 'used',
      listed_price: 650,
      sop_checklist: [
        { step: 'greeting', required: true },
        { step: 'product_info', required: true },
        { step: 'trust_build', required: true },
        { step: 'logistics', required: true },
        { step: 'closing', required: true },
      ],
    };

    // If scenario doesn't have embedded persona/market, attach them
    if (scenario && !scenario.buyer_persona) {
      scenarioConfig.buyer_persona = persona;
    }
    if (scenario && !scenario.market_config) {
      scenarioConfig.market_config = market;
    }

    // Initialize training
    const engine = new TrainingEngine();
    const session = await engine.initialize({
      scenarioConfig,
      userId: userId || '86dbb941-690f-46ab-9221-5038ff985173', // Default to Employee 1
      mode: scenarioId ? 'case' : 'free',
    });

    // Validate greeting
    let greeting = session.buyerGreeting;
    const validation = validateBuyerResponse(greeting, market);
    if (!validation.valid) {
      console.warn('[Start] Greeting failed validation:', validation.reasons);
      greeting = getFallbackBuyerResponse(market);
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
        market: {
          country: market.country_name,
          language: market.language,
        },
        scenario: scenario ? { name: scenario.name, description: scenario.description } : null,
        sopChecklist: (scenarioConfig.sop_checklist as Array<{ step: string; required: boolean }>) || [],
      },
    });
  } catch (error) {
    console.error('[Training Start] Error:', error);
    return NextResponse.json(
      {
        code: 'INTERNAL_ERROR',
        message: 'Failed to start training session',
        detail: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
