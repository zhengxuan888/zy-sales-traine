import { NextRequest, NextResponse } from 'next/server';
import { getClient } from '@/lib/db';
import { resolveUserId } from '@/lib/utils';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const rawUserId = searchParams.get('userId');
    const userId = resolveUserId(rawUserId);
    const sessionId = searchParams.get('sessionId');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const offset = (page - 1) * limit;

    const client = getClient();

    // Direct session lookup by ID
    if (sessionId) {
      const { data, error } = await client
        .from('training_history')
        .select('*')
        .eq('id', sessionId)
        .maybeSingle();
      if (error) throw error;
      return NextResponse.json({ success: true, data: data || null });
    }

    // Build query with pagination
    let query = client
      .from('training_history')
      .select('id, status, mode, final_score, rule_score, ai_score, bonus_score, total_messages, weaknesses, started_at, completed_at, buyer_persona_id', { count: 'exact' })
      .order('started_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (userId) {
      query = query.eq('user_id', userId);
    }

    const { data, error, count } = await query;
    if (error) throw error;

    return NextResponse.json({ 
      success: true, 
      data: data || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      }
    });
  } catch (error) {
    console.error('Failed to fetch training history:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
