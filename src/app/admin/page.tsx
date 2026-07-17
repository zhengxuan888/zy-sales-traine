'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useI18n } from '@/lib/i18n';

interface UserStats {
  id: string;
  name: string;
  email: string;
  role: string;
  training_count: number;
  avg_score: number;
  best_score: number;
  top3Weaknesses: string[];
  last_training_at: string;
}

interface OverallStats {
  total_users: number;
  total_trainings: number;
  avg_score: number;
  completed_today: number;
}

export default function AdminPage() {
  const [users, setUsers] = useState<UserStats[]>([]);
  const [overallStats, setOverallStats] = useState<OverallStats | null>(null);
  const [loading, setLoading] = useState(true);
  const { t, toggleLocale } = useI18n();

  useEffect(() => {
    Promise.all([
      fetch('/api/admin/users').then(r => r.json()),
      fetch('/api/admin/stats').then(r => r.json()),
    ])
      .then(([usersData, statsData]) => {
        if (usersData.success) setUsers(usersData.data);
        if (statsData.success) setOverallStats(statsData.data.overall);
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

  return (
    <div className="min-h-screen bg-[#0a0a0f] px-4 py-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/" className="text-[#888899] hover:text-white">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </Link>
        <div className="flex-1">
          <h1 className="text-lg font-bold text-white">{'\u{1F451}'} {t('admin.title')}</h1>
          <p className="text-xs text-[#888899]">{t('admin.subtitle')}</p>
        </div>
        <button onClick={toggleLocale} className="px-2 py-1 rounded bg-[#141420] border border-[#1e1e2e] text-[10px] text-[#888899] hover:text-[#00ff88] hover:border-[#00ff88]/30 transition-all">
          {t('lang.switch')}
        </button>
      </div>

      {/* Overall Stats */}
      {overallStats && (
        <div className="grid grid-cols-4 gap-3 mb-6">
          <div className="bg-[#141420] rounded-xl border border-[#1e1e2e] p-3 text-center">
            <div className="text-xl font-bold font-mono text-[#00ff88]">{overallStats.total_users}</div>
            <div className="text-[10px] text-[#888899]">Users</div>
          </div>
          <div className="bg-[#141420] rounded-xl border border-[#1e1e2e] p-3 text-center">
            <div className="text-xl font-bold font-mono text-[#4488ff]">{overallStats.total_trainings}</div>
            <div className="text-[10px] text-[#888899]">Trainings</div>
          </div>
          <div className="bg-[#141420] rounded-xl border border-[#1e1e2e] p-3 text-center">
            <div className="text-xl font-bold font-mono text-[#ffaa00]">{overallStats.avg_score || '--'}</div>
            <div className="text-[10px] text-[#888899]">{t('admin.avgScore')}</div>
          </div>
          <div className="bg-[#141420] rounded-xl border border-[#1e1e2e] p-3 text-center">
            <div className="text-xl font-bold font-mono text-[#aa88ff]">{overallStats.completed_today}</div>
            <div className="text-[10px] text-[#888899]">Today</div>
          </div>
        </div>
      )}

      {/* Users Table */}
      <div className="bg-[#141420] rounded-xl border border-[#1e1e2e] overflow-hidden">
        <div className="px-4 py-3 border-b border-[#1e1e2e]">
          <h2 className="text-sm font-semibold text-white">Team Performance</h2>
        </div>
        {users.length === 0 ? (
          <div className="p-8 text-center text-[#888899] text-sm">
            {t('admin.noData')}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#1e1e2e]">
                  <th className="text-left px-4 py-2 text-xs text-[#888899] font-medium">{t('admin.employee')}</th>
                  <th className="text-center px-3 py-2 text-xs text-[#888899] font-medium">{t('admin.practiceCount')}</th>
                  <th className="text-center px-3 py-2 text-xs text-[#888899] font-medium">{t('admin.avgScore')}</th>
                  <th className="text-left px-3 py-2 text-xs text-[#888899] font-medium">{t('admin.weakest')}</th>
                  <th className="text-center px-3 py-2 text-xs text-[#888899] font-medium">Last</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-b border-[#1e1e2e]/50 hover:bg-[#1a1a2e]">
                    <td className="px-4 py-3">
                      <div className="font-medium text-white">{user.name}</div>
                      <div className="text-[10px] text-[#555566]">{user.email}</div>
                    </td>
                    <td className="text-center px-3 py-3 font-mono text-[#ccccdd]">
                      {user.training_count}
                    </td>
                    <td className="text-center px-3 py-3">
                      <span className={`font-mono font-bold ${
                        Number(user.avg_score) >= 75 ? 'text-[#00ff88]' :
                        Number(user.avg_score) >= 60 ? 'text-[#ffaa00]' :
                        user.avg_score ? 'text-[#ff4444]' : 'text-[#555566]'
                      }`}>
                        {user.avg_score || '--'}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex gap-1 flex-wrap">
                        {user.top3Weaknesses?.slice(0, 3).map((w, i) => (
                          <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-300">
                            {w}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="text-center px-3 py-3 text-[10px] text-[#555566]">
                      {user.last_training_at
                        ? new Date(user.last_training_at).toLocaleDateString()
                        : 'Never'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
