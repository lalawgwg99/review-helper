// POST /api/ingest — 寫入新評論（去重），需 x-ingest-secret
// body: { reviews: [{ author, stars, seen_label, body, has_photo, owner_replied }] }
import { ensureSchema, reviewKey, checkSecret, json } from '../lib.js';

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
  const list = Array.isArray(payload.reviews) ? payload.reviews : [];
  const added = [];
  let skipped = 0;
  for (const r of list.slice(0, 50)) {
    if (!r.author || !r.stars) { skipped++; continue; }
    const key = await reviewKey(r.author, r.stars, r.body);
    try {
      const res = await env.DB.prepare(
        `INSERT INTO reviews (review_key, author, stars, seen_label, body, has_photo, owner_replied)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        key, String(r.author), Number(r.stars), String(r.seen_label || ''),
        String(r.body || ''), r.has_photo ? 1 : 0, r.owner_replied ? 1 : 0
      ).run();
      added.push({ id: res.meta.last_row_id, author: r.author, stars: r.stars, body: r.body || '' });
    } catch {
      skipped++; // review_key 重複＝已看過
    }
  }
  return json({ ok: true, added, added_count: added.length, skipped });
}
