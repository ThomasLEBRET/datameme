CREATE TABLE IF NOT EXISTS memes (
  id         TEXT PRIMARY KEY,
  url        TEXT NOT NULL,
  filename   TEXT,
  tags       TEXT NOT NULL DEFAULT '[]',
  emotions   TEXT NOT NULL DEFAULT '[]',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS emotions (
  id    TEXT PRIMARY KEY,
  label TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS admin (
  id            TEXT PRIMARY KEY,
  username      TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_memes_tags ON memes(tags);
CREATE INDEX IF NOT EXISTS idx_memes_emotions ON memes(emotions);
CREATE INDEX IF NOT EXISTS idx_memes_created_at ON memes(created_at DESC);
