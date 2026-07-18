import { NextRequest, NextResponse } from 'next/server';
import { getClient } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const client = getClient();

    // Get session
    const { data: session, error } = await client
      .from('training_history')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    if (!session) {
      return NextResponse.json(
        { success: false, code: 'SESSION_NOT_FOUND', message: 'Training session not found' },
        { status: 404 }
      );
    }

    // Get buyer persona
    let personaName = null;
    if (session.buyer_persona_id) {
      const { data: persona } = await client
        .from('buyer_persona')
        .select('name')
        .eq('id', session.buyer_persona_id)
        .maybeSingle();
      personaName = persona?.name || null;
    }

    // Get messages
    const { data: messages } = await client
      .from('chat_message')
      .select('id, role, content, message_order, deductions')
      .eq('training_id', id)
      .order('message_order', { ascending: true });

    // Collect all deductions from messages
    const allDeductions = (messages || []).reduce((acc: Array<{dimension: string; points: number; reason: string; messageOrder: number}>, m: Record<string, unknown>) => {
      if (m.deductions && Array.isArray(m.deductions)) {
        for (const d of m.deductions) {
          acc.push({ ...d, messageOrder: m.message_order as number });
        }
      }
      return acc;
    }, []);

    return NextResponse.json({
      success: true,
      data: {
        // === Flat structure aligned with POST /complete ===
        trainingId: session.id,
        finalScore: session.final_score || 0,
        ruleScore: session.rule_score || 0,
        aiScore: session.ai_score || 0,
        bonusScore: session.bonus_score || 0,
        issues: session.coach_issues || [],
        examples: session.coach_examples || [],
        summary: session.coach_review || '',
        weaknesses: session.weaknesses || [],
        scoreBreakdown: session.score_breakdown || {},
        // === Extra fields for review page rendering ===
        sessionId: session.id,
        status: session.status,
        buyerPersona: { name: personaName },
        generatedPersona: session.generated_persona || null,
        market: session.market_config_id ? { id: session.market_config_id } : null,
        deductions: allDeductions,
        totalMessages: session.total_messages || (messages || []).length,
        startedAt: session.started_at,
        completedAt: session.completed_at,
        // For retrain
        buyerPersonaId: session.buyer_persona_id,
        marketConfigId: session.market_config_id,
      },
    });
  } catch (error) {
    console.error('[GET /api/training/[id]/review] Error:', error);
    return NextResponse.json(
      { success: false, code: 'INTERNAL_ERROR', message: 'Failed to fetch review' },
      { status: 500 }
    );
  }
}
