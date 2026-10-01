// 共用：建表、review key、ingest 驗證
const SCHEMA = `
CREATE TABLE IF NOT EXISTS reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  review_key TEXT UNIQUE NOT NULL,
  author TEXT NOT NULL,
  stars INTEGER NOT NULL,
  seen_label TEXT DEFAULT '',
  body TEXT DEFAULT '',
  has_photo INTEGER DEFAULT 0,
  owner_replied INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now','+8 hours')),
  replied_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_reviews_created ON reviews(id DESC);
CREATE TABLE IF NOT EXISTS suggestions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  review_id INTEGER NOT NULL UNIQUE,
  suggestion TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now','+8 hours')),
  FOREIGN KEY(review_id) REFERENCES reviews(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
INSERT OR IGNORE INTO settings (key, value) VALUES
  ('store_name', '萬家福量販 五甲店'),
  ('service_phone', '0800-567-788'),
  ('tone', '親切誠懇'),
  ('signature', '萬家福量販 五甲店 敬上');
`;

export async function ensureSchema(db) {
  for (const stmt of SCHEMA.split(';')) {
    const s = stmt.trim();
    if (s) await db.prepare(s).run();
  }
}

// 去重 key：作者＋星數＋內文前40字（Google 相對時間會漂移，不能拿來當 key）
export async function reviewKey(author, stars, body) {
  const data = `${author}|${stars}|${(body || '').slice(0, 40)}`;
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function checkSecret(request, env) {
  const s = request.headers.get('x-ingest-secret');
  return !!env.INGEST_SECRET && s === env.INGEST_SECRET;
}

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}
