// GET /api/reviews?filter=all|pending — 評論列表（含 AI 建議）
import { ensureSchema, json } from '../lib.js';

export async function onRequestGet({ request, env }) {
  if (!env.DB) return json({ error: 'db_not_bound' }, 500);
  await ensureSchema(env.DB);
  const url = new URL(request.url);
  const filter = url.searchParams.get('filter') || 'all';
  const where = filter === 'pending' ? 'WHERE r.replied_at IS NULL' : '';
  const { results } = await env.DB.prepare(
    `SELECT r.id, r.author, r.stars, r.seen_label, r.body, r.has_photo, r.owner_replied,
            r.created_at, r.replied_at, s.suggestion
     FROM reviews r LEFT JOIN suggestions s ON s.review_id = r.id
     ${where}
     ORDER BY r.id DESC LIMIT 200`
  ).all();
  const pending = await env.DB.prepare(
    `SELECT COUNT(*) AS c FROM reviews WHERE replied_at IS NULL`
  ).first();
  return json({ ok: true, reviews: results, pending_count: pending.c });
}
