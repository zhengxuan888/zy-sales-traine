'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';

const menuItems = [
  {
    id: 'training',
    icon: '\u{1F3AF}',
    label: 'Start Training',
    sublabel: 'Free practice session',
    href: '/training/new',
    color: 'from-green-500/20 to-green-600/5',
    border: 'border-green-500/30',
    hover: 'hover:border-green-400/60',
  },
  {
    id: 'cases',
    icon: '\u{1F4D6}',
    label: 'Real Cases',
    sublabel: 'Learn from real conversations',
    href: '/cases',
    color: 'from-blue-500/20 to-blue-600/5',
    border: 'border-blue-500/30',
    hover: 'hover:border-blue-400/60',
  },
  {
    id: 'wrong',
    icon: '\u274C',
    label: 'Mistakes Review',
    sublabel: 'Practice your weak spots',
    href: '/wrong-questions',
    color: 'from-red-500/20 to-red-600/5',
    border: 'border-red-500/30',
    hover: 'hover:border-red-400/60',
  },
  {
    id: 'scores',
    icon: '\u{1F4CA}',
    label: 'My Scores',
    sublabel: 'Track your progress',
    href: '/scores',
    color: 'from-purple-500/20 to-purple-600/5',
    border: 'border-purple-500/30',
    hover: 'hover:border-purple-400/60',
  },
  {
    id: 'coach',
    icon: '\u{1F468}\u200D\u{1F3EB}',
    label: 'AI Coach',
    sublabel: 'Get personalized feedback',
    href: '/scores',
    color: 'from-amber-500/20 to-amber-600/5',
    border: 'border-amber-500/30',
    hover: 'hover:border-amber-400/60',
  },
  {
    id: 'help',
    icon: '\u{1F4E5}',
    label: 'Live Help',
    sublabel: 'Get help with real buyers',
    href: '/help',
    color: 'from-cyan-500/20 to-cyan-600/5',
    border: 'border-cyan-500/30',
    hover: 'hover:border-cyan-400/60',
  },
];

export default function HomePage() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <div className="min-h-screen flex flex-col px-4 py-6 max-w-lg mx-auto">
      {/* Header */}
      <div className="text-center mb-8 animate-fade-in">
        <h1 className="text-2xl font-bold text-white mb-1">
          AI Sales Trainer
        </h1>
        <p className="text-sm text-[#888899]">
          FB Marketplace - Build muscle memory
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-3 mb-6 animate-fade-in">
        <div className="bg-[#141420] rounded-lg p-3 text-center border border-[#1e1e2e]">
          <div className="text-xl font-bold text-[#00ff88] font-mono">--</div>
          <div className="text-xs text-[#888899] mt-1">Avg Score</div>
        </div>
        <div className="bg-[#141420] rounded-lg p-3 text-center border border-[#1e1e2e]">
          <div className="text-xl font-bold text-[#4488ff] font-mono">--</div>
          <div className="text-xs text-[#888899] mt-1">Sessions</div>
        </div>
        <div className="bg-[#141420] rounded-lg p-3 text-center border border-[#1e1e2e]">
          <div className="text-xl font-bold text-[#ff4444] font-mono">--</div>
          <div className="text-xs text-[#888899] mt-1">To Improve</div>
        </div>
      </div>

      {/* Main Menu */}
      <div className="grid grid-cols-2 gap-3 flex-1">
        {menuItems.map((item, index) => (
          <Link
            key={item.id}
            href={item.href}
            className={`
              bg-gradient-to-br ${item.color}
              border ${item.border} ${item.hover}
              rounded-xl p-4 flex flex-col items-center justify-center
              transition-all duration-200 active:scale-95
              animate-slide-up
            `}
            style={{ animationDelay: `${index * 60}ms`, animationFillMode: 'backwards' }}
          >
            <span className="text-3xl mb-2">{item.icon}</span>
            <span className="text-sm font-semibold text-white text-center">
              {item.label}
            </span>
            <span className="text-xs text-[#888899] text-center mt-1">
              {item.sublabel}
            </span>
          </Link>
        ))}
      </div>

      {/* Boss Entrance - Bottom */}
      <div className="mt-6 pt-4 border-t border-[#1e1e2e] flex justify-center gap-4 animate-fade-in" style={{ animationDelay: '400ms', animationFillMode: 'backwards' }}>
        <Link
          href="/admin"
          className="text-xs text-[#888899] hover:text-[#ffd700] transition-colors flex items-center gap-1"
        >
          <span>{'\u{1F451}'}</span> Dashboard
        </Link>
        <span className="text-[#1e1e2e]">|</span>
        <Link
          href="/admin?tab=takeover"
          className="text-xs text-[#888899] hover:text-[#ffd700] transition-colors flex items-center gap-1"
        >
          <span>{'\u{1F451}'}</span> Take Over
        </Link>
      </div>
    </div>
  );
}
