-- LINE 推播目標紀錄
CREATE TABLE IF NOT EXISTS line_sources (
  source_id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  last_seen TEXT DEFAULT (datetime('now','+8 hours'))
);
