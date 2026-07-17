'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useI18n } from '@/lib/i18n';

export default function HelpPage() {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [buyerType, setBuyerType] = useState('');
  const [productType, setProductType] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const { t, toggleLocale } = useI18n();

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
        setSubmitted(true);
      }
    } catch (err) {
      console.error('Failed to submit:', err);
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center px-4">
        <div className="text-center">
          <div className="text-4xl mb-4">{'\u2705'}</div>
          <h2 className="text-xl font-bold text-white mb-2">{t('help.submitted')}</h2>
          <Link href="/" className="mt-4 inline-block px-4 py-2 bg-[#00ff88] text-black text-sm font-semibold rounded-lg">
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
          <label className="text-xs text-[#888899] mb-1 block">Title *</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t('help.placeholder')}
            className="w-full bg-[#141420] border border-[#1e1e2e] rounded-lg px-3 py-2.5 text-sm text-white placeholder-[#555566] focus:outline-none focus:border-[#4488ff]/50"
          />
        </div>

        <div>
          <label className="text-xs text-[#888899] mb-1 block">Details</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t('help.placeholder')}
            rows={4}
            className="w-full bg-[#141420] border border-[#1e1e2e] rounded-lg px-3 py-2.5 text-sm text-white placeholder-[#555566] focus:outline-none focus:border-[#4488ff]/50 resize-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-[#888899] mb-1 block">Buyer Type</label>
            <input
              type="text"
              value={buyerType}
              onChange={(e) => setBuyerType(e.target.value)}
              placeholder="e.g. Bargain hunter"
              className="w-full bg-[#141420] border border-[#1e1e2e] rounded-lg px-3 py-2.5 text-sm text-white placeholder-[#555566] focus:outline-none focus:border-[#4488ff]/50"
            />
          </div>
          <div>
            <label className="text-xs text-[#888899] mb-1 block">Product</label>
            <input
              type="text"
              value={productType}
              onChange={(e) => setProductType(e.target.value)}
              placeholder="e.g. iPhone 14 Pro"
              className="w-full bg-[#141420] border border-[#1e1e2e] rounded-lg px-3 py-2.5 text-sm text-white placeholder-[#555566] focus:outline-none focus:border-[#4488ff]/50"
            />
          </div>
        </div>

        <button
          onClick={handleSubmit}
          disabled={loading || !title.trim()}
          className="w-full py-3 bg-[#4488ff] text-white font-semibold rounded-lg text-sm disabled:opacity-30 transition-opacity"
        >
          {loading ? t('help.submitting') : t('help.submit')}
        </button>
      </div>
    </div>
  );
}
