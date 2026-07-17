import { NextRequest, NextResponse } from 'next/server';
import { getClient } from '@/lib/db';
import { TrainingEngine } from '@/lib/engine';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { message } = body;

    if (!message?.trim()) {
      return NextResponse.json({ success: false, error: 'Message is required' }, { status: 400 });
    }

    const client = getClient();

    // Load training session
    const { data: training, error } = await client
      .from('training_history')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    if (!training) {
      return NextResponse.json({ success: false, error: 'Training not found' }, { status: 404 });
    }

    // Load conversation history
    const { data: messages, error: msgError } = await client
      .from('chat_message')
      .select('*')
      .eq('training_id', id)
      .order('message_order', { ascending: true });
    if (msgError) throw msgError;

    // Load buyer persona
    const { data: persona } = await client
      .from('buyer_persona')
      .select('*')
      .eq('id', training.buyer_persona_id)
      .maybeSingle();

    // Load market config
    const { data: market } = await client
      .from('market_config')
      .select('*')
      .eq('id', training.market_config_id)
      .maybeSingle();

    // Load scenario
    const { data: scenario } = await client
      .from('scenario_config')
      .select('*')
      .eq('id', training.scenario_id)
      .maybeSingle();

    const engine = new TrainingEngine();
    engine.loadState({
      id: training.id,
      buyerPersona: persona as unknown as Record<string, unknown> | null,
      marketConfig: market as unknown as Record<string, unknown> | null,
      scenarioConfig: scenario as unknown as Record<string, unknown> | null,
      conversationHistory: (messages || []) as unknown as Array<Record<string, unknown>>,
      currentTurn: messages?.length || 0,
      memory: (training.memory as Record<string, unknown>) || undefined,
      currentState: (training.current_state as string) || 'GREETING',
      deductions: (training.deductions as Array<{ reason: string; points: number; dimension: string }>) || undefined,
      scoreSignals: (training.score_signals as Record<string, unknown>) || undefined,
    });

    const result = await engine.processMessage(message);

    // Save seller message to DB
    const sellerOrder = (messages?.length || 0) + 1;
    await client.from('chat_message').insert({
      training_id: id,
      role: 'seller',
      content: message,
      message_order: sellerOrder,
      score_signals: result.scoreSignals,
      deduction_points: result.deductions,
      is_flagged: result.deductions.length > 0,
    });

    // Save buyer response to DB
    const buyerOrder = sellerOrder + 1;
    await client.from('chat_message').insert({
      training_id: id,
      role: 'buyer',
      content: result.buyerResponse,
      message_order: buyerOrder,
      language: persona?.language || 'es',
    });

    // Update training state
    await client
      .from('training_history')
      .update({
        current_state: engine.getCurrentState(),
        memory: engine.getMemory() as unknown as Record<string, unknown>,
        deductions: engine.getDeductions(),
        score_signals: engine.getScoreSignals(),
        total_messages: buyerOrder,
      })
      .eq('id', id);

    return NextResponse.json({
      success: true,
      data: {
        buyerResponse: result.buyerResponse,
        deductions: result.deductions,
        scoreSignals: result.scoreSignals,
        state: result.state,
        isFlagged: result.isFlagged,
        messageOrder: buyerOrder,
      },
    });
  } catch (error) {
    console.error('Failed to process message:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
