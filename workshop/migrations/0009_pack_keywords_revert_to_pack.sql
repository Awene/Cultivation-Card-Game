-- 把 0008 拆散到单张图片上的风景/其他抓取词合并回图包级 match_terms_json。
-- 新代码里关键词只存在于 packs.match_terms_json，图片级 keywords_json 不再参与匹配。

UPDATE packs
SET match_terms_json = COALESCE(
  (
    SELECT json_group_array(term)
    FROM (
      SELECT DISTINCT kv.value AS term
      FROM images i
      CROSS JOIN json_each(i.keywords_json) AS kv
      WHERE i.pack_id = packs.id
        AND i.status = 'active'
        AND i.keywords_json IS NOT NULL
        AND i.keywords_json != ''
        AND i.keywords_json != '[]'
        AND TRIM(kv.value) != ''
    )
  ),
  '[]'
)
WHERE category != '人物'
  AND EXISTS (
    SELECT 1 FROM images i
    WHERE i.pack_id = packs.id
      AND i.status = 'active'
      AND i.keywords_json IS NOT NULL
      AND i.keywords_json != ''
      AND i.keywords_json != '[]'
  );

-- 清空图片级关键词，避免旧数据继续被当作匹配来源。
UPDATE images SET keywords_json = '[]' WHERE keywords_json IS NOT NULL AND keywords_json != '[]';
