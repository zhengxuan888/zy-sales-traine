import { NextRequest, NextResponse } from 'next/server';
import { getClient } from '@/lib/db';
import { getLLMAdapter } from '@/lib/llm/llm-adapter';
import { getUserFromRequest } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const authUser = await getUserFromRequest(request);
    if (!authUser) {
      return NextResponse.json({ success: false, error: '请先登录' }, { status: 401 });
    }
    const userId = authUser.id;

    const client = getClient();
    let query = client
      .from('help_requests')
      .select('id, title, description, buyer_type, product_type, status, ai_suggestion, created_at')
      .order('created_at', { ascending: false })
      .limit(50);

    if (userId) query = query.eq('user_id', userId);

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ success: true, data: data || [] });
  } catch (error) {
    console.error('Failed to fetch help requests:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, description, buyerType, productType, conversationContext } = body;
    const authUser = await getUserFromRequest(request);
    if (!authUser) {
      return NextResponse.json({ success: false, error: '请先登录' }, { status: 401 });
    }
    const userId = authUser.id;
    const client = getClient();

    // 1. 先插入求助记录
    const { data, error } = await client
      .from('help_requests')
      .insert({
        title,
        description,
        buyer_type: buyerType,
        product_type: productType,
        user_id: userId || null,
        conversation_context: conversationContext || null,
      })
      .select()
      .single();
    if (error) throw error;

    // 2. 调用 LLM 生成 AI 建议
    let aiSuggestion = '';
    try {
      const adapter = getLLMAdapter();
      const prompt = buildHelpPrompt({ title, description, buyerType, productType, conversationContext });
      aiSuggestion = await adapter.invoke(
        [{ role: 'user', content: prompt }],
        { preset: 'coach-review', overrides: { temperature: 0.7 } }
      );

      // 3. 更新求助记录，写入 AI 建议
      await client
        .from('help_requests')
        .update({ ai_suggestion: aiSuggestion, status: 'answered' })
        .eq('id', data.id);

      data.ai_suggestion = aiSuggestion;
      data.status = 'answered';
    } catch (llmError) {
      console.error('LLM analysis failed:', llmError);
      // LLM 失败不影响主流程，返回无建议的结果
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Failed to create help request:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

function buildHelpPrompt(ctx: {
  title: string;
  description: string;
  buyerType?: string;
  productType?: string;
  conversationContext?: unknown;
}): string {
  const lines = [
    'You are an expert FB Marketplace sales coach. A seller needs help with a real buyer situation.',
    '',
    '## Situation',
    `- Title: ${ctx.title}`,
    `- Description: ${ctx.description}`,
  ];
  if (ctx.buyerType) lines.push(`- Buyer Type: ${ctx.buyerType}`);
  if (ctx.productType) lines.push(`- Product: ${ctx.productType}`);

  if (ctx.conversationContext) {
    lines.push('', '## Recent Conversation');
    if (Array.isArray(ctx.conversationContext)) {
      ctx.conversationContext.forEach((msg: Record<string, string> | string, i: number) => {
        if (typeof msg === 'string') {
          lines.push(`${i + 1}. ${msg}`);
        } else {
          lines.push(`${i + 1}. [${msg.role || 'unknown'}]: ${msg.content || ''}`);
        }
      });
    } else if (typeof ctx.conversationContext === 'string') {
      lines.push(ctx.conversationContext);
    }
  }

  lines.push(
    '',
    '## Your Task',
    'Provide actionable advice in the following format:',
    '',
    '### 问题分析',
    'Brief analysis of what is happening and why it is challenging.',
    '',
    '### 应对策略',
    '2-3 specific strategies to handle this situation.',
    '',
    '### 话术示范',
    'Give 2 example responses the seller can copy-paste. Keep them natural, casual, short (1-3 sentences). No customer service language.',
    '',
    '### 注意事项',
    'Key things to avoid in this situation.',
    '',
    'Respond in the same language as the description. Be direct and practical.',
  );

  return lines.join('\n');
}
