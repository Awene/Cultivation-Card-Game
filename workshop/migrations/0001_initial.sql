PRAGMA foreign_keys = ON;

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  global_name TEXT,
  avatar TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'banned')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE oauth_states (
  state_hash TEXT PRIMARY KEY,
  code_verifier TEXT NOT NULL,
  opener_origin TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE login_codes (
  code_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  opener_origin TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  used_at INTEGER,
  created_at INTEGER NOT NULL
);

CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  last_used_at INTEGER NOT NULL
);

CREATE TABLE packs (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL CHECK (category IN ('风景', '人物', '其他')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'hidden', 'removed')),
  version INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  published_at INTEGER
);

CREATE INDEX idx_packs_public ON packs(status, updated_at DESC);
CREATE INDEX idx_packs_owner ON packs(owner_id, updated_at DESC);

CREATE TABLE images (
  id TEXT PRIMARY KEY,
  pack_id TEXT NOT NULL REFERENCES packs(id),
  object_key TEXT NOT NULL UNIQUE,
  character_name TEXT NOT NULL DEFAULT '',
  rating TEXT NOT NULL CHECK (rating IN ('sfw', 'nsfw')),
  keywords_json TEXT NOT NULL,
  mime_type TEXT NOT NULL CHECK (mime_type IN ('image/jpeg', 'image/png', 'image/webp')),
  width INTEGER NOT NULL,
  height INTEGER NOT NULL,
  byte_size INTEGER NOT NULL,
  sha256 TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'hidden', 'removed')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX idx_images_pack ON images(pack_id, status, created_at);

CREATE TABLE reports (
  id TEXT PRIMARY KEY,
  reporter_id TEXT NOT NULL REFERENCES users(id),
  target_type TEXT NOT NULL CHECK (target_type IN ('pack', 'image')),
  target_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'rejected')),
  resolution TEXT,
  handled_by TEXT REFERENCES users(id),
  created_at INTEGER NOT NULL,
  handled_at INTEGER
);

CREATE UNIQUE INDEX idx_reports_one_open_per_user
ON reports(reporter_id, target_type, target_id)
WHERE status = 'open';

CREATE INDEX idx_reports_status ON reports(status, created_at DESC);

CREATE TABLE audit_logs (
  id TEXT PRIMARY KEY,
  actor_id TEXT,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  details_json TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL
);

CREATE INDEX idx_audit_created ON audit_logs(created_at DESC);

CREATE TABLE rate_limits (
  bucket TEXT NOT NULL,
  subject TEXT NOT NULL,
  window_start INTEGER NOT NULL,
  count INTEGER NOT NULL,
  PRIMARY KEY (bucket, subject, window_start)
);

