import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '重大新聞蒐集器 | News Finder',
  description: '每小時自動蒐集台灣本地、國際、財經貿易、科技產業、資安的重大新聞',
  applicationName: 'News Finder',
  // iOS Safari「加入主畫面」後以獨立視窗開啟（manifest 由 app/manifest.ts 自動掛上）
  appleWebApp: {
    capable: true,
    title: 'News Finder',
    statusBarStyle: 'black-translucent',
  },
};

// 與 globals.css 的 --bg 一致：手機瀏覽器網址列與已安裝 App 的狀態列顏色
export const viewport: Viewport = {
  themeColor: '#0f1419',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-Hant-TW">
      <body>{children}</body>
    </html>
  );
}
