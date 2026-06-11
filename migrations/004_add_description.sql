ALTER TABLE memes ADD COLUMN description TEXT DEFAULT '';
CREATE INDEX IF NOT EXISTS idx_memes_description ON memes(description);