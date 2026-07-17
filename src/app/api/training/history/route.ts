import { NextRequest, NextResponse } from 'next/server';
import { getClient } from '@/lib/db';
import { resolveUserId } from '@/lib/utils';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const rawUserId = searchParams.get('userId');
    const userId = resolveUserId(rawUserId);
    const limit = parseInt(searchParams.get('limit') || '20');

    const client = getClient();
    let query = client
      .from('training_history')
      .select('id, status, mode, final_score, rule_score, ai_score, bonus_score, total_messages, weaknesses, started_at, completed_at, buyer_persona_id')
      .order('started_at', { ascending: false })
      .limit(limit);

    if (userId) {
      query = query.eq('user_id', userId);
    }

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ success: true, data: data || [] });
  } catch (error) {
    console.error('Failed to fetch training history:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
