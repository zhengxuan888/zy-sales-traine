'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

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

const dimensionLabels: Record<string, string> = {
  greeting: 'Greeting',
  productinfo: 'Product Info',
  trustbuilding: 'Trust Building',
  negotiation: 'Negotiation',
  logistics: 'Logistics',
  closing: 'Closing',
  language: 'Language',
  sopcompliance: 'SOP',
};

export default function ScoresPage() {
  const [data, setData] = useState<ScoreData | null>(null);
  const [loading, setLoading] = useState(true);

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
        <p className="text-[#888899]">Loading scores...</p>
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
        <div>
          <h1 className="text-lg font-bold text-white">My Scores</h1>
          <p className="text-xs text-[#888899]">Track your progress</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="bg-[#141420] rounded-xl border border-[#1e1e2e] p-4 text-center">
          <div className="text-2xl font-bold font-mono text-[#00ff88]">{stats.avg_score || '--'}</div>
          <div className="text-xs text-[#888899] mt-1">Average Score</div>
        </div>
        <div className="bg-[#141420] rounded-xl border border-[#1e1e2e] p-4 text-center">
          <div className="text-2xl font-bold font-mono text-[#4488ff]">{stats.total_trainings}</div>
          <div className="text-xs text-[#888899] mt-1">Sessions</div>
        </div>
        <div className="bg-[#141420] rounded-xl border border-[#1e1e2e] p-4 text-center">
          <div className="text-2xl font-bold font-mono text-[#ffaa00]">{stats.best_score || '--'}</div>
          <div className="text-xs text-[#888899] mt-1">Best Score</div>
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
          <h2 className="text-sm font-semibold text-white mb-3">Top Weaknesses</h2>
          <div className="space-y-2">
            {data.top3Weaknesses.map((w, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="text-lg font-bold text-[#ff4444]">#{i + 1}</span>
                <span className="text-sm text-[#ccccdd] flex-1">
                  {dimensionLabels[w.weakness.toLowerCase()] || w.weakness}
                </span>
                <span className="text-xs text-[#888899]">{w.count}x</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Progress Trend */}
      {data?.trend && data.trend.length > 0 && (
        <div className="bg-[#141420] rounded-xl border border-[#1e1e2e] p-4 mb-4">
          <h2 className="text-sm font-semibold text-white mb-3">Progress Trend</h2>
          <div className="flex items-end gap-1 h-24">
            {data.trend.map((t, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div
                  className="w-full rounded-t bg-[#00ff88]/60"
                  style={{ height: `${Math.max(4, (Number(t.score) / 110) * 100)}%` }}
                />
                <span className="text-[8px] text-[#555566]">{t.score}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Dimension Averages */}
      {data?.dimensionAverages && data.dimensionAverages.length > 0 && (
        <div className="bg-[#141420] rounded-xl border border-[#1e1e2e] p-4 mb-4">
          <h2 className="text-sm font-semibold text-white mb-3">Dimension Averages</h2>
          <div className="space-y-2">
            {data.dimensionAverages.map((d) => (
              <div key={d.dimension} className="flex items-center gap-3">
                <span className="text-xs text-[#888899] w-24 shrink-0">
                  {dimensionLabels[d.dimension.toLowerCase()] || d.dimension}
                </span>
                <div className="flex-1 h-2 bg-[#1e1e2e] rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      Number(d.avg_score) >= 8 ? 'bg-[#00ff88]' :
                      Number(d.avg_score) >= 6 ? 'bg-[#ffaa00]' : 'bg-[#ff4444]'
                    }`}
                    style={{ width: `${(Number(d.avg_score) / 15) * 100}%` }}
                  />
                </div>
                <span className="text-xs font-mono text-[#ccccdd] w-8 text-right">{d.avg_score}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* No data state */}
      {stats.total_trainings === 0 && (
        <div className="text-center py-8">
          <div className="text-4xl mb-4">{'\u{1F4CA}'}</div>
          <p className="text-[#888899] mb-4">No training data yet</p>
          <Link href="/training/new" className="inline-block px-4 py-2 bg-[#00ff88] text-black text-sm font-semibold rounded-lg">
            Start Training
          </Link>
        </div>
      )}
    </div>
  );
}
