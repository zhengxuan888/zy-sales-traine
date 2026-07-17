'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useI18n } from '@/lib/i18n';

interface ScoreData {
  stats: {
    total_trainings: number;
    avg_score: number;
    best_score: number;
    total_duration: number;
  };
  top3Weaknesses: Array<{ weakness: string; count: number }>;
  trend: Array<{ score: number; completed_at: string }>;
  dimensionAverages: Array<{ dimension: string; avg_score: number }>;
}

export default function ScoresPage() {
  const [data, setData] = useState<ScoreData | null>(null);
  const [loading, setLoading] = useState(true);
  const { t, toggleLocale } = useI18n();

  useEffect(() => {
    fetch('/api/scores?userId=default')
      .then(r => r.json())
      .then(d => {
        if (d.success) setData(d.data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <p className="text-[#888899]">{t('common.loading')}</p>
      </div>
    );
  }

  const stats = data?.stats || { total_trainings: 0, avg_score: 0, best_score: 0, total_duration: 0 };

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
          <h1 className="text-lg font-bold text-white">{t('scores.title')}</h1>
          <p className="text-xs text-[#888899]">{t('home.menu.scoresSub')}</p>
        </div>
        <button onClick={toggleLocale} className="px-2 py-1 rounded bg-[#141420] border border-[#1e1e2e] text-[10px] text-[#888899] hover:text-[#00ff88] hover:border-[#00ff88]/30 transition-all">
          {t('lang.switch')}
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="bg-[#141420] rounded-xl border border-[#1e1e2e] p-4 text-center">
          <div className="text-2xl font-bold font-mono text-[#00ff88]">{stats.avg_score || '--'}</div>
          <div className="text-xs text-[#888899] mt-1">{t('scores.avgScore')}</div>
        </div>
        <div className="bg-[#141420] rounded-xl border border-[#1e1e2e] p-4 text-center">
          <div className="text-2xl font-bold font-mono text-[#4488ff]">{stats.total_trainings}</div>
          <div className="text-xs text-[#888899] mt-1">{t('scores.totalSessions')}</div>
        </div>
        <div className="bg-[#141420] rounded-xl border border-[#1e1e2e] p-4 text-center">
          <div className="text-2xl font-bold font-mono text-[#ffaa00]">{stats.best_score || '--'}</div>
          <div className="text-xs text-[#888899] mt-1">{t('scores.bestScore')}</div>
        </div>
        <div className="bg-[#141420] rounded-xl border border-[#1e1e2e] p-4 text-center">
          <div className="text-2xl font-bold font-mono text-[#aa88ff]">
            {stats.total_duration ? `${Math.round(stats.total_duration / 60)}m` : '--'}
          </div>
          <div className="text-xs text-[#888899] mt-1">Total Time</div>
        </div>
      </div>

      {/* Top 3 Weaknesses */}
      {data?.top3Weaknesses && data.top3Weaknesses.length > 0 && (
        <div className="bg-[#141420] rounded-xl border border-[#1e1e2e] p-4 mb-4">
          <h2 className="text-sm font-semibold text-white mb-3">{t('scores.weakestTop3')}</h2>
          <div className="space-y-2">
            {data.top3Weaknesses.map((w, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="text-lg font-bold text-[#ff4444]">#{i + 1}</span>
                <span className="text-sm text-[#ccccdd] flex-1">{w.weakness}</span>
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

      {/* Empty state */}
      {(!data || (stats.total_trainings === 0)) && (
        <div className="text-center py-12">
          <div className="text-4xl mb-4">{'\u{1F4CA}'}</div>
          <p className="text-[#888899]">{t('scores.noHistory')}</p>
          <Link href="/training/new" className="mt-4 inline-block px-4 py-2 bg-[#00ff88] text-black text-sm font-semibold rounded-lg">
            {t('home.menu.training')}
          </Link>
        </div>
      )}
    </div>
  );
}
