import { NextRequest, NextResponse } from 'next/server';
import { getClient } from '@/lib/db';
import { TrainingEngine } from '@/lib/engine';
import { checkSellerMessage } from '@/lib/engine/rule-engine';
import { validateBuyerResponse, getFallbackBuyerResponse } from '@/lib/engine/response-validator';
import type { BuyerMemory } from '@/lib/engine/types';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { content, imageDescription } = body;

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return NextResponse.json(
        { code: 'INVALID_INPUT', message: 'Message content is required', detail: null },
        { status: 400 }
      );
    }

    const client = getClient();

    // Get training session
    const { data: sessionData, error: sessionError } = await client
      .from('training_history')
      .select('*')
      .eq('id', id)
      .single();

    if (sessionError || !sessionData) {
      return NextResponse.json(
        { code: 'SESSION_NOT_FOUND', message: 'Training session not found', detail: null },
        { status: 404 }
      );
    }

    // Get market config for validation
    let marketConfig = null;
    let marketConfigData: import('@/lib/engine/types').MarketConfigData | null = null;
    if (sessionData.market_config_id) {
      const { data: marketData } = await client
        .from('market_config')
        .select('*')
        .eq('id', sessionData.market_config_id)
        .single();
      marketConfig = marketData;
      if (marketData) {
        marketConfigData = {
          countryCode: marketData.country_code || 'ES',
          countryName: marketData.country_name || 'Spain',
          language: marketData.language || 'es',
          currency: marketData.currency || 'EUR',
          avgPriceRatio: Number(marketData.avg_price_ratio) || 1.0,
          meetupPreference: marketData.meetup_preference || 'avoid',
          shippingSupported: marketData.shipping_supported !== false,
          codSupported: marketData.cod_supported !== false,
        };
      }
    }

    // Get buyer persona for language
    let marketLanguage = 'es';
    if (marketConfig) {
      marketLanguage = marketConfig.language || 'es';
    }

    // Get existing messages
    const { data: existingMessages } = await client
      .from('chat_message')
      .select('*')
      .eq('training_id', id)
      .order('message_order', { ascending: true });

    // Build conversation history for engine
    // - For existing messages with imageDescription in metadata, add [Photo:] marker
    // - Append the new seller message so the AI can see and respond to it
    const historyForEngine = (existingMessages || []).map((m: Record<string, unknown>) => {
      const metadata = m.metadata as { imageDescription?: string } | null;
      if (metadata?.imageDescription && m.role === 'seller') {
        return { ...m, content: `[Photo: ${metadata.imageDescription}] ${m.content}` };
      }
      return m;
    });

    // Build the new seller message content for the engine
    // If imageDescription exists, prepend [Photo:] marker so the prompt builder can detect it
    const engineMessage = imageDescription
      ? `[Photo: ${imageDescription}] ${content.trim()}`
      : content.trim();

    // Append the new seller message to the history so the AI can see it
    historyForEngine.push({
      role: 'seller',
      content: engineMessage,
      message_order: (existingMessages?.length || 0) + 1,
    });

    // Load engine state from session
    const engine = new TrainingEngine();
    engine.loadState({
      id: sessionData.id,
      buyerPersona: sessionData.buyer_persona_id ? { id: sessionData.buyer_persona_id } : null,
      marketConfig: sessionData.market_config_id ? { id: sessionData.market_config_id } : null,
      scenarioConfig: sessionData.scenario_id ? { id: sessionData.scenario_id } : null,
      conversationHistory: historyForEngine,
      // Keep currentTurn as existingMessages.length (NOT +1) so scoring uses correct message order
      currentTurn: (existingMessages?.length || 0),
      memory: sessionData.memory || undefined,
      currentState: sessionData.current_state || undefined,
      deductions: sessionData.deductions || undefined,
      scoreSignals: sessionData.score_signals || undefined,
    });

    // Process message through engine
    const result = await engine.processMessage(engineMessage);

    // Save user message - with metadata if imageDescription exists
    const userMsgOrder = (existingMessages?.length || 0) + 1;
    const insertData: Record<string, unknown> = {
      training_id: id,
      role: 'seller',
      content: content.trim(),
      message_order: userMsgOrder,
    };
    if (imageDescription) {
      insertData.metadata = { imageDescription };
    }
    await client.from('chat_message').insert(insertData);

    // Run Rule Engine on seller message for real-time scoring
    const defaultTrust = { level: 0, evidence: [] };
    const rawMemory = (sessionData.memory as unknown as BuyerMemory) || {};
    const safeMemory: BuyerMemory = {
      productAuthenticity: rawMemory.productAuthenticity || defaultTrust,
      logisticsReliability: rawMemory.logisticsReliability || defaultTrust,
      personalChatAuth: rawMemory.personalChatAuth || defaultTrust,
      priceSatisfaction: rawMemory.priceSatisfaction || defaultTrust,
      conditionClarity: rawMemory.conditionClarity || defaultTrust,
      sellerCredibility: rawMemory.sellerCredibility || defaultTrust,
      overallTrust: rawMemory.overallTrust ?? 0,
      purchaseIntent: rawMemory.purchaseIntent ?? 50,
      mood: rawMemory.mood ?? 'neutral',
    };
    const ruleResult = checkSellerMessage(
      content.trim(),
      userMsgOrder,
      result.state,
      safeMemory,
      existingMessages || []
    );

    // Check if seller replied in Chinese - deduct 100 points
    const hasChinese = /[\u4e00-\u9fa5]/.test(content.trim());
    if (hasChinese && marketLanguage !== 'zh' && marketLanguage !== 'zh-CN' && marketLanguage !== 'zh-TW') {
      ruleResult.deductions.push({
        reason: '使用了中文回复，买家使用外语，请用买家语言回复',
        points: 100,
        dimension: 'language',
        severity: 'severe',
      });
    }

    // Save user message deductions if any
    if (ruleResult.deductions.length > 0) {
      await client.from('chat_message').update({
        deductions: ruleResult.deductions,
      }).eq('training_id', id).eq('message_order', userMsgOrder);
    }

    // Post-validate AI buyer response
    let buyerContent = result.buyerResponse;
    const maxValidationRetries = 2;
    let validationRetries = 0;

    while (validationRetries < maxValidationRetries) {
      const validation = validateBuyerResponse(buyerContent, marketConfigData);
      if (validation.valid) break;

      console.warn(`[Validation] AI response failed validation (attempt ${validationRetries + 1}):`, validation.reasons);
      validationRetries++;

      // Retry LLM generation
      try {
        const retryResult = await engine.processMessage(engineMessage);
        buyerContent = retryResult.buyerResponse;
      } catch {
        // If retry fails, use fallback
        buyerContent = getFallbackBuyerResponse(marketConfigData);
        break;
      }
    }

    // Final validation - if still invalid, use fallback
    const finalValidation = validateBuyerResponse(buyerContent, marketConfigData);
    if (!finalValidation.valid) {
      buyerContent = getFallbackBuyerResponse(marketConfigData);
    }

    // Handle GHOSTED state - show "已退出群聊" instead of "..."
    if (result.state === 'GHOSTED') {
      buyerContent = '🚫 已退出群聊';
    }

    // Generate Chinese translation for buyer message if not in Chinese
    let buyerTranslation = '';
    if (marketLanguage && !['zh', 'zh-CN', 'zh-TW', 'zh-cn', 'zh-tw'].includes(marketLanguage) && result.state !== 'GHOSTED') {
      try {
        const translationPrompt = 'Translate the following message to Chinese (简体中文). Only return the translation, nothing else:\n\n' + buyerContent;
        buyerTranslation = await engine['llm'].invoke(
          [{ role: 'user', content: translationPrompt }],
          { overrides: { temperature: 0.3 } }
        );
        buyerTranslation = buyerTranslation.trim();
      } catch {
        buyerTranslation = '';
      }
    }

    // Save AI message
    const aiMsgOrder = userMsgOrder + 1;
    await client.from('chat_message').insert({
      training_id: id,
      role: 'buyer',
      content: buyerContent,
      language: marketLanguage || 'es',
      translation: buyerTranslation || null,
      message_order: aiMsgOrder,
    });

    // Calculate running score
    const allDeductions = (existingMessages || []).reduce((acc: Array<{points: number; dimension: string}>, m: { deductions: Array<{points: number; dimension: string}> | null }) => {
      if (m.deductions) acc.push(...m.deductions);
      return acc;
    }, []);
    allDeductions.push(...ruleResult.deductions);
    const totalDeductions = allDeductions.reduce((sum: number, d: { points: number }) => sum + d.points, 0);
    const runningScore = Math.max(0, 100 - totalDeductions);

    // Update session
    const totalMessages = (existingMessages?.length || 0) + 2; // +2 for user msg + AI msg just saved
    const { error: updateError } = await client.from('training_history').update({
      current_state: result.state,
      total_messages: totalMessages,
    }).eq('id', id);
    
    if (updateError) {
      console.error('[Message] Failed to update session:', updateError);
    }

    return NextResponse.json({
      success: true,
      data: {
        aiMessage: buyerContent,
        aiTranslation: buyerTranslation,
        countryName: marketConfig?.country_name || (marketConfigData?.countryName) || null,
        countryCode: marketConfig?.country_code || (marketConfigData?.countryCode) || null,
        newState: result.state,
        scoreSignals: ruleResult.signals,
        deductions: ruleResult.deductions.map(d => ({
          dimension: d.dimension,
          points: d.points,
          reason: d.reason,
        })),
        runningScore,
        isFlagged: result.isFlagged,
      },
    });
  } catch (error) {
    console.error('[Message] Error:', error);
    return NextResponse.json(
      {
        code: 'INTERNAL_ERROR',
        message: 'Failed to process message',
        detail: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
