'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useI18n } from '@/lib/i18n';
import { Pagination } from '@/components/pagination';

interface UserStat {
  id: string;
  name: string;
  email: string;
  role: string;
  totalTrainings: number;
  avgScore: number;
  topWeaknesses: string[];
  lastTraining: string | null;
}

interface TeamStats {
  totalUsers: number;
  totalTrainings: number;
  avgScore: number;
  highScore: number;
  activeUsers: number;
  topWeaknesses: Array<{ name: string; count: number }>;
  trend: Array<{ date: string; score: number; count: number }>;
}

export default function AdminPage() {
  const { t } = useI18n();
  const [users, setUsers] = useState<UserStat[]>([]);
  const [stats, setStats] = useState<TeamStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [pageSize] = useState(10);

  useEffect(() => {
    async function fetchData() {
      try {
        const [usersRes, statsRes] = await Promise.all([
          fetch(`/api/admin/users?page=${currentPage}&limit=${pageSize}`),
          fetch('/api/admin/stats'),
        ]);
        const usersData = await usersRes.json();
        const statsData = await statsRes.json();

        if (usersData.success) {
          setUsers(usersData.data || []);
          setTotalPages(usersData.pagination?.totalPages || 1);
        }
        if (statsData.success) {
          setStats(statsData.data);
        }
      } catch (err) {
        console.error('Failed to fetch admin data:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [currentPage, pageSize]);

  const scoreColor = (score: number) => {
    if (score >= 70) return 'text-[#00ff88]';
    if (score >= 40) return 'text-[#ffaa00]';
    return 'text-[#ff4444]';
  };

  const weaknessLabel = (w: string) => {
    const labels: Record<string, string> = {
      greeting: 'Greeting',
      productInfo: 'Product Info',
      trustBuilding: 'Trust Build',
      language: 'Language',
      logistics: 'Logistics',
      closing: 'Closing',
      negotiation: 'Negotiation',
      conversation: 'Conversation',
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
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold text-white">{'\u{1F451}'} {t('admin.title')}</h1>
          <Link href="/" className="text-[#888899] hover:text-white text-sm">&larr; {t('common.back')}</Link>
        </div>

        {/* Team Overview Stats */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <div className="bg-[#141420] rounded-xl border border-[#1e1e2e] p-4 text-center">
              <div className="text-2xl font-bold text-white font-mono">{stats.totalUsers}</div>
              <div className="text-xs text-[#888899]">员工总数</div>
            </div>
            <div className="bg-[#141420] rounded-xl border border-[#1e1e2e] p-4 text-center">
              <div className="text-2xl font-bold text-white font-mono">{stats.totalTrainings}</div>
              <div className="text-xs text-[#888899]">训练总次数</div>
            </div>
            <div className="bg-[#141420] rounded-xl border border-[#1e1e2e] p-4 text-center">
              <div className={`text-2xl font-bold font-mono ${scoreColor(stats.avgScore)}`}>{stats.avgScore}</div>
              <div className="text-xs text-[#888899]">团队平均分</div>
            </div>
            <div className="bg-[#141420] rounded-xl border border-[#1e1e2e] p-4 text-center">
              <div className="text-2xl font-bold text-[#00ff88] font-mono">{stats.activeUsers}</div>
              <div className="text-xs text-[#888899]">7日活跃</div>
            </div>
          </div>
        )}

        {/* Team Weaknesses */}
        {stats && stats.topWeaknesses.length > 0 && (
          <div className="bg-[#141420] rounded-xl border border-[#1e1e2e] p-4 mb-6">
            <h2 className="text-sm font-semibold text-white mb-3">团队薄弱环节</h2>
            <div className="flex flex-wrap gap-2">
              {stats.topWeaknesses.map((w, i) => (
                <div key={i} className="flex items-center gap-2 px-3 py-1.5 bg-[#ff4444]/10 border border-[#ff4444]/20 rounded-lg">
                  <span className="text-sm text-[#ff4444] font-medium">{weaknessLabel(w.name)}</span>
                  <span className="text-xs text-[#888899]">{w.count}次</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Score Trend */}
        {stats && stats.trend.some(d => d.count > 0) && (
          <div className="bg-[#141420] rounded-xl border border-[#1e1e2e] p-4 mb-6">
            <h2 className="text-sm font-semibold text-white mb-3">近14天分数趋势</h2>
            <div className="flex items-end gap-1 h-20">
              {stats.trend.map((point, i) => {
                const height = point.count > 0 ? Math.max(10, (point.score / 110) * 100) : 5;
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1 group relative">
                    <div
                      className={`w-full rounded-t transition-all ${point.count > 0 ? 'bg-[#00ff88]/60' : 'bg-[#1e1e2e]'}`}
                      style={{ height: `${height}%` }}
                    />
                    {/* Tooltip */}
                    <div className="absolute bottom-full mb-1 hidden group-hover:block bg-[#1e1e2e] border border-[#2e2e3e] rounded px-2 py-1 text-xs text-white whitespace-nowrap z-10">
                      {point.date.slice(5)}: {point.count > 0 ? `${point.score}分 (${point.count}次)` : '无训练'}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Employee List */}
        {users.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-[#888899]">No employees found. Add users to the database.</p>
          </div>
        ) : (
          <div className="bg-[#141420] rounded-xl border border-[#1e1e2e] overflow-hidden">
            <h2 className="text-sm font-semibold text-white px-4 pt-4 pb-2">员工列表</h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#1e1e2e]">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-[#888899]">{t('admin.name')}</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-[#888899]">{t('admin.trainings')}</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-[#888899]">{t('admin.avgScore')}</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-[#888899]">{t('admin.weaknesses')}</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id} className="border-b border-[#1e1e2e]/50 hover:bg-[#1e1e2e]/30">
                      <td className="px-4 py-3">
                        <div className="text-white text-sm font-medium">{user.name}</div>
                        <div className="text-[#888899] text-xs">{user.email}</div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-white text-sm font-mono">{user.totalTrainings}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-sm font-mono font-bold ${user.totalTrainings > 0 ? scoreColor(user.avgScore) : 'text-[#888899]'}`}>
                          {user.totalTrainings > 0 ? user.avgScore : '-'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {user.topWeaknesses.length > 0 ? (
                            user.topWeaknesses.map((w, i) => (
                              <span key={i} className="px-2 py-0.5 bg-[#ff4444]/10 border border-[#ff4444]/20 rounded text-[#ff4444] text-xs">
                                {weaknessLabel(w)}
                              </span>
                            ))
                          ) : (
                            <span className="text-[#888899] text-xs">-</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-4 pb-4">
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  pageSize={pageSize}
                  onPageChange={setCurrentPage}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
