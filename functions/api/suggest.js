// POST /api/suggest — 寫入／更新 AI 回覆建議，需 x-ingest-secret
// body: { review_id, suggestion }
import { ensureSchema, checkSecret, json } from '../lib.js';

export async function onRequestPost({ request, env }) {
  if (!env.DB) return json({ error: 'db_not_bound' }, 500);
  if (!checkSecret(request, env)) return json({ error: 'unauthorized' }, 401);
  await ensureSchema(env.DB);
  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ error: 'bad_json' }, 400);
  }
  const review_id = Number(payload.review_id);
  const suggestion = String(payload.suggestion || '').trim();
  if (!review_id || !suggestion) return json({ error: 'bad_request' }, 400);
  await env.DB.prepare(
    `INSERT INTO suggestions (review_id, suggestion) VALUES (?, ?)
     ON CONFLICT(review_id) DO UPDATE SET suggestion = excluded.suggestion`
  ).bind(review_id, suggestion).run();
  return json({ ok: true });
}
