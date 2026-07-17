import type { Metadata } from 'next';
import './globals.css';

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
    <html lang="es" className="dark">
      <body className="bg-[#0a0a0f] text-[#e0e0e0] antialiased min-h-screen">
        {children}
      </body>
    </html>
  );
}
