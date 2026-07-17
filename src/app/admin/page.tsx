'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useI18n } from '@/lib/i18n';

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

export default function AdminPage() {
  const { t } = useI18n();
  const [users, setUsers] = useState<UserStat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchUsers() {
      try {
        const res = await fetch('/api/admin/users');
        const data = await res.json();
        if (data.success) {
          setUsers(data.data || []);
        }
      } catch (err) {
        console.error('Failed to fetch users:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchUsers();
  }, []);

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

  return (
    <div className="min-h-screen bg-[#0a0a0f] px-4 py-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold text-white">{'\u{1F451}'} {t('admin.title')}</h1>
          <Link href="/" className="text-[#888899] hover:text-white text-sm">&larr; {t('common.back')}</Link>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="w-8 h-8 border-2 border-[#00ff88] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-[#888899]">{t('common.loading')}</p>
          </div>
        ) : users.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-[#888899]">No employees found. Add users to the database.</p>
          </div>
        ) : (
          <div className="bg-[#141420] rounded-xl border border-[#1e1e2e] overflow-hidden">
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
        )}
      </div>
    </div>
  );
}
