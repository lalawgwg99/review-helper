-- review-helper D1 schema
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
