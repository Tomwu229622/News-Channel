import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '重大新聞蒐集器 | News Finder',
  description: '每小時自動蒐集台灣本地、國際、財經貿易、科技產業的重大新聞',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-Hant-TW">
      <body>{children}</body>
    </html>
  );
}
