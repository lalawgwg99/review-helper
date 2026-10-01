// POST /api/notify — 把指定評論推播到 LINE 群組（需 x-ingest-secret）
// body: { review_ids: [1, 2, 3] }
// 推播目標＝最近一次在群組／聊天室說話記下的 ID（優先群組）
import { ensureSchema, checkSecret, json } from '../lib.js';

export async function onRequestPost({ request, env }) {
  if (!env.DB) return json({ error: 'db_not_bound' }, 500);
  if (!checkSecret(request, env)) return json({ error: 'unauthorized' }, 401);
  if (!env.LINE_CHANNEL_ACCESS_TOKEN) return json({ error: 'line_not_configured' }, 500);
  await ensureSchema(env.DB);

  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ error: 'bad_json' }, 400);
  }
  const ids = (payload.review_ids || []).map(Number).filter(Boolean).slice(0, 5);
  if (!ids.length) return json({ error: 'bad_request' }, 400);

  const target =
    (await env.DB.prepare(
      `SELECT source_id FROM line_sources WHERE type IN ('group','room') ORDER BY last_seen DESC LIMIT 1`
    ).first()) ||
    (await env.DB.prepare(`SELECT source_id FROM line_sources ORDER BY last_seen DESC LIMIT 1`).first());
  if (!target) return json({ error: 'no_line_target', hint: '先把官方帳號拉進群組並說一句話' }, 400);

  const st = await env.DB.prepare(`SELECT key, value FROM settings`).all();
  const settings = {};
  for (const r of st.results) settings[r.key] = r.value;
  const store = settings.store_name || '本店';

  const results = [];
  for (const id of ids) {
    const r = await env.DB.prepare(
      `SELECT r.author, r.stars, r.seen_label, r.body, s.suggestion
       FROM reviews r LEFT JOIN suggestions s ON s.review_id = r.id WHERE r.id = ?`
    ).bind(id).first();
    if (!r) {
      results.push({ id, ok: false, error: 'not_found' });
      continue;
    }
    const pushRes = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + env.LINE_CHANNEL_ACCESS_TOKEN,
      },
      body: JSON.stringify({ to: target.source_id, messages: [{ type: 'text', text: buildMessage(store, r) }] }),
    });
    results.push({ id, ok: pushRes.ok, status: pushRes.status });
    if (!pushRes.ok) break;
  }
  return json({ ok: true, results });
}

function buildMessage(store, r) {
  const stars = '★'.repeat(r.stars) + '☆'.repeat(5 - r.stars);
  const body = r.body || '（僅評分，無文字）';
  const sug = r.suggestion || '（AI 建議產生中，請稍後到後台查看）';
  const warn = r.stars <= 2 ? '⚠️ 低分評論，請人工審核後再回覆到 Google！\n' : '';
  return `${warn}🆕 Google 新評論｜${store}\n${stars} ${r.author}｜${r.seen_label}\n「${body}」\n\n🤖 AI 回覆建議：\n${sug}`.slice(0, 4500);
}
