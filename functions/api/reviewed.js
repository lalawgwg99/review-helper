// POST /api/reviewed — 標記建議已人工審核，需 x-ingest-secret
// body: { review_id }；將 suggestions.reviewed_at 設為當下時間（+8 小時，與其他時間欄位一致）
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
  if (!Number.isInteger(review_id) || review_id <= 0) return json({ error: 'bad_request' }, 400);
  const row = await env.DB.prepare(`SELECT id FROM suggestions WHERE review_id = ?`)
    .bind(review_id)
    .first();
  if (!row) return json({ error: 'not_found' }, 404);
  await env.DB.prepare(
    `UPDATE suggestions SET reviewed_at = datetime('now','+8 hours') WHERE review_id = ?`
  ).bind(review_id).run();
  return json({ ok: true });
}
