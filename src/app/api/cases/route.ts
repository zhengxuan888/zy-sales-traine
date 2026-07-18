import { NextRequest, NextResponse } from 'next/server';
import { getClient } from '@/lib/db';

export async function GET() {
  try {
    const client = getClient();
    const { data, error } = await client
      .from('cases')
      .select('id, title, description, source, product_type, difficulty, tags, practice_count, avg_similarity_score, created_at, screenshots, conversation_data, key_moments, best_responses')
      .eq('is_active', true)
      .order('created_at', { ascending: false });
    if (error) throw error;

    return NextResponse.json({ success: true, data: data || [] });
  } catch (error) {
    console.error('Failed to fetch cases:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, description, conversationData, conversation_data, buyerPersonaId, productType, product_type, difficulty, tags, screenshots, source } = body;
    const client = getClient();

    const { data, error } = await client
      .from('cases')
      .insert({
        title,
        description,
        conversation_data: conversationData || conversation_data,
        buyer_persona_id: buyerPersonaId,
        product_type: productType || product_type,
        difficulty: difficulty || 3,
        tags: tags || [],
        screenshots: screenshots || [],
        source: source || 'upload',
      })
      .select()
      .single();
    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Failed to create case:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
