import { NextRequest, NextResponse } from 'next/server';
import { getClient } from '@/lib/db';
import { resolveUserId } from '@/lib/utils';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const rawUserId = searchParams.get('userId');
    const userId = resolveUserId(rawUserId);
    const category = searchParams.get('category');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const offset = (page - 1) * limit;

    const client = getClient();
    
    // Build query with filters and pagination
    let query = client
      .from('wrong_questions')
      .select('id, category, original_message, user_response, ideal_response, explanation, related_dimension, is_practiced, practice_count, created_at', { count: 'exact' })
      .order('created_at', { ascending: false });

    if (userId) query = query.eq('user_id', userId);
    if (category) query = query.eq('category', category);

    // Get total count first (without pagination)
    let countQuery = client
      .from('wrong_questions')
      .select('id', { count: 'exact', head: true })
      .order('created_at', { ascending: false });

    if (userId) countQuery = countQuery.eq('user_id', userId);
    if (category) countQuery = countQuery.eq('category', category);

    const { count, error: countError } = await countQuery;
    if (countError) throw countError;

    // Apply pagination
    query = query.range(offset, offset + limit - 1);
    const { data, error } = await query;
    if (error) throw error;

    // Group by category (for the current page)
    const grouped: Record<string, typeof data> = {};
    for (const row of data || []) {
      const cat = row.category || 'other';
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(row);
    }

    // Get all categories (without pagination) for the filter tabs
    let allCategoriesQuery = client
      .from('wrong_questions')
      .select('category')
      .order('created_at', { ascending: false });
    
    if (userId) allCategoriesQuery = allCategoriesQuery.eq('user_id', userId);
    
    const { data: allCategoriesData } = await allCategoriesQuery;
    const categoryCounts: Record<string, number> = {};
    for (const row of allCategoriesData || []) {
      const cat = row.category || 'other';
      categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
    }

    return NextResponse.json({
      success: true,
      data: { 
        all: data || [], 
        grouped,
        categories: categoryCounts,
      },
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      }
    });
  } catch (error) {
    console.error('Failed to fetch wrong questions:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
