import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '一字學習 | Lang Learn',
  description: '打一個字，學一句話 - AI 驅動語言學習',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-TW" suppressHydrationWarning>
      <body className="antialiased transition-colors duration-300">{children}</body>
    </html>
  );
}
