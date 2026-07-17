import { NextRequest, NextResponse } from 'next/server';
import { getClient } from '@/lib/db';
import { TrainingEngine } from '@/lib/engine';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { scenarioId, caseId, mode = 'free_training', userId } = body;
    const client = getClient();

    // Get or create a default user if not provided
    let effectiveUserId = userId;
    if (!effectiveUserId) {
      const { data: defaultUser } = await client
        .from('users')
        .select('id')
        .eq('role', 'employee')
        .limit(1)
        .maybeSingle();
      effectiveUserId = defaultUser?.id || null;
    }

    // Get scenario or pick random
    let scenario;
    if (scenarioId) {
      const { data, error } = await client
        .from('scenario_config')
        .select('*, buyer_persona(*), market_config(*)')
        .eq('id', scenarioId)
        .maybeSingle();
      if (error) throw error;
      scenario = data;
    }
    if (!scenario) {
      const { data: scenarios, error } = await client
        .from('scenario_config')
        .select('*, buyer_persona(*), market_config(*)')
        .eq('is_active', true)
        .limit(1);
      if (error) throw error;
      scenario = scenarios?.[0];
    }
    if (!scenario) {
      return NextResponse.json({ success: false, error: 'No scenarios available' }, { status: 500 });
    }

    const engine = new TrainingEngine();
    const session = await engine.initialize({
      scenarioConfig: scenario,
      userId: effectiveUserId,
      mode,
      caseId,
    });

    return NextResponse.json({
      success: true,
      data: {
        trainingId: session.id,
        buyerGreeting: session.buyerGreeting,
        scenario: {
          name: scenario.name,
          productType: scenario.product_type,
          listedPrice: scenario.listed_price,
        },
      },
    });
  } catch (error) {
    console.error('Failed to start training:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
