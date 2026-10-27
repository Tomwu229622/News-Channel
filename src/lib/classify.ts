/**
 * 關鍵字分類與「重大新聞」判斷（不需 AI 也能運作）。
 *
 * 當沒有設定 ANTHROPIC_API_KEY 時，系統會用這裡的關鍵字權重來估算重要性。
 * 想調整哪些主題算「重大」，編輯下方 KEYWORD_WEIGHTS 即可。
 */

/** 關鍵字 → 權重（分數）。命中越多、權重越高，新聞越「重大」。 */
export const KEYWORD_WEIGHTS: Record<string, number> = {
  // 災難 / 公共安全
  地震: 40, 颱風: 35, 海嘯: 40, 洪水: 30, 火災: 25, 爆炸: 35, 空難: 45, 戰爭: 45, 衝突: 25,
  疫情: 30, 確診: 20, 死亡: 25, 罹難: 30,
  // 政治 / 兩岸 / 國際關係
  總統: 25, 選舉: 25, 罷免: 30, 政變: 40, 制裁: 35, 國防: 25, 兩岸: 30, 國安: 30,
  外交: 20, 軍演: 30, 飛彈: 35,
  // 財經 / 貿易（TAITRA 關注）
  關稅: 40, 出口: 30, 進口: 25, 貿易: 30, 升息: 35, 降息: 35, 央行: 30, 通膨: 30,
  匯率: 25, 股災: 40, 崩盤: 40, 破產: 35, 併購: 30, GDP: 25, 經濟成長: 25, 衰退: 30,
  半導體: 35, 台積電: 35, 供應鏈: 30, 晶片: 30, 出口管制: 40,
  // 科技 / 產業
  AI: 20, 人工智慧: 25, 資安: 25, 駭客: 30, 個資外洩: 35, 量子: 20, 電動車: 20,
  // 資安（英文詞比對大小寫敏感，故常見大小寫寫法都列出）
  漏洞: 30, 勒索軟體: 40, 勒索病毒: 40, 資料外洩: 35, 零時差: 40, 供應鏈攻擊: 40,
  網路攻擊: 30, 惡意程式: 25, 後門: 25, 釣魚: 20, DDoS: 30, 'CVE-': 20,
  'ransomware': 35, 'Ransomware': 35, 'zero-day': 35, 'Zero-Day': 35,
  'data breach': 35, 'Data Breach': 35, 'exploited': 25, 'malware': 25, 'Malware': 25,
  'phishing': 20, 'Phishing': 20, 'hacked': 30,
};

/** 高於此分數視為「重大新聞」 */
export const MAJOR_THRESHOLD = 45;

export interface ClassifyResult {
  /** 估算重要性 0-100 */
  importance: number;
  /** 是否重大 */
  isMajor: boolean;
  /** 命中的關鍵字（去重） */
  keywords: string[];
}

/** 用關鍵字權重估算一則新聞的重要性 */
export function classifyByKeywords(title: string, summary: string): ClassifyResult {
  const text = `${title}\n${summary}`;
  const hits: string[] = [];
  let score = 0;

  for (const [kw, weight] of Object.entries(KEYWORD_WEIGHTS)) {
    if (text.includes(kw)) {
      hits.push(kw);
      score += weight;
    }
  }

  // 標題命中加成（標題出現代表更核心）
  for (const kw of hits) {
    if (title.includes(kw)) score += 10;
  }

  const importance = Math.min(100, score);
  return {
    importance,
    isMajor: importance >= MAJOR_THRESHOLD,
    keywords: hits,
  };
}
