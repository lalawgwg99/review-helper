// POST /api/line-webhook — LINE Webhook：記錄群組／聊天室／使用者的 ID
// 設定流程：LINE Developers → Webhook URL 填 https://<你的網址>/api/line-webhook → 開啟 Use webhook
// 之後在群組裡講一句話，這裡就會記下 groupId，/api/notify 就知道推去哪
import { ensureSchema, json } from '../lib.js';

export async function onRequestPost({ request, env }) {
  if (!env.DB) return json({ error: 'db_not_bound' }, 500);
  await ensureSchema(env.DB);
  const bodyText = await request.text();
  // 正式環境一定要設 LINE_CHANNEL_SECRET 才能驗簽，沒設就直接拒絕（fail closed）
  if (!env.LINE_CHANNEL_SECRET) {
    return json({ error: 'webhook_not_configured' }, 503);
  }
  const sig = request.headers.get('x-line-signature') || '';
  if (!(await verifySig(bodyText, env.LINE_CHANNEL_SECRET, sig))) {
    return json({ error: 'bad_signature' }, 401);
  }
  let events = [];
  try {
    events = JSON.parse(bodyText).events || [];
  } catch {
    return json({ error: 'bad_json' }, 400);
  }
  let recorded = 0;
  for (const ev of events) {
    const src = ev.source || {};
    const sid = src.groupId || src.roomId || src.userId;
    if (!sid) continue;
    const type = src.groupId ? 'group' : src.roomId ? 'room' : 'user';
    await env.DB.prepare(
      `INSERT INTO line_sources (source_id, type, last_seen) VALUES (?, ?, datetime('now','+8 hours'))
       ON CONFLICT(source_id) DO UPDATE SET last_seen = excluded.last_seen`
    ).bind(sid, type).run();
    recorded++;
  }
  return json({ ok: true, recorded });
}

// 方便檢查：GET 回傳目前記下的推播目標
export async function onRequestGet({ env }) {
  if (!env.DB) return json({ error: 'db_not_bound' }, 500);
  await ensureSchema(env.DB);
  const { results } = await env.DB.prepare(
    `SELECT type, last_seen FROM line_sources ORDER BY last_seen DESC`
  ).all();
  // 不回傳原始 ID，避免外洩；只回報有幾個目標
  return json({ ok: true, targets: results.map((r) => ({ type: r.type, last_seen: r.last_seen })) });
}

async function verifySig(bodyText, secret, sig) {
  try {
    const key = await crypto.subtle.importKey(
      'raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
    );
    const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(bodyText));
    const bytes = new Uint8Array(mac);
    let bin = '';
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin) === sig;
  } catch {
    return false;
  }
}
