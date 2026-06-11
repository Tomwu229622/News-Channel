import { NextResponse } from 'next/server';
import { collect } from '@/lib/collector';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/** 手動觸發一次蒐集（網站右上角「立即更新」按鈕會呼叫這裡） */
export async function POST() {
  try {
    const stats = await collect();
    return NextResponse.json(stats);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
