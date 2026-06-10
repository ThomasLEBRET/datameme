-- Migration 002 — Ajout de la colonne filesize pour la déduplication

ALTER TABLE memes ADD COLUMN filesize INTEGER DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_memes_filename_filesize ON memes(filename, filesize);
