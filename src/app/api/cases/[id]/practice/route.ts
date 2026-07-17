import { NextRequest, NextResponse } from 'next/server';
import { getClient } from '@/lib/db';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { message, conversationHistory = [] } = body;
    const client = getClient();

    // Load case
    const { data: caseData, error } = await client
      .from('cases')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    if (!caseData) {
      return NextResponse.json({ success: false, error: 'Case not found' }, { status: 404 });
    }

    // Load buyer persona for this case
    const { data: persona } = await client
      .from('buyer_persona')
      .select('*')
      .eq('id', caseData.buyer_persona_id)
      .maybeSingle();

    // Simple similarity comparison against case conversation
    const caseConversation = caseData.conversation_data as Array<{ role: string; content: string }> | null;
    let similarity = 0;
    let comparison: Array<{ yourResponse: string; caseResponse: string; similarity: number }> = [];

    if (caseConversation && message) {
      // Find the closest matching message in the case
      const sellerMessages = caseConversation.filter(m => m.role === 'seller');
      for (const caseMsg of sellerMessages) {
        const words1 = message.toLowerCase().split(/\s+/);
        const words2 = caseMsg.content.toLowerCase().split(/\s+/);
        const common = words1.filter((w: string) => words2.includes(w));
        const sim = common.length / Math.max(words1.length, words2.length);
        if (sim > similarity) {
          similarity = sim;
          comparison = [
            { yourResponse: message, caseResponse: caseMsg.content, similarity: Math.round(sim * 100) }
          ];
        }
      }
    }

    // Update practice count
    await client
      .from('cases')
      .update({ practice_count: (caseData.practice_count || 0) + 1 })
      .eq('id', id);

    return NextResponse.json({
      success: true,
      data: {
        caseTitle: caseData.title,
        buyerResponse: persona ? `Buyer would respond based on ${persona.name} persona` : 'Continue the conversation',
        similarity: Math.round(similarity * 100),
        comparison,
        bestResponses: caseData.best_responses || [],
      },
    });
  } catch (error) {
    console.error('Failed to practice case:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
