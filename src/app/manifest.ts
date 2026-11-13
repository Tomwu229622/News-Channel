import type { MetadataRoute } from 'next';

/**
 * Web App Manifest：讓網站可以「加入主畫面」成為獨立 App（PWA 的安裝部分）。
 * 只做安裝，不含 service worker／離線快取——首頁每次都即時查資料庫。
 * 圖示由 PIL 腳本產生後放在 public/；要換圖示直接覆蓋同名 PNG 即可。
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: '重大新聞蒐集器 News Finder',
    short_name: 'News Finder',
    description: '每小時自動蒐集台灣本地、國際、財經貿易、科技產業、資安的重大新聞',
    lang: 'zh-Hant-TW',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    // 與 globals.css 的 --bg 一致，啟動畫面與狀態列才不會閃白
    background_color: '#0f1419',
    theme_color: '#0f1419',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
