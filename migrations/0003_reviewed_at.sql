-- 0003: suggestions.reviewed_at（人工審核時間，Q2 推播閘門用）
-- 已於 2026-10-11 直接套用到線上 D1（review-helper-db）；此檔為 repo 補登，線上不需重跑。
ALTER TABLE suggestions ADD COLUMN reviewed_at TEXT;
