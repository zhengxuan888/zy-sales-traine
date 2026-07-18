'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useI18n } from '@/lib/i18n';
import { Pagination } from '@/components/pagination';

interface ScoreData {
  totalSessions: number;
  avgScore: number;
  topWeaknesses: Array<{ name: string; count: number }>;
  trend: Array<{ score: number; date: string }>;
  highScore: number;
}

interface TrainingRecord {
  id: string;
  buyer_persona_name: string;
  market_name: string;
  scenario_name: string | null;
  final_score: number | null;
  rule_score: number | null;
  ai_score: number | null;
  bonus_score: number | null;
  status: string;
  started_at: string;
  message_count: number;
}

export default function ScoresPage() {
  const { t } = useI18n();
  const [data, setData] = useState<ScoreData | null>(null);
  const [records, setRecords] = useState<TrainingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    async function fetchData() {
      try {
        const [scoresRes, historyRes] = await Promise.all([
          fetch('/api/scores'),
          fetch(`/api/training/history?page=${currentPage}&limit=${pageSize}`),
        ]);
        const scoresData = await scoresRes.json();
        const historyData = await historyRes.json();

        if (scoresData.success) setData(scoresData.data);
        if (historyData.success) {
          setRecords(historyData.data || []);
          setTotalPages(historyData.pagination?.totalPages || 1);
        }
      } catch (err) {
        console.error('Failed to fetch scores:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [currentPage, pageSize]);

  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    setCurrentPage(1); // Reset to first page when changing page size
  };

  const scoreColor = (score: number) => {
    if (score >= 70) return 'text-[#00ff88]';
    if (score >= 40) return 'text-[#ffaa00]';
    return 'text-[#ff4444]';
  };

  const weaknessLabel = (w: string) => {
    const labels: Record<string, string> = {
      language_tone: 'Tone',
      conciseness: 'Length',
      trust_sequence: 'Order',
      meetup_handling: 'Meetup',
      payment_handling: 'Payment',
      product_info: 'Product Info',
      honesty: 'Honesty',
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
    <div className="min-h-screen bg-[#0a0a0f] px-4 py-6">
      <div className="max-w-lg mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold text-white">{'\u{1F4CA}'} {t('scores.title')}</h1>
          <Link href="/" className="text-[#888899] hover:text-white text-sm">&larr; {t('common.back')}</Link>
        </div>

        {/* Stats */}
        {data && data.totalSessions > 0 && (
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="bg-[#141420] rounded-xl border border-[#1e1e2e] p-4 text-center">
              <div className="text-2xl font-bold text-white font-mono">{data.totalSessions}</div>
              <div className="text-xs text-[#888899]">{t('scores.totalTrainings')}</div>
            </div>
            <div className="bg-[#141420] rounded-xl border border-[#1e1e2e] p-4 text-center">
              <div className={`text-2xl font-bold font-mono ${scoreColor(data.avgScore)}`}>{data.avgScore}</div>
              <div className="text-xs text-[#888899]">{t('scores.avgScore')}</div>
            </div>
            <div className="bg-[#141420] rounded-xl border border-[#1e1e2e] p-4 text-center">
              <div className={`text-2xl font-bold font-mono ${scoreColor(data.highScore)}`}>{data.highScore}</div>
              <div className="text-xs text-[#888899]">{t('scores.highScore')}</div>
            </div>
          </div>
        )}

        {/* Top Weaknesses */}
        {data && data.topWeaknesses && data.topWeaknesses.length > 0 && (
          <div className="bg-[#141420] rounded-xl border border-[#1e1e2e] p-4 mb-4">
            <h2 className="text-sm font-semibold text-white mb-3">{t('scores.topWeaknesses')}</h2>
            <div className="space-y-2">
              {data.topWeaknesses.map((w, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-[#888899] w-4">{i + 1}.</span>
                    <span className="text-sm text-[#ff4444]">{weaknessLabel(w.name)}</span>
                  </div>
                  <span className="text-xs text-[#888899]">{w.count}x</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Trend Chart */}
        {data?.trend && data.trend.length > 0 && (
          <div className="bg-[#141420] rounded-xl border border-[#1e1e2e] p-4 mb-4">
            <h2 className="text-sm font-semibold text-white mb-3">{t('scores.trend')}</h2>
            <div className="flex items-end gap-1 h-24">
              {data.trend.map((point, i) => {
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

        {/* Training Records */}
        {records.length > 0 && (
          <div className="bg-[#141420] rounded-xl border border-[#1e1e2e] overflow-hidden">
            <h2 className="text-sm font-semibold text-white px-4 pt-4 pb-2">Training History</h2>
            <div className="divide-y divide-[#1e1e2e]/50">
              {records.map((record) => (
                <Link
                  key={record.id}
                  href={record.status === 'completed' ? `/training/${record.id}/review` : `/training/${record.id}`}
                  className="block px-4 py-3 hover:bg-[#1e1e2e]/30"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-white text-sm">{record.buyer_persona_name || 'Training'}</div>
                      <div className="text-[#888899] text-xs">
                        {record.market_name} {record.scenario_name ? `- ${record.scenario_name}` : ''}
                      </div>
                    </div>
                    <div className="text-right">
                      {record.final_score != null ? (
                        <div className={`text-lg font-mono font-bold ${scoreColor(record.final_score)}`}>
                          {record.final_score}
                        </div>
                      ) : (
                        <div className="text-xs text-[#888899]">{record.status}</div>
                      )}
                      <div className="text-[10px] text-[#888899]">
                        {new Date(record.started_at).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
            
            {/* Pagination */}
            <div className="px-4 pb-4">
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                pageSize={pageSize}
                onPageChange={setCurrentPage}
                onPageSizeChange={handlePageSizeChange}
                pageSizeOptions={[10, 20, 50]}
              />
            </div>
          </div>
        )}

        {/* Empty state */}
        {(!data || data.totalSessions === 0) && records.length === 0 && (
          <div className="text-center py-12">
            <div className="text-4xl mb-4">{'\u{1F4CA}'}</div>
            <p className="text-[#888899]">{t('scores.noHistory')}</p>
            <Link href="/training/new" className="mt-4 inline-block px-4 py-2 bg-[#00ff88] text-black text-sm font-semibold rounded-lg">
              {t('home.menu.training')}
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
