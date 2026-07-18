import { NextRequest, NextResponse } from 'next/server';
import { getClient } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const client = getClient();

    // Get session with related data
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

    // Get buyer persona name
    let personaName = null;
    let personaDifficulty = null;
    if (session.buyer_persona_id) {
      const { data: persona } = await client
        .from('buyer_persona')
        .select('name, difficulty')
        .eq('id', session.buyer_persona_id)
        .maybeSingle();
      personaName = persona?.name || null;
      personaDifficulty = persona?.difficulty || null;
    }

    // Get market info
    let marketCountry = null;
    let marketLanguage = 'en';
    if (session.market_config_id) {
      const { data: market } = await client
        .from('market_config')
        .select('country_name, language')
        .eq('id', session.market_config_id)
        .maybeSingle();
      marketCountry = market?.country_name || null;
      marketLanguage = market?.language || 'en';
    }

    // Get chat messages
    const { data: messages, error: msgError } = await client
      .from('chat_message')
      .select('id, role, content, message_order, deduction_points, is_flagged, created_at')
      .eq('training_id', id)
      .order('message_order', { ascending: true });

    if (msgError) {
      console.error('[Training GET] Messages query error:', msgError);
    }

    // Calculate running score from deductions
    const allDeductions = (messages || []).reduce((acc: Array<{dimension: string; points: number; reason: string}>, m: { deduction_points: Array<{dimension: string; points: number; reason: string}> | null }) => {
      if (m.deduction_points) acc.push(...m.deduction_points);
      return acc;
    }, []);
    const totalDeductions = allDeductions.reduce((sum: number, d: { points: number }) => sum + d.points, 0);
    const runningScore = Math.max(0, 100 - totalDeductions);

    return NextResponse.json({
      success: true,
      data: {
        sessionId: session.id,
        status: session.status,
        currentState: session.current_state || 'INITIAL',
        mode: session.mode,
        buyerPersona: {
          name: personaName,
          difficulty: personaDifficulty,
        },
        market: {
          country: marketCountry,
          language: marketLanguage,
        },
        messages: (messages || []).map((m: Record<string, unknown>) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          messageOrder: m.message_order,
          deductions: m.deduction_points || [],
          isFlagged: m.is_flagged || false,
          createdAt: m.created_at,
        })),
        runningScore,
        finalScore: session.final_score,
        totalMessages: session.total_messages || (messages || []).length,
        generatedPersona: session.generated_persona || null,
        weaknesses: session.weaknesses || [],
        startedAt: session.started_at,
        completedAt: session.completed_at,
      },
    });
  } catch (error) {
    console.error('[GET /api/training/[id]] Error:', error);
    return NextResponse.json(
      { success: false, code: 'INTERNAL_ERROR', message: 'Failed to fetch session' },
      { status: 500 }
    );
  }
}
