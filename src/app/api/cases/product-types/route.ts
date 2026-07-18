import { NextResponse } from 'next/server';
import { getClient } from '@/lib/db';

export async function GET() {
  try {
    const client = getClient();
    
    // Get distinct product types from all active cases
    const { data, error } = await client
      .from('cases')
      .select('product_type')
      .eq('is_active', true)
      .not('product_type', 'is', null);
    
    if (error) throw error;

    // Get unique product types
    const types = [...new Set((data || []).map(d => d.product_type).filter(Boolean))].sort();

    return NextResponse.json({ 
      success: true, 
      data: types 
    });
  } catch (error) {
    console.error('Failed to fetch product types:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
