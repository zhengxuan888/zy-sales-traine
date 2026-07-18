import { NextResponse } from 'next/server';
import { getClient } from '@/lib/db';

export async function GET() {
  try {
    const client = getClient();
    const { data, error } = await client
      .from('market_config')
      .select('country_code, country_name, language')
      .eq('is_active', true)
      .order('country_name');
    
    if (error) throw error;

    return NextResponse.json({ 
      success: true, 
      data: data || [] 
    });
  } catch (error) {
    console.error('Failed to fetch countries:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
