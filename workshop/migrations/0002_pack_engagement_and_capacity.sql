ALTER TABLE packs ADD COLUMN like_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE packs ADD COLUMN download_count INTEGER NOT NULL DEFAULT 0;

CREATE TABLE pack_likes (
  pack_id TEXT NOT NULL REFERENCES packs(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  created_at INTEGER NOT NULL,
  PRIMARY KEY (pack_id, user_id)
);

CREATE INDEX idx_pack_likes_user ON pack_likes(user_id, created_at DESC);

CREATE TABLE pack_downloads (
  pack_id TEXT NOT NULL REFERENCES packs(id),
  downloader_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (pack_id, downloader_hash)
);

CREATE INDEX idx_pack_downloads_created ON pack_downloads(created_at DESC);

