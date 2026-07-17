import { NextRequest, NextResponse } from 'next/server';
import { getClient } from '@/lib/db';
import { TrainingEngine } from '@/lib/engine';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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

    // Load all messages
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

    const review = await engine.generateCoachReview();

    // Calculate final score
    const finalScore = review.totalScore;

    // Update training record
    await client
      .from('training_history')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        final_score: finalScore,
        rule_score: review.ruleScore,
        ai_score: review.aiScore,
        bonus_score: review.bonusScore,
        coach_review: review.summary,
        coach_issues: review.issues as unknown as Record<string, unknown>[],
        coach_examples: review.examples as unknown as Record<string, unknown>[],
        score_breakdown: review.scoreBreakdown as unknown as Record<string, unknown>,
        weaknesses: review.weaknesses,
      })
      .eq('id', id);

    // Save wrong questions
    for (const issue of review.issues) {
      if (issue.messageRef) {
        const msg = messages?.[issue.messageRef - 1];
        if (msg) {
          await client.from('wrong_questions').insert({
            user_id: training.user_id,
            training_id: id,
            message_id: msg.id,
            category: issue.dimension || 'general',
            original_message: msg.content,
            ideal_response: issue.suggestion || '',
            explanation: issue.problem,
            related_dimension: issue.dimension || null,
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        trainingId: id,
        finalScore,
        ruleScore: review.ruleScore,
        aiScore: review.aiScore,
        bonusScore: review.bonusScore,
        issues: review.issues,
        examples: review.examples,
        summary: review.summary,
        weaknesses: review.weaknesses,
        scoreBreakdown: review.scoreBreakdown,
      },
    });
  } catch (error) {
    console.error('Failed to complete training:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
