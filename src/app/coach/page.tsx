'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useI18n } from '@/lib/i18n';

interface CoachData {
  totalSessions: number;
  avgScore: number;
  highScore: number;
  topWeaknesses: Array<{ name: string; count: number }>;
  recentTrend: Array<{ score: number; date: string }>;
  recommendations: string[];
  suggestedBuyerTypes: string[];
}

export default function CoachPage() {
  const [data, setData] = useState<CoachData | null>(null);
  const [loading, setLoading] = useState(true);
  const { t, toggleLocale } = useI18n();

  useEffect(() => {
    async function fetchCoachData() {
      try {
        const [scoresRes, historyRes] = await Promise.all([
          fetch('/api/scores'),
          fetch('/api/training/history?limit=20'),
        ]);
        const scoresData = await scoresRes.json();
        const historyData = await historyRes.json();

        if (scoresData.success && historyData.success) {
          const scores = scoresData.data;
          const records = historyData.data || [];

          // Generate recommendations based on weaknesses
          const recommendations = generateRecommendations(scores.topWeaknesses || [], scores.avgScore);
          const suggestedBuyerTypes = suggestBuyerTypes(records);

          setData({
            totalSessions: scores.totalSessions,
            avgScore: scores.avgScore,
            highScore: scores.highScore,
            topWeaknesses: scores.topWeaknesses || [],
            recentTrend: scores.trend || [],
            recommendations,
            suggestedBuyerTypes,
          });
        }
      } catch (err) {
        console.error('Failed to fetch coach data:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchCoachData();
  }, []);

  const generateRecommendations = (weaknesses: Array<{ name: string; count: number }>, avgScore: number): string[] => {
    const recs: string[] = [];

    const weaknessTips: Record<string, string> = {
      language_tone: '注意语气：回复要简洁自然，像朋友聊天，避免客服腔',
      conciseness: '控制长度：一条消息说清重点，不要发长段落',
      trust_sequence: '建立信任顺序：先证明产品真实→物流可靠→再聊个人话题',
      meetup_handling: '面交处理：优先提出"出差型"方案，回避直接拒绝',
      payment_handling: '支付方式：强调COD货到付款，一口价含运费',
      product_info: '产品信息：主动提供电池健康度、存储容量、维修历史',
      honesty: '诚实原则：不编造维修历史，但可以模糊处理',
      greeting: '开场白：快速回应，直接报价+核心参数',
      negotiation: '议价应对：设定底线，用"含运费""覆盖X国"增加价值感',
      closing: '促成交易：给出明确时间地点，减少犹豫空间',
    };

    for (const w of weaknesses.slice(0, 3)) {
      const tip = weaknessTips[w.name];
      if (tip) recs.push(tip);
    }

    if (avgScore < 50) {
      recs.push('基础建议：先完成5轮简单难度训练，熟悉基本话术框架');
    } else if (avgScore < 70) {
      recs.push('进阶建议：尝试中等难度，重点练习议价和信任建立');
    } else {
      recs.push('高级建议：挑战困难买家类型，如砍价型+多语言混合');
    }

    return recs;
  };

  const suggestBuyerTypes = (records: Array<{ buyer_persona_name?: string; final_score?: number }>): string[] => {
    // Suggest buyer types the user hasn't practiced much or scored low on
    const allTypes = ['犹豫型', '砍价型', '技术型', '急躁型', '多语言型', '面交回避型'];
    const practiced = new Set(records.map(r => r.buyer_persona_name).filter(Boolean));
    
    // Prioritize unpracticed types
    const unpracticed = allTypes.filter(t => !practiced.has(t));
    if (unpracticed.length > 0) return unpracticed.slice(0, 3);
    
    // If all practiced, suggest types with lowest scores
    return allTypes.slice(0, 3);
  };

  const scoreColor = (score: number) => {
    if (score >= 70) return 'text-[#00ff88]';
    if (score >= 40) return 'text-[#ffaa00]';
    return 'text-[#ff4444]';
  };

  const weaknessLabel = (w: string) => {
    const labels: Record<string, string> = {
      language_tone: '语气',
      conciseness: '长度',
      trust_sequence: '信任顺序',
      meetup_handling: '面交',
      payment_handling: '支付',
      product_info: '产品信息',
      honesty: '诚实度',
      greeting: '开场白',
      negotiation: '议价',
      closing: '促成交易',
    };
    return labels[w] || w;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-[#00ff88] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-[#888899]">{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] px-4 py-6 max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/" className="text-[#888899] hover:text-white">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </Link>
        <div className="flex-1">
          <h1 className="text-lg font-bold text-white">{'\u{1F468}\u200D\u{1F3EB}'} AI 教练</h1>
          <p className="text-xs text-[#888899]">个性化训练建议</p>
        </div>
        <button onClick={toggleLocale} className="px-2 py-1 rounded bg-[#141420] border border-[#1e1e2e] text-[10px] text-[#888899] hover:text-[#00ff88] hover:border-[#00ff88]/30 transition-all">
          {t('lang.switch')}
        </button>
      </div>

      {!data || data.totalSessions === 0 ? (
        <div className="text-center py-12">
          <div className="text-5xl mb-4">{'\u{1F3AF}'}</div>
          <p className="text-[#888899] mb-4">还没有训练记录</p>
          <p className="text-xs text-[#888899] mb-6">完成几次训练后，AI 教练会给你个性化建议</p>
          <Link href="/training/new" className="inline-block px-6 py-3 bg-[#00ff88] text-black text-sm font-semibold rounded-xl">
            开始第一次训练
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Performance Summary */}
          <div className="bg-[#141420] rounded-xl border border-[#1e1e2e] p-4">
            <h2 className="text-sm font-semibold text-white mb-3">{'\u{1F4CA}'} 训练概况</h2>
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center">
                <div className="text-xl font-bold text-white font-mono">{data.totalSessions}</div>
                <div className="text-[10px] text-[#888899]">训练次数</div>
              </div>
              <div className="text-center">
                <div className={`text-xl font-bold font-mono ${scoreColor(data.avgScore)}`}>{data.avgScore}</div>
                <div className="text-[10px] text-[#888899]">平均分</div>
              </div>
              <div className="text-center">
                <div className={`text-xl font-bold font-mono ${scoreColor(data.highScore)}`}>{data.highScore}</div>
                <div className="text-[10px] text-[#888899]">最高分</div>
              </div>
            </div>
          </div>

          {/* Weaknesses */}
          {data.topWeaknesses.length > 0 && (
            <div className="bg-[#141420] rounded-xl border border-[#1e1e2e] p-4">
              <h2 className="text-sm font-semibold text-white mb-3">{'\u26A0\uFE0F'} 薄弱环节</h2>
              <div className="space-y-2">
                {data.topWeaknesses.map((w, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-[#888899] w-4">{i + 1}.</span>
                      <span className="text-sm text-[#ff4444]">{weaknessLabel(w.name)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 bg-[#1e1e2e] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#ff4444] rounded-full"
                          style={{ width: `${Math.min(100, (w.count / data.totalSessions) * 100)}%` }}
                        />
                      </div>
                      <span className="text-xs text-[#888899] w-8 text-right">{w.count}次</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* AI Recommendations */}
          <div className="bg-[#141420] rounded-xl border border-[#00ff88]/20 p-4">
            <h2 className="text-sm font-semibold text-[#00ff88] mb-3">{'\u{1F4A1}'} AI 建议</h2>
            <div className="space-y-3">
              {data.recommendations.map((rec, i) => (
                <div key={i} className="flex gap-2">
                  <span className="text-[#00ff88] text-xs mt-0.5 shrink-0">{'\u2022'}</span>
                  <p className="text-sm text-[#ccccdd]">{rec}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Suggested Buyer Types */}
          {data.suggestedBuyerTypes.length > 0 && (
            <div className="bg-[#141420] rounded-xl border border-[#1e1e2e] p-4">
              <h2 className="text-sm font-semibold text-white mb-3">{'\u{1F3AF}'} 建议练习的买家类型</h2>
              <div className="flex flex-wrap gap-2">
                {data.suggestedBuyerTypes.map((type, i) => (
                  <Link
                    key={i}
                    href={`/training/new?buyerType=${encodeURIComponent(type)}`}
                    className="px-3 py-1.5 bg-[#4488ff]/10 border border-[#4488ff]/20 rounded-lg text-sm text-[#4488ff] hover:bg-[#4488ff]/20 transition-colors"
                  >
                    {type}
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Trend Chart */}
          {data.recentTrend.length > 0 && (
            <div className="bg-[#141420] rounded-xl border border-[#1e1e2e] p-4">
              <h2 className="text-sm font-semibold text-white mb-3">{'\u{1F4C8}'} 分数趋势</h2>
              <div className="flex items-end gap-1 h-20">
                {data.recentTrend.map((point, i) => {
                  const height = Math.max(10, (point.score / 110) * 100);
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      <div
                        className="w-full bg-[#00ff88]/60 rounded-t"
                        style={{ height: `${height}%` }}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* CTA */}
          <Link
            href="/training/new"
            className="block w-full text-center px-4 py-3 bg-[#00ff88] text-black text-sm font-semibold rounded-xl"
          >
            开始新训练
          </Link>
        </div>
      )}
    </div>
  );
}
