'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useI18n } from '@/lib/i18n';

interface CaseItem {
  id: string;
  title: string;
  description: string;
  product_type: string;
  difficulty: number;
  tags: string[];
  practice_count: number;
  created_at: string;
}

export default function CasesPage() {
  const [cases, setCases] = useState<CaseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const { t, toggleLocale } = useI18n();

  useEffect(() => {
    fetch('/api/cases')
      .then(r => r.json())
      .then(data => {
        if (data.success) setCases(data.data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

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
          <h1 className="text-lg font-bold text-white">{t('cases.title')}</h1>
          <p className="text-xs text-[#888899]">{t('cases.subtitle')}</p>
        </div>
        <button onClick={toggleLocale} className="px-2 py-1 rounded bg-[#141420] border border-[#1e1e2e] text-[10px] text-[#888899] hover:text-[#00ff88] hover:border-[#00ff88]/30 transition-all">
          {t('lang.switch')}
        </button>
      </div>

      {/* Cases List */}
      {loading ? (
        <div className="text-center py-12">
          <p className="text-[#888899]">{t('common.loading')}</p>
        </div>
      ) : cases.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-4xl mb-4">{'\u{1F4DA}'}</div>
          <p className="text-[#888899] mb-4">{t('cases.empty')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {cases.map((c) => (
            <Link
              key={c.id}
              href={`/cases/${c.id}`}
              className="block bg-[#141420] rounded-xl border border-[#1e1e2e] p-4 hover:border-[#4488ff]/30 transition-colors"
            >
              <div className="flex items-start justify-between mb-2">
                <h3 className="text-sm font-semibold text-white">{c.title}</h3>
                <div className="flex gap-0.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <span key={i} className={`text-xs ${i < c.difficulty ? 'text-[#ffaa00]' : 'text-[#2a2a3a]'}`}>
                      {'\u2605'}
                    </span>
                  ))}
                </div>
              </div>
              {c.description && (
                <p className="text-xs text-[#888899] mb-2">{c.description}</p>
              )}
              <div className="flex items-center gap-3 text-[10px] text-[#555566]">
                <span>{c.product_type}</span>
                <span>{c.practice_count} {t('cases.practiceCount')}</span>
              </div>
              {c.tags && c.tags.length > 0 && (
                <div className="flex gap-1 mt-2">
                  {c.tags.map((tag, i) => (
                    <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-[#1e1e2e] text-[#888899]">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
