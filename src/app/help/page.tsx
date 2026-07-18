'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useI18n } from '@/lib/i18n';

interface HelpRequest {
  id: string;
  title: string;
  description: string;
  buyer_type: string;
  product_type: string;
  status: string;
  ai_suggestion: string | null;
  created_at: string;
}

export default function HelpPage() {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [buyerType, setBuyerType] = useState('');
  const [productType, setProductType] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [lastSuggestion, setLastSuggestion] = useState<string | null>(null);
  const [history, setHistory] = useState<HelpRequest[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const { t, toggleLocale } = useI18n();

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      const res = await fetch('/api/help-requests');
      const data = await res.json();
      if (data.success) {
        setHistory(data.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch history:', err);
    }
  };

  const handleSubmit = async () => {
    if (!title.trim()) return;
    setLoading(true);
    try {
      const res = await fetch('/api/help-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description,
          buyerType,
          productType,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setLastSuggestion(data.data.ai_suggestion || null);
        setSubmitted(true);
        fetchHistory(); // Refresh history
      }
    } catch (err) {
      console.error('Failed to submit:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setTitle('');
    setDescription('');
    setBuyerType('');
    setProductType('');
    setSubmitted(false);
    setLastSuggestion(null);
  };

  if (submitted) {
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
            <h1 className="text-lg font-bold text-white">{t('help.submitted')}</h1>
          </div>
          <button onClick={toggleLocale} className="px-2 py-1 rounded bg-[#141420] border border-[#1e1e2e] text-[10px] text-[#888899] hover:text-[#00ff88] hover:border-[#00ff88]/30 transition-all">
            {t('lang.switch')}
          </button>
        </div>

        {/* Success Icon */}
        <div className="text-center py-6">
          <div className="text-5xl mb-4">{'\u2705'}</div>
          <p className="text-[#888899] text-sm">AI 已分析你的问题</p>
        </div>

        {/* AI Suggestion */}
        {lastSuggestion && (
          <div className="bg-[#141420] rounded-xl border border-[#00ff88]/30 p-4 mb-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-lg">{'\u{1F468}\u200D\u{1F3EB}'}</span>
              <span className="text-sm font-semibold text-[#00ff88]">AI 教练建议</span>
            </div>
            <div className="text-sm text-[#ccccdd] whitespace-pre-wrap leading-relaxed">
              {lastSuggestion}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={handleReset}
            className="flex-1 px-4 py-3 bg-[#00ff88] text-black text-sm font-semibold rounded-xl"
          >
            继续求助
          </button>
          <Link
            href="/"
            className="flex-1 px-4 py-3 bg-[#141420] border border-[#1e1e2e] text-white text-sm font-semibold rounded-xl text-center"
          >
            {t('common.back')}
          </Link>
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
          <h1 className="text-lg font-bold text-white">{t('help.title')}</h1>
          <p className="text-xs text-[#888899]">{t('help.subtitle')}</p>
        </div>
        <button onClick={toggleLocale} className="px-2 py-1 rounded bg-[#141420] border border-[#1e1e2e] text-[10px] text-[#888899] hover:text-[#00ff88] hover:border-[#00ff88]/30 transition-all">
          {t('lang.switch')}
        </button>
      </div>

      {/* Form */}
      <div className="space-y-4">
        <div>
          <label className="text-xs text-[#888899] mb-1 block">问题标题 *</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t('help.placeholder')}
            className="w-full px-3 py-2.5 bg-[#141420] border border-[#1e1e2e] rounded-xl text-white text-sm placeholder:text-[#555] focus:outline-none focus:border-[#00ff88]/50"
          />
        </div>

        <div>
          <label className="text-xs text-[#888899] mb-1 block">详细描述</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="买家说了什么？你的回复是什么？遇到了什么困难？"
            rows={4}
            className="w-full px-3 py-2.5 bg-[#141420] border border-[#1e1e2e] rounded-xl text-white text-sm placeholder:text-[#555] focus:outline-none focus:border-[#00ff88]/50 resize-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-[#888899] mb-1 block">买家类型</label>
            <input
              type="text"
              value={buyerType}
              onChange={(e) => setBuyerType(e.target.value)}
              placeholder="如：砍价型"
              className="w-full px-3 py-2.5 bg-[#141420] border border-[#1e1e2e] rounded-xl text-white text-sm placeholder:text-[#555] focus:outline-none focus:border-[#00ff88]/50"
            />
          </div>
          <div>
            <label className="text-xs text-[#888899] mb-1 block">产品类型</label>
            <input
              type="text"
              value={productType}
              onChange={(e) => setProductType(e.target.value)}
              placeholder="如：iPhone 16"
              className="w-full px-3 py-2.5 bg-[#141420] border border-[#1e1e2e] rounded-xl text-white text-sm placeholder:text-[#555] focus:outline-none focus:border-[#00ff88]/50"
            />
          </div>
        </div>

        <button
          onClick={handleSubmit}
          disabled={loading || !title.trim()}
          className="w-full px-4 py-3 bg-[#00ff88] text-black text-sm font-semibold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? t('help.submitting') : t('help.submit')}
        </button>
      </div>

      {/* History Toggle */}
      {history.length > 0 && (
        <div className="mt-8">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="flex items-center gap-2 text-sm text-[#888899] hover:text-white"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 8v4l3 3" />
              <circle cx="12" cy="12" r="10" />
            </svg>
            求助历史 ({history.length})
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className={`transition-transform ${showHistory ? 'rotate-180' : ''}`}
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>

          {showHistory && (
            <div className="mt-3 space-y-3">
              {history.map((req) => (
                <div key={req.id} className="bg-[#141420] rounded-xl border border-[#1e1e2e] p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-white text-sm font-medium">{req.title}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                      req.status === 'answered' 
                        ? 'bg-[#00ff88]/10 text-[#00ff88]' 
                        : 'bg-[#ffaa00]/10 text-[#ffaa00]'
                    }`}>
                      {req.status === 'answered' ? '已回答' : '待回答'}
                    </span>
                  </div>
                  {req.description && (
                    <p className="text-xs text-[#888899] mb-2 line-clamp-2">{req.description}</p>
                  )}
                  {req.ai_suggestion && (
                    <div className="mt-2 pt-2 border-t border-[#1e1e2e]">
                      <p className="text-xs text-[#00ff88] line-clamp-3">{req.ai_suggestion}</p>
                    </div>
                  )}
                  <div className="mt-2 text-[10px] text-[#555]">
                    {new Date(req.created_at).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
