// AI 回覆建議規則（機器可讀版）
// 來源：docs/FLOW.md §三「AI 回覆建議規則」、README「AI 回覆建議規則」
// 用途：functions/api/suggest.js 寫入前驗證、functions/api/notify.js 推播前重驗
// 設計：只做確定性檢查（字數、署名、電話、禁語）；繁體中文、語氣、是否針對缺點等
//       需要語意判斷的，留給未來的 AI 自評層（產生→驗證→重寫迴圈），不在這裡硬幹。

export const MAX_LEN = 150; // 一律 150 字內
export const MAX_LEN_5STAR_NOTEXT = 50; // 5 星無文字評論：簡短感謝，50 字內

// 與 functions/lib.js SCHEMA seed 一致的預設值；一律以 D1 settings 表為準，缺值時 fallback
export const DEFAULT_SETTINGS = {
  store_name: '萬家福量販 五甲店',
  service_phone: '0800-567-788',
  tone: '親切誠懇',
  signature: '萬家福量販 五甲店 敬上',
};

// 辯解／推諉禁語（FLOW.md：1–2 星「不辯解」鐵律；只對低分建議檢查，避免誤傷正常回覆）
export const BANNED_PHRASES = [
  '但是',
  '不過',
  '是你誤會',
  '您誤會',
  '是你搞錯',
  '您搞錯',
  '並非我們的問題',
  '這不是我們的錯',
];

export async function loadSettings(db) {
  const settings = { ...DEFAULT_SETTINGS };
  try {
    const rows = await db.prepare(`SELECT key, value FROM settings`).all();
    for (const r of rows.results || []) {
      if (r.key in settings && r.value) settings[r.key] = r.value;
    }
  } catch {
    // settings 表不存在時用預設值，不擋流程
  }
  return settings;
}

// 驗證一則建議；回傳 problems 陣列，空陣列＝通過
// stars：該評論星數；hasText：評論有無文字；suggestion：建議本文；settings：loadSettings() 結果
export function validateSuggestion({ stars, hasText, suggestion, settings }) {
  const problems = [];
  const s = { ...DEFAULT_SETTINGS, ...(settings || {}) };
  const text = String(suggestion || '').trim();
  if (!text) {
    problems.push({ code: 'empty', message: '建議為空' });
    return problems;
  }
  const len = [...text].length; // code point 計數：中文 1 字＝1

  if (len > MAX_LEN) {
    problems.push({ code: 'too_long', message: `超過 ${MAX_LEN} 字（目前 ${len} 字）` });
  }
  if (Number(stars) === 5 && !hasText && len > MAX_LEN_5STAR_NOTEXT) {
    problems.push({
      code: 'too_long_5star',
      message: `5 星無文字評論的建議應在 ${MAX_LEN_5STAR_NOTEXT} 字內（目前 ${len} 字）`,
    });
  }

  // 結尾署名：容忍結尾多一個標點（敬上。）
  if (s.signature) {
    const tail = text.replace(/[。！？.!?]+$/, '');
    if (!tail.endsWith(s.signature)) {
      problems.push({ code: 'missing_signature', message: `結尾缺少署名「${s.signature}」` });
    }
  }

  // 1–2 星鐵律：留客服專線、不辯解
  if (Number(stars) <= 2) {
    if (s.service_phone && !text.includes(s.service_phone)) {
      problems.push({
        code: 'missing_phone',
        message: `1–2 星建議必須留下客服專線 ${s.service_phone}`,
      });
    }
    const hit = BANNED_PHRASES.find((w) => text.includes(w));
    if (hit) {
      problems.push({ code: 'banned_phrase', message: `1–2 星禁辯解用語，出現「${hit}」` });
    }
  }
  return problems;
}
