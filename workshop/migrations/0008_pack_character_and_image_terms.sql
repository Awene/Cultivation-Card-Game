ALTER TABLE packs ADD COLUMN character_name TEXT NOT NULL DEFAULT '';
ALTER TABLE packs ADD COLUMN aliases_json TEXT NOT NULL DEFAULT '[]';

-- 旧版把人物身份保存在每张图片上；升级时取图包中的第一张有效图片作为图包身份。
UPDATE packs
SET character_name = COALESCE(
  (
    SELECT i.character_name
    FROM images i
    WHERE i.pack_id = packs.id AND i.status != 'removed' AND TRIM(i.character_name) != ''
    ORDER BY i.created_at, i.id
    LIMIT 1
  ),
  ''
)
WHERE category = '人物';

UPDATE packs
SET aliases_json = COALESCE(
  (
    SELECT i.aliases_json
    FROM images i
    WHERE i.pack_id = packs.id AND i.status != 'removed' AND TRIM(i.character_name) = packs.character_name
    ORDER BY i.created_at, i.id
    LIMIT 1
  ),
  '[]'
)
WHERE category = '人物';

-- 0007 曾把风景/其他抓取词放在图包上；升级时复制回每张图片。
UPDATE images
SET keywords_json = COALESCE(
  (SELECT p.match_terms_json FROM packs p WHERE p.id = images.pack_id),
  '[]'
)
WHERE pack_id IN (SELECT id FROM packs WHERE category != '人物')
  AND (keywords_json IS NULL OR keywords_json = '' OR keywords_json = '[]');
