CREATE TABLE worldbook_packs (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL CHECK (category IN ('角色', '事件', '扩展')),
  dlc_key TEXT NOT NULL,
  relations_json TEXT NOT NULL DEFAULT '{"exclusions":[],"replacements":[],"prerequisites":[]}',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'hidden', 'removed')),
  version INTEGER NOT NULL DEFAULT 1,
  entry_count INTEGER NOT NULL,
  object_key TEXT NOT NULL UNIQUE,
  byte_size INTEGER NOT NULL,
  sha256 TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  published_at INTEGER
);

CREATE INDEX idx_worldbook_packs_public ON worldbook_packs(status, updated_at DESC);
CREATE INDEX idx_worldbook_packs_owner ON worldbook_packs(owner_id, updated_at DESC);
CREATE INDEX idx_worldbook_packs_key ON worldbook_packs(dlc_key);
