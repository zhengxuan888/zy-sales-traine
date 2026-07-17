'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useI18n } from '@/lib/i18n';

interface CoachIssue {
  id: number;
  messageRef: number;
  dimension: string;
  problem: string;
  severity: string;
  suggestion: string;
}

interface CoachExample {
  scenario: string;
  badResponse: string;
  goodResponse: string;
  explanation: string;
}

interface ScoreBreakdown {
  [key: string]: {
    score: number;
    maxScore: number;
    deductions: Array<{ reason: string }>;
    highlights: string[];
  };
}

export default function ReviewPage() {
  const params = useParams();
  const router = useRouter();
  const trainingId = params.id as string;
  const { t, toggleLocale } = useI18n();

  const [loading, setLoading] = useState(true);
  const [review, setReview] = useState<{
    finalScore: {
      ruleScore: number;
      aiScore: number;
      bonus: number;
      total: number;
      breakdown: ScoreBreakdown;
      weaknesses: string[];
    };
    coachReview: string;
    issues: CoachIssue[];
    examples: CoachExample[];
  } | null>(null);

  useEffect(() => {
    const fetchReview = async () => {
      try {
        const res = await fetch(`/api/training/${trainingId}/complete`, { method: 'POST' });
        const data = await res.json();
        if (data.success) {
          setReview(data);
        }
      } catch (err) {
        console.error('Failed to fetch review:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchReview();
  }, [trainingId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0f]">
        <div className="text-center">
          <div className="text-4xl mb-4">{'\u{1F468}\u200D\u{1F3EB}'}</div>
          <h2 className="text-xl font-bold text-white mb-2">{t('review.loading')}</h2>
          <p className="text-[#888899] text-sm">{t('review.title')}</p>
        </div>
      </div>
    );
  }

  if (!review) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0f] px-4">
        <div className="text-center">
          <p className="text-[#888899]">{t('review.failed')}</p>
          <button onClick={() => router.push('/')} className="mt-4 text-[#00ff88] text-sm">
            {t('common.back')}
          </button>
        </div>
      </div>
    );
  }

  const { finalScore, coachReview, issues, examples } = review;

  const dimensionLabels: Record<string, string> = {
    greeting: 'Greeting',
    productInfo: 'Product Info',
    trustBuilding: 'Trust Building',
    negotiation: 'Negotiation',
    logistics: 'Logistics',
    closing: 'Closing',
    language: 'Language & Tone',
    sopCompliance: 'SOP',
  };

  const getScoreColor = (score: number, max: number) => {
    const ratio = score / max;
    if (ratio >= 0.8) return 'text-[#00ff88]';
    if (ratio >= 0.6) return 'text-[#ffaa00]';
    return 'text-[#ff4444]';
  };

  const getGradeColor = (total: number) => {
    if (total >= 90) return 'text-[#00ff88]';
    if (total >= 75) return 'text-[#4488ff]';
    if (total >= 60) return 'text-[#ffaa00]';
    return 'text-[#ff4444]';
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] px-4 py-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <button onClick={toggleLocale} className="px-2 py-1 rounded bg-[#141420] border border-[#1e1e2e] text-[10px] text-[#888899] hover:text-[#00ff88] hover:border-[#00ff88]/30 transition-all">
          {t('lang.switch')}
        </button>
        <div className="text-center flex-1">
          <h1 className="text-xl font-bold text-white mb-1">{t('review.title')}</h1>
          <p className="text-xs text-[#888899]">AI Coach</p>
        </div>
        <div className="w-12" />
      </div>

      {/* Total Score */}
      <div className="bg-[#141420] rounded-xl border border-[#1e1e2e] p-6 mb-4 text-center">
        <div className={`text-5xl font-bold font-mono ${getGradeColor(finalScore.total)}`}>
          {finalScore.total}
        </div>
        <div className="text-xs text-[#888899] mt-1">/ 110 points</div>
        <div className="flex justify-center gap-6 mt-4">
          <div>
            <div className="text-lg font-mono text-[#4488ff]">{finalScore.ruleScore}</div>
            <div className="text-[10px] text-[#888899]">Rule (60)</div>
          </div>
          <div>
            <div className="text-lg font-mono text-[#aa88ff]">{finalScore.aiScore}</div>
            <div className="text-[10px] text-[#888899]">AI (40)</div>
          </div>
          <div>
            <div className="text-lg font-mono text-[#ffaa00]">{finalScore.bonus}</div>
            <div className="text-[10px] text-[#888899]">Bonus (10)</div>
          </div>
        </div>
      </div>

      {/* Score Breakdown */}
      <div className="bg-[#141420] rounded-xl border border-[#1e1e2e] p-4 mb-4">
        <h2 className="text-sm font-semibold text-white mb-3">Score Breakdown</h2>
        <div className="space-y-2">
          {Object.entries(finalScore.breakdown).map(([key, dim]) => (
            <div key={key} className="flex items-center gap-3">
              <span className="text-xs text-[#888899] w-24 shrink-0">
                {dimensionLabels[key] || key}
              </span>
              <div className="flex-1 h-2 bg-[#1e1e2e] rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${
                    dim.score / dim.maxScore >= 0.8 ? 'bg-[#00ff88]' :
                    dim.score / dim.maxScore >= 0.6 ? 'bg-[#ffaa00]' : 'bg-[#ff4444]'
                  }`}
                  style={{ width: `${(dim.score / dim.maxScore) * 100}%` }}
                />
              </div>
              <span className={`text-xs font-mono w-12 text-right ${getScoreColor(dim.score, dim.maxScore)}`}>
                {dim.score}/{dim.maxScore}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Coach Review */}
      <div className="bg-[#141420] rounded-xl border border-[#1e1e2e] p-4 mb-4">
        <h2 className="text-sm font-semibold text-white mb-2">{t('review.suggestions')}</h2>
        <p className="text-sm text-[#ccccdd] leading-relaxed">{coachReview}</p>
      </div>

      {/* Issues */}
      {issues.length > 0 && (
        <div className="bg-[#141420] rounded-xl border border-[#1e1e2e] p-4 mb-4">
          <h2 className="text-sm font-semibold text-white mb-3">
            {t('review.issues')} ({issues.length})
          </h2>
          <div className="space-y-3">
            {issues.map((issue) => (
              <div
                key={issue.id}
                className={`p-3 rounded-lg border ${
                  issue.severity === 'severe'
                    ? 'border-red-500/30 bg-red-500/5'
                    : issue.severity === 'moderate'
                    ? 'border-orange-500/30 bg-orange-500/5'
                    : 'border-yellow-500/30 bg-yellow-500/5'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-white">
                    #{issue.id} - Message #{issue.messageRef}
                  </span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                    issue.severity === 'severe' ? 'bg-red-500/20 text-red-300' :
                    issue.severity === 'moderate' ? 'bg-orange-500/20 text-orange-300' :
                    'bg-yellow-500/20 text-yellow-300'
                  }`}>
                    {issue.severity}
                  </span>
                </div>
                <div className="text-xs text-[#888899] mb-1">{issue.dimension}</div>
                <div className="text-sm text-[#ccccdd]">{issue.problem}</div>
                <div className="text-xs text-[#00ff88] mt-2">
                  Suggestion: {issue.suggestion}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Examples */}
      {examples.length > 0 && (
        <div className="bg-[#141420] rounded-xl border border-[#1e1e2e] p-4 mb-4">
          <h2 className="text-sm font-semibold text-white mb-3">{t('review.examples')}</h2>
          <div className="space-y-4">
            {examples.map((ex, i) => (
              <div key={i} className="space-y-2">
                <div className="text-xs text-[#4488ff] font-medium">{ex.scenario}</div>
                <div className="flex gap-2">
                  <div className="flex-1 p-2 rounded-lg bg-red-500/5 border border-red-500/20">
                    <div className="text-[10px] text-red-400 mb-1">Bad</div>
                    <div className="text-xs text-[#ccccdd]">{ex.badResponse}</div>
                  </div>
                  <div className="flex-1 p-2 rounded-lg bg-green-500/5 border border-green-500/20">
                    <div className="text-[10px] text-[#00ff88] mb-1">Good</div>
                    <div className="text-xs text-[#ccccdd]">{ex.goodResponse}</div>
                  </div>
                </div>
                <div className="text-xs text-[#888899] italic">{ex.explanation}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3 mt-6 mb-8">
        <button
          onClick={() => router.push('/training/new')}
          className="flex-1 py-3 bg-[#00ff88] text-black font-semibold rounded-lg text-sm"
        >
          {t('review.retry')}
        </button>
        <button
          onClick={() => router.push('/')}
          className="flex-1 py-3 bg-[#141420] border border-[#1e1e2e] text-white font-semibold rounded-lg text-sm"
        >
          {t('review.backHome')}
        </button>
      </div>
    </div>
  );
}
