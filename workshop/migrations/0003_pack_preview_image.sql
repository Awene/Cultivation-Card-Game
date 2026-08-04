ALTER TABLE packs ADD COLUMN preview_image_id TEXT;

UPDATE packs
SET preview_image_id = (
  SELECT i.id
  FROM images i
  WHERE i.pack_id = packs.id AND i.status = 'active'
  ORDER BY i.created_at, i.id
  LIMIT 1
)
WHERE preview_image_id IS NULL;
