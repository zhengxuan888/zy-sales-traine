import { NextRequest, NextResponse } from 'next/server';
import { getClient } from '@/lib/db';

/**
 * GET /api/products - 获取产品价格列表
 * Query params:
 *   - brand: 按品牌过滤 (Apple/Samsung/Tablet/Other)
 *   - category: 按类别过滤 (Pro Max/Pro/Standard/Tablet/Unknown)
 *   - active: 是否只返回激活的产品 (默认true)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const brand = searchParams.get('brand');
    const category = searchParams.get('category');
    const active = searchParams.get('active') !== 'false';

    const supabase = getClient();
    let query = supabase.from('products').select('*');

    if (brand) {
      query = query.eq('brand', brand);
    }
    if (category) {
      query = query.eq('category', category);
    }
    if (active) {
      query = query.eq('is_active', true);
    }

    query = query.order('sales_count', { ascending: false });

    const { data, error } = await query;

    if (error) {
      console.error('Failed to fetch products:', error);
      return NextResponse.json(
        { success: false, error: { code: 'FETCH_ERROR', message: error.message } },
        { status: 500 }
      );
    }

    // Format prices as numbers
    const products = (data || []).map((p: Record<string, unknown>) => ({
      id: p.id,
      model_name: p.model_name,
      sales_count: p.sales_count,
      cod_price_eur: Number(p.cod_price_eur),
      price_rmb: Number(p.price_rmb),
      brand: p.brand,
      category: p.category,
      is_active: p.is_active,
      created_at: p.created_at,
      updated_at: p.updated_at,
    }));

    return NextResponse.json({ success: true, data: products });
  } catch (err) {
    console.error('Products API error:', err);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
      { status: 500 }
    );
  }
}
