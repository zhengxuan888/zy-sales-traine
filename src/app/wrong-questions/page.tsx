'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

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

const categoryLabels: Record<string, string> = {
  language_tone: 'Language & Tone',
  conciseness: 'Conciseness',
  trust_sequence: 'Trust Sequence',
  meetup_handling: 'Meetup Handling',
  payment_handling: 'Payment',
  product_info: 'Product Info',
  honesty: 'Honesty',
  negotiation: 'Negotiation',
};

export default function WrongQuestionsPage() {
  const [data, setData] = useState<{
    all: WrongQuestion[];
    grouped: Record<string, WrongQuestion[]>;
    categories: string[];
    total: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/wrong-questions?userId=default')
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
        <div>
          <h1 className="text-lg font-bold text-white">Mistakes Review</h1>
          <p className="text-xs text-[#888899]">
            {data ? `${data.total} mistakes to practice` : 'Loading...'}
          </p>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <p className="text-[#888899]">Loading...</p>
        </div>
      ) : !data || data.total === 0 ? (
        <div className="text-center py-12">
          <div className="text-4xl mb-4">{'\u2705'}</div>
          <p className="text-[#888899]">No mistakes recorded yet</p>
          <p className="text-xs text-[#555566] mt-2">Complete a training session to see your mistakes here</p>
          <Link href="/training/new" className="mt-4 inline-block px-4 py-2 bg-[#00ff88] text-black text-sm font-semibold rounded-lg">
            Start Training
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
              All ({data.total})
            </button>
            {data.categories.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-full text-xs whitespace-nowrap ${
                  selectedCategory === cat ? 'bg-[#00ff88] text-black' : 'bg-[#141420] text-[#888899] border border-[#1e1e2e]'
                }`}
              >
                {categoryLabels[cat] || cat} ({data.grouped[cat]?.length || 0})
              </button>
            ))}
          </div>

          {/* Questions List */}
          <div className="space-y-3">
            {filteredQuestions.map((q) => (
              <div
                key={q.id}
                className="bg-[#141420] rounded-xl border border-[#1e1e2e] p-4"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/10 text-red-300">
                    {categoryLabels[q.category] || q.category}
                  </span>
                  <span className="text-[10px] text-[#555566]">
                    Practiced {q.practice_count}x
                  </span>
                </div>
                {q.user_response && (
                  <div className="mb-2">
                    <div className="text-[10px] text-red-400 mb-1">Your response:</div>
                    <div className="text-xs text-[#ccccdd] bg-red-500/5 rounded p-2">{q.user_response}</div>
                  </div>
                )}
                {q.ideal_response && (
                  <div className="mb-2">
                    <div className="text-[10px] text-[#00ff88] mb-1">Ideal response:</div>
                    <div className="text-xs text-[#ccccdd] bg-green-500/5 rounded p-2">{q.ideal_response}</div>
                  </div>
                )}
                {q.explanation && (
                  <p className="text-xs text-[#888899] italic">{q.explanation}</p>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
