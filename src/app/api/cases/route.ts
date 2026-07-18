import { NextRequest, NextResponse } from 'next/server';
import { getClient } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const search = searchParams.get('search');
    const difficulty = searchParams.get('difficulty');
    const productType = searchParams.get('product_type');
    const country = searchParams.get('country');
    
    const offset = (page - 1) * limit;
    
    const client = getClient();
    
    // Build query with filters
    let query = client
      .from('cases')
      .select('id, title, description, source, product_type, difficulty, tags, practice_count, avg_similarity_score, created_at, screenshots, conversation_data, key_moments, best_responses, market_config_id', { count: 'exact' })
      .eq('is_active', true);
    
    // Apply filters
    if (search) {
      query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`);
    }
    
    if (difficulty && difficulty !== 'all') {
      query = query.eq('difficulty', parseInt(difficulty));
    }
    
    if (productType && productType !== 'all') {
      query = query.eq('product_type', productType);
    }
    
    if (country && country !== 'all') {
      // Get market config IDs for the selected country
      const { data: markets } = await client
        .from('market_config')
        .select('id')
        .eq('country_code', country);
      
      if (markets && markets.length > 0) {
        const marketIds = markets.map(m => m.id);
        query = query.in('market_config_id', marketIds);
      } else {
        // No matching markets, return empty result
        return NextResponse.json({ 
          success: true, 
          data: [], 
          pagination: { page, limit, total: 0, totalPages: 0 }
        });
      }
    }
    
    // Apply pagination and ordering
    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    
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
