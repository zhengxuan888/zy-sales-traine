'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useI18n } from '@/lib/i18n';

interface Message {
  id: string;
  role: 'buyer' | 'seller' | 'system';
  content: string;
  messageOrder: number;
  scoreSignals?: Array<{ type: string; dimension: string; points: number; reason: string }>;
  deductionPoints?: Array<{ dimension: string; points: number; reason: string; severity: string }>;
  isFlagged?: boolean;
}

interface DeductionAlert {
  id: string;
  messageRef: number;
  dimension: string;
  points: number;
  reason: string;
  severity: string;
  timestamp: number;
}

export default function TrainingPage() {
  const params = useParams();
  const router = useRouter();
  const trainingId = params.id as string;
  const { t, toggleLocale } = useI18n();

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionStarted, setSessionStarted] = useState(false);
  const [currentScore, setCurrentScore] = useState(0);
  const [conversationState, setConversationState] = useState('INITIAL');
  const [isPaused, setIsPaused] = useState(false);
  const [deductionAlerts, setDeductionAlerts] = useState<DeductionAlert[]>([]);
  const [buyerPersona, setBuyerPersona] = useState('');
  const [scenario, setScenario] = useState('');
  const [error, setError] = useState('');
  const [messageCount, setMessageCount] = useState(0);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Start training session
  const startSession = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/training/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'free_training' }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      setMessages([{
        id: 'first',
        role: 'buyer',
        content: data.firstMessage,
        messageOrder: 1,
      }]);
      setBuyerPersona(data.buyerPersona);
      setScenario(data.scenario);
      setSessionStarted(true);
      setMessageCount(1);

      // Redirect to the actual training ID URL
      window.history.replaceState(null, '', `/training/${data.trainingId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start session');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (trainingId === 'new') {
      startSession();
    }
  }, [trainingId, startSession]);

  // Send message
  const sendMessage = async () => {
    if (!input.trim() || loading || isPaused) return;

    const sellerMsg = input.trim();
    setInput('');
    setLoading(true);

    // Add seller message optimistically
    const sellerMessage: Message = {
      id: `seller-${Date.now()}`,
      role: 'seller',
      content: sellerMsg,
      messageOrder: messageCount + 1,
    };
    setMessages(prev => [...prev, sellerMessage]);
    setMessageCount(prev => prev + 1);

    try {
      const res = await fetch(`/api/training/${trainingId}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: sellerMsg, language: 'es' }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      // Add buyer reply
      const buyerMessage: Message = {
        id: `buyer-${Date.now()}`,
        role: 'buyer',
        content: data.buyerReply,
        messageOrder: messageCount + 2,
        scoreSignals: data.scoreSignals,
        deductionPoints: data.deductionPoints,
        isFlagged: data.isFlagged,
      };
      setMessages(prev => [...prev, buyerMessage]);
      setMessageCount(prev => prev + 1);
      setCurrentScore(data.currentScore);
      setConversationState(data.conversationState);

      // Add deduction alerts
      if (data.deductionPoints && data.deductionPoints.length > 0) {
        const newAlerts: DeductionAlert[] = data.deductionPoints.map((d: {
          dimension: string; points: number; reason: string; severity: string;
        }, i: number) => ({
          id: `alert-${Date.now()}-${i}`,
          messageRef: sellerMessage.messageOrder,
          dimension: d.dimension,
          points: d.points,
          reason: d.reason,
          severity: d.severity,
          timestamp: Date.now(),
        }));
        setDeductionAlerts(prev => [...newAlerts, ...prev].slice(0, 20));
      }

      // Check if conversation ended
      if (data.conversationState === 'COMPLETED' || data.conversationState === 'GHOSTED') {
        setTimeout(() => {
          router.push(`/training/${trainingId}/review`);
        }, 2000);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message');
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  // End training
  const endTraining = async () => {
    setLoading(true);
    try {
      await fetch(`/api/training/${trainingId}/complete`, { method: 'POST' });
      router.push(`/training/${trainingId}/review`);
    } catch {
      setError('Failed to end training');
    } finally {
      setLoading(false);
    }
  };

  // Start screen
  if (!sessionStarted && trainingId === 'new') {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center">
          <div className="text-4xl mb-4">{'\u{1F3AF}'}</div>
          <h2 className="text-xl font-bold text-white mb-2">{t('common.loading')}</h2>
          <p className="text-[#888899] text-sm">{t('training.title')}</p>
          {error && <p className="text-red-400 text-sm mt-4">{error}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-[#0a0a0f]">
      {/* Top Bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#1e1e2e] bg-[#0d0d14]">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/')}
            className="text-[#888899] hover:text-white transition-colors"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <div className="text-sm font-semibold text-white">{buyerPersona || 'Loading...'}</div>
            <div className="text-xs text-[#888899]">{scenario || 'Starting...'}</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Language Switch */}
          <button
            onClick={toggleLocale}
            className="px-2 py-1 rounded bg-[#141420] border border-[#1e1e2e] text-[10px] text-[#888899] hover:text-[#00ff88] hover:border-[#00ff88]/30 transition-all"
          >
            {t('lang.switch')}
          </button>
          {/* Score */}
          <div className="text-right">
            <div className="text-lg font-bold font-mono text-[#00ff88]">{currentScore}</div>
            <div className="text-[10px] text-[#888899]">SCORE</div>
          </div>
          {/* State indicator */}
          <div className="px-2 py-1 rounded bg-[#141420] border border-[#1e1e2e]">
            <div className="text-[10px] text-[#888899]">{conversationState}</div>
          </div>
        </div>
      </div>

      {/* Main Content - Split View */}
      <div className="flex-1 flex overflow-hidden">
        {/* Chat Area */}
        <div className="flex-1 flex flex-col">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === 'seller' ? 'justify-end' : 'justify-start'} animate-slide-up`}
              >
                <div
                  className={`max-w-[80%] px-3 py-2 ${
                    msg.role === 'buyer' ? 'bubble-buyer' : 'bubble-seller'
                  }`}
                >
                  {msg.role === 'buyer' && (
                    <div className="text-[10px] text-[#4488ff] mb-1 font-medium">{t('training.buyer')}</div>
                  )}
                  <p className="text-sm text-[#e0e0e0] whitespace-pre-wrap">{msg.content}</p>
                  <div className="text-[10px] text-[#555566] mt-1 text-right">#{msg.messageOrder}</div>
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start animate-fade-in">
                <div className="bubble-buyer px-4 py-3">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-[#4488ff] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-2 h-2 bg-[#4488ff] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-2 h-2 bg-[#4488ff] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="px-4 py-3 border-t border-[#1e1e2e] bg-[#0d0d14]">
            {isPaused ? (
              <div className="flex items-center justify-center gap-3">
                <span className="text-sm text-[#888899]">{t('training.paused')}</span>
                <button
                  onClick={() => setIsPaused(false)}
                  className="px-4 py-2 bg-[#00ff88] text-black text-sm font-semibold rounded-lg"
                >
                  {t('common.resume')}
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                  placeholder={t('training.inputPlaceholder')}
                  className="flex-1 bg-[#141420] border border-[#1e1e2e] rounded-lg px-3 py-2.5 text-sm text-white placeholder-[#555566] focus:outline-none focus:border-[#00ff88]/50"
                  disabled={loading}
                />
                <button
                  onClick={sendMessage}
                  disabled={loading || !input.trim()}
                  className="px-4 py-2.5 bg-[#00ff88] text-black text-sm font-semibold rounded-lg disabled:opacity-30 transition-opacity"
                >
                  {t('common.send')}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right Panel - Deduction Alerts (desktop only) */}
        <div className="hidden md:flex w-72 flex-col border-l border-[#1e1e2e] bg-[#0d0d14]">
          <div className="px-4 py-3 border-b border-[#1e1e2e]">
            <h3 className="text-sm font-semibold text-white">{t('training.deductions')}</h3>
            <p className="text-xs text-[#888899]">Real-time</p>
          </div>
          <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
            {deductionAlerts.length === 0 ? (
              <div className="text-center text-xs text-[#555566] mt-8">
                {t('training.noDeductions')}
              </div>
            ) : (
              deductionAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className={`p-2 rounded-lg border text-xs animate-slide-up ${
                    alert.severity === 'severe'
                      ? 'bg-red-500/10 border-red-500/30'
                      : alert.severity === 'moderate'
                      ? 'bg-orange-500/10 border-orange-500/30'
                      : 'bg-yellow-500/10 border-yellow-500/30'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-white">-{alert.points}pts</span>
                    <span className="text-[#888899]">Msg #{alert.messageRef}</span>
                  </div>
                  <div className="text-[#888899]">{alert.dimension}</div>
                  <div className="text-[#aaaaaa] mt-1">{alert.reason}</div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Bottom Controls */}
      <div className="flex items-center justify-between px-4 py-2 border-t border-[#1e1e2e] bg-[#0d0d14]">
        <button
          onClick={() => setIsPaused(!isPaused)}
          className="text-xs text-[#888899] hover:text-white transition-colors"
        >
          {isPaused ? t('common.resume') : t('common.pause')}
        </button>
        <div className="text-xs text-[#555566]">
          {messageCount} {t('scores.messages')}
        </div>
        <button
          onClick={endTraining}
          disabled={loading}
          className="text-xs text-[#ff4444] hover:text-red-300 transition-colors disabled:opacity-30"
        >
          {t('training.endTraining')}
        </button>
      </div>

      {/* Error toast */}
      {error && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 bg-red-500/90 text-white text-sm px-4 py-2 rounded-lg animate-slide-up">
          {error}
        </div>
      )}
    </div>
  );
}
