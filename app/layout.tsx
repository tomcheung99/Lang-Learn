import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '一字學習 | Lang Learn',
  description: '打一個字，學一句話 - 使用 Web LLM 生成自然例句',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-TW">
      <body className="antialiased">{children}</body>
    </html>
  );
}
