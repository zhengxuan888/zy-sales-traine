import { NextResponse } from 'next/server';
import { getClient } from '@/lib/db';

/**
 * GET /api/buyer-personas
 * Returns the 12 buyer types from the database
 */
export async function GET() {
  try {
    const client = getClient();
    const { data, error } = await client
      .from('buyer_persona')
      .select('id, name, description, difficulty, personality_traits, is_active')
      .eq('is_active', true)
      .order('difficulty', { ascending: true });

    if (error) {
      console.error('[Buyer Personas] DB error:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch buyer personas' },
        { status: 500 }
      );
    }

    // Transform to frontend-friendly format
    const personas = (data || []).map((p: Record<string, unknown>) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      difficulty: p.difficulty,
      characteristics: p.personality_traits || [],
    }));

    return NextResponse.json({ success: true, data: personas });
  } catch (err) {
    console.error('[Buyer Personas] Error:', err);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch buyer personas' },
      { status: 500 }
    );
  }
}
