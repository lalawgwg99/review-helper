// POST /api/mark-replied — 標記已回覆／改回待回覆，需 x-ingest-secret
// body: { review_id, replied: true|false }
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
  if (!review_id) return json({ error: 'bad_request' }, 400);
  const val = payload.replied ? `datetime('now','+8 hours')` : 'NULL';
  await env.DB.prepare(`UPDATE reviews SET replied_at = ${val} WHERE id = ?`).bind(review_id).run();
  return json({ ok: true });
}
