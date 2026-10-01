// GET /api/settings — 讀商家設定；POST — 寫入（後台用，自用版不設密碼，販售版再加）
import { ensureSchema, json } from '../lib.js';

export async function onRequestGet({ env }) {
  if (!env.DB) return json({ error: 'db_not_bound' }, 500);
  await ensureSchema(env.DB);
  const { results } = await env.DB.prepare(`SELECT key, value FROM settings`).all();
  const out = {};
  for (const r of results) out[r.key] = r.value;
  return json({ ok: true, settings: out });
}

export async function onRequestPost({ request, env }) {
  if (!env.DB) return json({ error: 'db_not_bound' }, 500);
  await ensureSchema(env.DB);
  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ error: 'bad_json' }, 400);
  }
  const settings = payload.settings || {};
  const batch = [];
  for (const [k, v] of Object.entries(settings).slice(0, 20)) {
    batch.push(
      env.DB.prepare(`INSERT INTO settings (key, value) VALUES (?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value`).bind(String(k).slice(0, 64), String(v).slice(0, 2000))
    );
  }
  if (batch.length) await env.DB.batch(batch);
  return json({ ok: true });
}
