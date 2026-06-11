'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function RefreshButton() {
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const router = useRouter();

  async function handleClick() {
    setLoading(true);
    setMsg('蒐集中…（首次或久未更新可能需數十秒）');
    try {
      const res = await fetch('/api/collect', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setMsg(`完成：新增 ${data.inserted} 則（重大 ${data.major}），資料庫共 ${data.total} 則`);
        router.refresh();
      } else {
        setMsg(`失敗：${data.error ?? res.status}`);
      }
    } catch (e) {
      setMsg(`失敗：${(e as Error).message}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="refresh">
      <button onClick={handleClick} disabled={loading} className="refresh-btn">
        {loading ? '⏳ 蒐集中…' : '🔄 立即更新'}
      </button>
      {msg && <span className="refresh-msg">{msg}</span>}
    </div>
  );
}
