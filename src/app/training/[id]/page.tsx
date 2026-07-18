'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useI18n } from '@/lib/i18n';

interface Deduction {
  dimension: string;
  points: number;
  reason: string;
  severity: string;
  messageRef: number;
}

interface ChatMsg {
  id: string;
  role: 'buyer' | 'seller';
  content: string;
  messageOrder: number;
  deductions?: Deduction[];
}

export default function TrainingPage() {
  const { t } = useI18n();
  const params = useParams();
  const router = useRouter();
  const paramId = params.id as string;
  // Local state so we can update after training starts (params.id stays 'new')
  const [sessionId, setSessionId] = useState(paramId);
  const isNew = sessionId === 'new';

  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [starting, setStarting] = useState(true);
  const [error, setError] = useState('');
  const [deductions, setDeductions] = useState<Deduction[]>([]);
  const [runningScore, setRunningScore] = useState(100);
  const [currentState, setCurrentState] = useState('INITIAL');
  const [buyerPersona, setBuyerPersona] = useState<{ name: string; difficulty: string } | null>(null);
  const [paused, setPaused] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const initializedRef = useRef(false);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Initialize training session
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    if (isNew) {
      startNewTraining();
    } else {
      loadExistingSession();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function startNewTraining() {
    try {
      setStarting(true);
      setError('');

      // Directly call training start - backend handles all fallbacks
      const res = await fetch('/api/training/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to start training');
      handleStartResponse(data);
    } catch (err) {
      console.error('Start error:', err);
      setError(err instanceof Error ? err.message : 'Failed to start training. Please try again.');
      setStarting(false);
    }
  }

  function handleStartResponse(data: { data?: Record<string, unknown> }) {
    const d = data.data;
    if (!d) throw new Error('Invalid response');

    const newSessionId = d.sessionId as string;

    // Update React state FIRST so subsequent requests use the real ID
    setSessionId(newSessionId);

    // Replace URL with session ID
    window.history.replaceState(null, '', `/training/${newSessionId}`);

    setBuyerPersona(d.buyerPersona as { name: string; difficulty: string } || null);
    setCurrentState('INITIAL');
    setRunningScore(100);
    setDeductions([]);

    // Add greeting message
    const greeting = (d.buyerGreeting as string) || 'Hi!';
    setMessages([{
      id: 'greeting',
      role: 'buyer',
      content: greeting,
      messageOrder: 1,
    }]);
    setStarting(false);
  }

  async function loadExistingSession() {
    try {
      setStarting(true);
      // Direct lookup via GET /api/training/[id]
      const res = await fetch(`/api/training/${sessionId}`);
      if (res.status === 404) {
        setError('Session not found');
        setStarting(false);
        return;
      }
      const data = await res.json();
      if (!data.success) {
        setError(data.message || 'Failed to load session');
        setStarting(false);
        return;
      }

      const session = data.data;
      setCurrentState(session.currentState || 'INITIAL');
      setBuyerPersona(session.buyerPersona?.name ? { name: session.buyerPersona.name, difficulty: 'medium' } : null);
      setRunningScore(session.runningScore ?? 100);

      // Load messages
      const msgs = session.messages || [];
      if (msgs.length > 0) {
        setMessages(msgs.map((m: Record<string, unknown>, i: number) => ({
          id: String(m.id || i),
          role: (m.role as 'buyer' | 'seller') || 'buyer',
          content: String(m.content || ''),
          messageOrder: (m.messageOrder as number) || i + 1,
          deductions: (m.deductions as Array<{dimension: string; points: number; reason: string; severity: string; messageRef: number}>) || [],
        })));
      } else {
        setMessages([{
          id: 'info',
          role: 'buyer',
          content: 'Training session loaded. Start chatting!',
          messageOrder: 1,
        }]);
      }
      setStarting(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load session');
      setStarting(false);
    }
  }

  async function handleSend() {
    const trimmed = input.trim();
    if (!trimmed || loading || paused) return;

    setInput('');
    setLoading(true);
    setError('');

    // Add user message to display immediately
    const userMsg: ChatMsg = {
      id: `user-${Date.now()}`,
      role: 'seller',
      content: trimmed,
      messageOrder: messages.length + 1,
    };
    setMessages(prev => [...prev, userMsg]);

    try {
      const res = await fetch(`/api/training/${sessionId}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: trimmed }),
      });

      const data = await res.json();

      if (!res.ok) {
        // Handle specific error codes
        const errorMsg = data.message || 'Failed to send message';
        setError(errorMsg);
        setLoading(false);
        return;
      }

      const d = data.data;

      // Add AI response
      const aiMsg: ChatMsg = {
        id: `ai-${Date.now()}`,
        role: 'buyer',
        content: d.aiMessage || 'OK',
        messageOrder: messages.length + 2,
      };
      setMessages(prev => [...prev, aiMsg]);

      // Update deductions
      if (d.deductions && d.deductions.length > 0) {
        setDeductions(prev => [...prev, ...d.deductions]);
      }

      // Update running score
      if (typeof d.runningScore === 'number') {
        setRunningScore(d.runningScore);
      }

      // Update state
      if (d.newState) {
        setCurrentState(d.newState);
      }
    } catch (err) {
      console.error('Send error:', err);
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleEndTraining() {
    try {
      setLoading(true);
      const res = await fetch(`/api/training/${sessionId}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      if (res.ok) {
        // Redirect to review page
        router.push(`/training/${sessionId}/review`);
      } else {
        const data = await res.json();
        setError(data.message || 'Failed to end training');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to end training');
    } finally {
      setLoading(false);
    }
  }

  const severityColor = (severity: string) => {
    if (severity === 'severe') return 'text-[#ff4444]';
    if (severity === 'moderate') return 'text-[#ffaa00]';
    return 'text-[#888899]';
  };

  const dimensionLabel = (dim: string) => {
    const labels: Record<string, string> = {
      language_tone: 'Tone',
      conciseness: 'Length',
      trust_sequence: 'Order',
      meetup_handling: 'Meetup',
      payment_handling: 'Payment',
      product_info: 'Product',
      honesty: 'Honesty',
    };
    return labels[dim] || dim;
  };

  if (starting) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-2 border-[#00ff88] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-[#888899]">Starting training...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[#0a0a0f]/95 backdrop-blur border-b border-[#1e1e2e] px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-[#888899] hover:text-white text-sm">
            &larr;
          </Link>
          <div>
            <div className="text-white text-sm font-semibold">
              {buyerPersona?.name || 'Training'}
            </div>
            <div className="text-[#888899] text-xs">{currentState}</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Running Score */}
          <div className="text-right">
            <div className="text-xs text-[#888899]">SCORE</div>
            <div className={`text-lg font-mono font-bold ${runningScore >= 70 ? 'text-[#00ff88]' : runningScore >= 40 ? 'text-[#ffaa00]' : 'text-[#ff4444]'}`}>
              {runningScore}
            </div>
          </div>
          <button
            onClick={() => setPaused(!paused)}
            className="px-3 py-1.5 bg-[#141420] border border-[#1e1e2e] rounded-lg text-[#888899] text-xs hover:text-white"
          >
            {paused ? 'Resume' : 'Pause'}
          </button>
          <button
            onClick={handleEndTraining}
            disabled={loading}
            className="px-3 py-1.5 bg-[#ff4444]/20 border border-[#ff4444]/40 rounded-lg text-[#ff4444] text-xs font-semibold hover:bg-[#ff4444]/30 disabled:opacity-50"
          >
            End
          </button>
        </div>
      </div>

      {/* Paused overlay */}
      {paused && (
        <div className="fixed inset-0 z-20 bg-[#0a0a0f]/90 backdrop-blur-sm flex items-center justify-center">
          <div className="text-center">
            <div className="text-4xl mb-4">{'\u23F8\uFE0F'}</div>
            <p className="text-white text-lg mb-4">Training Paused</p>
            <button
              onClick={() => setPaused(false)}
              className="px-6 py-3 bg-[#00ff88] text-black font-semibold rounded-lg"
            >
              Resume
            </button>
          </div>
        </div>
      )}

      <div className="flex h-[calc(100vh-57px)]">
        {/* Chat area */}
        <div className="flex-1 flex flex-col">
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            {error && (
              <div className="bg-[#ff4444]/10 border border-[#ff4444]/30 rounded-lg px-4 py-3 text-[#ff4444] text-sm">
                {error}
                <div className="flex gap-2 mt-2">
                  <button onClick={() => { setError(''); startNewTraining(); }} className="bg-[#00ff88]/20 text-[#00ff88] px-3 py-1 rounded text-xs font-medium hover:bg-[#00ff88]/30">Retry</button>
                  <button onClick={() => setError('')} className="underline text-xs text-[#888899]">Dismiss</button>
                </div>
              </div>
            )}

            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === 'seller' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                    msg.role === 'seller'
                      ? 'bg-[#00ff88]/10 border border-[#00ff88]/30 text-white'
                      : 'bg-[#141420] border border-[#1e1e2e] text-[#e0e0e0]'
                  }`}
                >
                  <div className="text-xs text-[#888899] mb-1">
                    {msg.role === 'seller' ? 'You' : (buyerPersona?.name || 'Buyer')}
                  </div>
                  <div className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</div>
                  {/* Show deductions for this message */}
                  {msg.deductions && msg.deductions.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-[#ff4444]/20">
                      {msg.deductions.map((d, i) => (
                        <div key={i} className={`text-xs ${severityColor(d.severity)}`}>
                          -{d.points}pts: {d.reason}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="bg-[#141420] border border-[#1e1e2e] rounded-2xl px-4 py-3">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-[#888899] rounded-full animate-bounce" />
                    <div className="w-2 h-2 bg-[#888899] rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                    <div className="w-2 h-2 bg-[#888899] rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="border-t border-[#1e1e2e] px-4 py-3 bg-[#0a0a0f]">
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                placeholder="Type your reply..."
                disabled={loading || paused}
                className="flex-1 bg-[#141420] border border-[#1e1e2e] rounded-xl px-4 py-3 text-white text-sm placeholder:text-[#888899] focus:outline-none focus:border-[#00ff88]/50 disabled:opacity-50"
              />
              <button
                onClick={handleSend}
                disabled={loading || paused || !input.trim()}
                className="px-5 py-3 bg-[#00ff88] text-black font-semibold rounded-xl text-sm hover:bg-[#00ff88]/90 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Send
              </button>
            </div>
          </div>
        </div>

        {/* Right panel - Deductions */}
        <div className="hidden md:block w-72 border-l border-[#1e1e2e] bg-[#0a0a0f] overflow-y-auto">
          <div className="p-4">
            <h3 className="text-white text-sm font-semibold mb-3">Deductions</h3>
            {deductions.length === 0 ? (
              <p className="text-[#888899] text-xs">No deductions yet. Keep going!</p>
            ) : (
              <div className="space-y-2">
                {deductions.map((d, i) => (
                  <div key={i} className="bg-[#141420] rounded-lg p-3 border border-[#1e1e2e]">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-[#888899]">{dimensionLabel(d.dimension)}</span>
                      <span className={`text-xs font-mono font-bold ${severityColor(d.severity)}`}>
                        -{d.points}
                      </span>
                    </div>
                    <p className="text-xs text-[#e0e0e0] leading-relaxed">{d.reason}</p>
                    <p className="text-[10px] text-[#888899] mt-1">Msg #{d.messageRef}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Score breakdown */}
            <div className="mt-6 pt-4 border-t border-[#1e1e2e]">
              <h3 className="text-white text-sm font-semibold mb-2">Score Breakdown</h3>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-[#888899]">Base</span>
                  <span className="text-white font-mono">100</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#ff4444]">Deductions</span>
                  <span className="text-[#ff4444] font-mono">-{100 - runningScore}</span>
                </div>
                <div className="flex justify-between pt-1 border-t border-[#1e1e2e]">
                  <span className="text-[#00ff88] font-semibold">Current</span>
                  <span className={`font-mono font-bold ${runningScore >= 70 ? 'text-[#00ff88]' : runningScore >= 40 ? 'text-[#ffaa00]' : 'text-[#ff4444]'}`}>
                    {runningScore}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
