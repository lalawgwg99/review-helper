// POST /api/suggest — 寫入／更新 AI 回覆建議，需 x-ingest-secret
// body: { review_id, suggestion }
// 寫入前先跑 functions/rules.js 驗證（Q1），不合格回 400 不進庫
import { ensureSchema, checkSecret, json } from '../lib.js';
import { loadSettings, validateSuggestion } from '../rules.js';

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
  // Q1：對照規則檔驗證（需該評論星級＋有無文字）；不合格不寫入
  const review = await env.DB.prepare(`SELECT stars, body FROM reviews WHERE id = ?`)
    .bind(review_id)
    .first();
  if (!review) return json({ error: 'review_not_found' }, 400);
  const problems = validateSuggestion({
    stars: review.stars,
    hasText: !!(review.body && review.body.trim()),
    suggestion,
    settings: await loadSettings(env.DB),
  });
  if (problems.length) return json({ error: 'rule_violation', problems }, 400);
  await env.DB.prepare(
    `INSERT INTO suggestions (review_id, suggestion) VALUES (?, ?)
     ON CONFLICT(review_id) DO UPDATE SET suggestion = excluded.suggestion`
  ).bind(review_id, suggestion).run();
  return json({ ok: true });
}
