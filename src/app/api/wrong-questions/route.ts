import { NextRequest, NextResponse } from 'next/server';
import { getClient } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const category = searchParams.get('category');

    const client = getClient();
    let query = client
      .from('wrong_questions')
      .select('id, category, original_message, user_response, ideal_response, explanation, related_dimension, is_practiced, practice_count, created_at')
      .order('created_at', { ascending: false });

    if (userId) query = query.eq('user_id', userId);
    if (category) query = query.eq('category', category);

    const { data, error } = await query;
    if (error) throw error;

    // Group by category
    const grouped: Record<string, typeof data> = {};
    for (const row of data || []) {
      const cat = row.category || 'other';
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(row);
    }

    return NextResponse.json({
      success: true,
      data: { all: data || [], grouped },
    });
  } catch (error) {
    console.error('Failed to fetch wrong questions:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
