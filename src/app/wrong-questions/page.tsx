'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useI18n } from '@/lib/i18n';

interface WrongQuestion {
  id: string;
  category: string;
  original_message: string;
  user_response: string;
  ideal_response: string;
  explanation: string;
  related_dimension: string;
  is_practiced: boolean;
  practice_count: number;
}

export default function WrongQuestionsPage() {
  const [data, setData] = useState<{
    all: WrongQuestion[];
    grouped: Record<string, WrongQuestion[]>;
    categories: string[];
    total: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const { t, toggleLocale } = useI18n();

  useEffect(() => {
    fetch('/api/wrong-questions')
      .then(r => r.json())
      .then(d => {
        if (d.success) setData(d.data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const filteredQuestions = selectedCategory
    ? data?.grouped[selectedCategory] || []
    : data?.all || [];

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
          <h1 className="text-lg font-bold text-white">{t('wrong.title')}</h1>
          <p className="text-xs text-[#888899]">
            {data ? `${data.total} ${t('wrong.subtitle').toLowerCase()}` : t('common.loading')}
          </p>
        </div>
        <button onClick={toggleLocale} className="px-2 py-1 rounded bg-[#141420] border border-[#1e1e2e] text-[10px] text-[#888899] hover:text-[#00ff88] hover:border-[#00ff88]/30 transition-all">
          {t('lang.switch')}
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <p className="text-[#888899]">{t('common.loading')}</p>
        </div>
      ) : !data || data.total === 0 ? (
        <div className="text-center py-12">
          <div className="text-4xl mb-4">{'\u2705'}</div>
          <p className="text-[#888899]">{t('wrong.empty')}</p>
          <Link href="/training/new" className="mt-4 inline-block px-4 py-2 bg-[#00ff88] text-black text-sm font-semibold rounded-lg">
            {t('home.menu.training')}
          </Link>
        </div>
      ) : (
        <>
          {/* Category Filter */}
          <div className="flex gap-2 overflow-x-auto pb-3 mb-4">
            <button
              onClick={() => setSelectedCategory(null)}
              className={`px-3 py-1.5 rounded-full text-xs whitespace-nowrap ${
                !selectedCategory ? 'bg-[#00ff88] text-black' : 'bg-[#141420] text-[#888899] border border-[#1e1e2e]'
              }`}
            >
              {t('wrong.all')} ({data.total})
            </button>
            {data.categories.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-full text-xs whitespace-nowrap ${
                  selectedCategory === cat ? 'bg-[#00ff88] text-black' : 'bg-[#141420] text-[#888899] border border-[#1e1e2e]'
                }`}
              >
                {cat} ({data.grouped[cat]?.length || 0})
              </button>
            ))}
          </div>

          {/* Questions List */}
          <div className="space-y-3">
            {filteredQuestions.map((q) => (
              <div key={q.id} className="bg-[#141420] rounded-xl border border-[#1e1e2e] p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#1e1e2e] text-[#888899]">
                    {q.category}
                  </span>
                  <span className={`text-[10px] ${q.is_practiced ? 'text-[#00ff88]' : 'text-[#ffaa00]'}`}>
                    {q.is_practiced ? t('wrong.practiced') : t('wrong.notPracticed')}
                  </span>
                </div>
                <div className="space-y-2 text-xs">
                  <div>
                    <span className="text-[#888899]">{t('wrong.originalMessage')}: </span>
                    <span className="text-[#ccccdd]">{q.original_message}</span>
                  </div>
                  <div>
                    <span className="text-[#888899]">{t('wrong.yourResponse')}: </span>
                    <span className="text-[#ff8888]">{q.user_response}</span>
                  </div>
                  <div>
                    <span className="text-[#888899]">{t('wrong.idealResponse')}: </span>
                    <span className="text-[#00ff88]">{q.ideal_response}</span>
                  </div>
                  {q.explanation && (
                    <div className="mt-2 pt-2 border-t border-[#1e1e2e]">
                      <span className="text-[#888899]">{t('wrong.explanation')}: </span>
                      <span className="text-[#aaaaaa]">{q.explanation}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
