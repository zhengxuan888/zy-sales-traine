import type { Metadata } from 'next';
import './globals.css';
import { I18nProvider } from '@/lib/i18n';

export const metadata: Metadata = {
  title: 'AI Sales Trainer - FB Marketplace',
  description: 'Train your sales team to master Facebook Marketplace conversations. Build muscle memory through AI-powered practice sessions.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh" className="dark">
      <body className="bg-[#0a0a0f] text-[#e0e0e0] antialiased min-h-screen">
        <I18nProvider>
          {children}
        </I18nProvider>
      </body>
    </html>
  );
}
