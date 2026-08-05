import type { Context } from 'hono';
import { ensureUploadCapacity } from './capacity';
import { newId, nowSeconds, writeAudit } from './db';
import { inspectImage } from './image';
import type { AppVariables, AuthUser, Bindings, PackCategory } from './types';
import {
  InputError,
  optionalString,
  parseCategory,
  parseJsonObject,
  parseKeywords,
  parseRating,
  requireString,
} from './validation';

type AppContext = Context<{ Bindings: Bindings; Variables: AppVariables }>;

const MAX_PACKS_PER_USER = 20;
const MAX_IMAGES_PER_PACK = 200;
const MAX_STORAGE_BYTES_PER_USER = 1024 * 1024 * 1024;

interface PackRow {
  id: string;
  owner_id: string;
  owner_name?: string;
  name: string;
  description: string;
  category: PackCategory;
  status: string;
  version: number;
  created_at: number;
  updated_at: number;
  published_at: number | null;
  image_count?: number;
  like_count: number;
  download_count: number;
  preview_image_id: string | null;
}

interface ImageRow {
  id: string;
  pack_id: string;
  object_key: string;
  character_name: string;
  rating: string;
  keywords_json: string;
  mime_type: string;
  width: number;
  height: number;
  byte_size: number;
  sha256: string;
  status: string;
  created_at: number;
  updated_at: number;
}

function publicPack(row: PackRow, baseUrl: string) {
  return {
    id: row.id,
    owner_id: row.owner_id,
    owner_name: row.owner_name,
    name: row.name,
    description: row.description,
    category: row.category,
    status: row.status,
    version: row.version,
    image_count: row.image_count,
    like_count: row.like_count ?? 0,
    download_count: row.download_count ?? 0,
    preview_image_id: row.preview_image_id ?? null,
    preview_url: row.preview_image_id ? `${baseUrl}/api/images/${row.preview_image_id}?v=${row.updated_at}` : null,
    created_at: row.created_at,
    updated_at: row.updated_at,
    published_at: row.published_at,
  };
}

function publicImage(row: ImageRow, baseUrl: string) {
  return {
    id: row.id,
    character_name: row.character_name,
    rating: row.rating,
    keywords: JSON.parse(row.keywords_json) as string[],
    mime_type: row.mime_type,
    width: row.width,
    height: row.height,
    byte_size: row.byte_size,
    sha256: row.sha256,
    status: row.status,
    download_url: `${baseUrl}/api/images/${row.id}?v=${row.sha256.slice(0, 12)}`,
    updated_at: row.updated_at,
  };
}

async function ownPack(context: AppContext, packId: string): Promise<PackRow> {
  const user = context.get('user');
  const pack = await context.env.DB.prepare('SELECT * FROM packs WHERE id = ? AND status != ?')
    .bind(packId, 'removed')
    .first<PackRow>();
  if (!pack) throw new Response('图包不存在', { status: 404 });
  if (pack.owner_id !== user.id && !user.isAdmin) throw new Response('无权操作此图包', { status: 403 });
  return pack;
}

async function bumpPublishedPack(context: AppContext, pack: PackRow): Promise<void> {
  if (pack.status !== 'published') return;
  await context.env.DB.prepare('UPDATE packs SET version = version + 1, updated_at = ? WHERE id = ?')
    .bind(nowSeconds(), pack.id)
    .run();
}

export async function listPublicPacks(context: AppContext): Promise<Response> {
  const query = (context.req.query('query') ?? '').trim().slice(0, 80);
  const category = context.req.query('category');
  const limit = Math.min(Math.max(Number(context.req.query('limit') ?? 24) || 24, 1), 50);
  const offset = Math.max(Number(context.req.query('offset') ?? 0) || 0, 0);
  const clauses = ["p.status = 'published'"];
  const bindings: unknown[] = [];
  if (query) {
    clauses.push('(p.name LIKE ? OR p.description LIKE ? OR u.username LIKE ? OR u.global_name LIKE ?)');
    const pattern = `%${query}%`;
    bindings.push(pattern, pattern, pattern, pattern);
  }
  if (category) {
    clauses.push('p.category = ?');
    bindings.push(parseCategory(category));
  }
  bindings.push(limit + 1, offset);
  const rows = await context.env.DB.prepare(
    `SELECT p.*, COALESCE(u.global_name, u.username) AS owner_name,
       (SELECT COUNT(*) FROM images i WHERE i.pack_id = p.id AND i.status = 'active') AS image_count
     FROM packs p JOIN users u ON u.id = p.owner_id
     WHERE ${clauses.join(' AND ')} ORDER BY p.updated_at DESC LIMIT ? OFFSET ?`,
  )
    .bind(...bindings)
    .all<PackRow>();
  const items = rows.results.slice(0, limit).map(row => publicPack(row, context.env.PUBLIC_BASE_URL));
  return context.json({ items, next_offset: rows.results.length > limit ? offset + limit : null });
}

export async function getPublicPack(context: AppContext): Promise<Response> {
  const pack = await context.env.DB.prepare(
    `SELECT p.*, COALESCE(u.global_name, u.username) AS owner_name
     FROM packs p JOIN users u ON u.id = p.owner_id WHERE p.id = ? AND p.status = 'published'`,
  )
    .bind(context.req.param('packId')!)
    .first<PackRow>();
  if (!pack) return context.json({ error: '图包不存在或已下架' }, 404);
  const images = await context.env.DB.prepare(
    "SELECT * FROM images WHERE pack_id = ? AND status = 'active' ORDER BY created_at, id",
  )
    .bind(pack.id)
    .all<ImageRow>();
  return context.json({
    pack: publicPack(pack, context.env.PUBLIC_BASE_URL),
    images: images.results.map(row => publicImage(row, context.env.PUBLIC_BASE_URL)),
  });
}

export async function getPackVersion(context: AppContext): Promise<Response> {
  const row = await context.env.DB.prepare('SELECT id, version, status, updated_at FROM packs WHERE id = ?')
    .bind(context.req.param('packId')!)
    .first<{ id: string; version: number; status: string; updated_at: number }>();
  if (!row || row.status === 'removed') return context.json({ error: '图包不存在' }, 404);
  return context.json(row);
}

export async function listOwnPacks(context: AppContext): Promise<Response> {
  const rows = await context.env.DB.prepare(
    `SELECT p.*, (SELECT COUNT(*) FROM images i WHERE i.pack_id = p.id AND i.status = 'active') AS image_count
     FROM packs p WHERE p.owner_id = ? AND p.status != 'removed' ORDER BY p.updated_at DESC`,
  )
    .bind(context.get('user').id)
    .all<PackRow>();
  return context.json({ items: rows.results.map(row => publicPack(row, context.env.PUBLIC_BASE_URL)) });
}

export async function getOwnPack(context: AppContext): Promise<Response> {
  const pack = await ownPack(context, context.req.param('packId')!);
  const images = await context.env.DB.prepare(
    "SELECT * FROM images WHERE pack_id = ? AND status != 'removed' ORDER BY created_at, id",
  )
    .bind(pack.id)
    .all<ImageRow>();
  return context.json({
    pack: publicPack(pack, context.env.PUBLIC_BASE_URL),
    images: images.results.map(row => publicImage(row, context.env.PUBLIC_BASE_URL)),
  });
}

export async function createPack(context: AppContext): Promise<Response> {
  const body = parseJsonObject(await context.req.json());
  const user = context.get('user');
  const usage = await context.env.DB.prepare("SELECT COUNT(*) AS count FROM packs WHERE owner_id = ? AND status != 'removed'")
    .bind(user.id)
    .first<{ count: number }>();
  if ((usage?.count ?? 0) >= MAX_PACKS_PER_USER) {
    throw new InputError(`每个账号最多保留 ${MAX_PACKS_PER_USER} 个图包`);
  }
  const id = newId('pack');
  const now = nowSeconds();
  const pack = {
    id,
    name: requireString(body.name, '图包名称', 1, 60),
    description: optionalString(body.description, '图包简介', 500),
    category: parseCategory(body.category),
  };
  await context.env.DB.prepare(
    'INSERT INTO packs (id, owner_id, name, description, category, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
  )
    .bind(pack.id, user.id, pack.name, pack.description, pack.category, now, now)
    .run();
  await writeAudit(context.env, user.id, 'pack.create', 'pack', id);
  return context.json(
    {
      pack: {
        ...pack,
        owner_id: user.id,
        status: 'draft',
        version: 1,
        image_count: 0,
        like_count: 0,
        download_count: 0,
        preview_image_id: null,
        preview_url: null,
        created_at: now,
        updated_at: now,
        published_at: null,
      },
    },
    201,
  );
}

export async function updatePack(context: AppContext): Promise<Response> {
  const pack = await ownPack(context, context.req.param('packId')!);
  const body = parseJsonObject(await context.req.json());
  const name = body.name === undefined ? pack.name : requireString(body.name, '图包名称', 1, 60);
  const description = body.description === undefined ? pack.description : optionalString(body.description, '图包简介', 500);
  const category = body.category === undefined ? pack.category : parseCategory(body.category);
  let previewImageId = pack.preview_image_id;
  if (body.preview_image_id !== undefined) {
    const candidate = optionalString(body.preview_image_id, '预览图', 100);
    if (candidate) {
      const image = await context.env.DB.prepare(
        "SELECT id FROM images WHERE id = ? AND pack_id = ? AND status = 'active'",
      )
        .bind(candidate, pack.id)
        .first<{ id: string }>();
      if (!image) throw new InputError('只能选择图包中的有效图片作为预览图');
      previewImageId = image.id;
    } else {
      previewImageId = null;
    }
  }
  const now = nowSeconds();
  await context.env.DB.prepare(
    `UPDATE packs SET name = ?, description = ?, category = ?, preview_image_id = ?,
       version = version + CASE WHEN status = 'published' THEN 1 ELSE 0 END, updated_at = ? WHERE id = ?`,
  )
    .bind(name, description, category, previewImageId, now, pack.id)
    .run();
  await writeAudit(context.env, context.get('user').id, 'pack.update', 'pack', pack.id, {
    name,
    category,
    previewImageId,
  });
  return context.json({ ok: true });
}

export async function publishPack(context: AppContext): Promise<Response> {
  const pack = await ownPack(context, context.req.param('packId')!);
  const images = await context.env.DB.prepare("SELECT character_name, keywords_json FROM images WHERE pack_id = ? AND status = 'active'")
    .bind(pack.id)
    .all<{ character_name: string; keywords_json: string }>();
  if (!images.results.length) throw new InputError('图包至少需要一张有效图片才能发布');
  if (pack.category === '人物' && images.results.some(image => !image.character_name.trim())) {
    throw new InputError('人物图包中的每张图片都必须填写角色名');
  }
  if (images.results.some(image => (JSON.parse(image.keywords_json) as string[]).length === 0)) {
    throw new InputError('每张图片都必须填写关键词');
  }
  const now = nowSeconds();
  await context.env.DB.prepare(
    `UPDATE packs SET status = 'published', version = version + CASE WHEN published_at IS NULL THEN 0 ELSE 1 END,
       published_at = COALESCE(published_at, ?), updated_at = ? WHERE id = ?`,
  )
    .bind(now, now, pack.id)
    .run();
  await writeAudit(context.env, context.get('user').id, 'pack.publish', 'pack', pack.id);
  return context.json({ ok: true });
}

export async function unpublishPack(context: AppContext): Promise<Response> {
  const pack = await ownPack(context, context.req.param('packId')!);
  await context.env.DB.prepare("UPDATE packs SET status = 'hidden', version = version + 1, updated_at = ? WHERE id = ?")
    .bind(nowSeconds(), pack.id)
    .run();
  await writeAudit(context.env, context.get('user').id, 'pack.unpublish', 'pack', pack.id);
  return context.json({ ok: true });
}

export async function removePack(context: AppContext): Promise<Response> {
  const pack = await ownPack(context, context.req.param('packId')!);
  const images = await context.env.DB.prepare("SELECT object_key FROM images WHERE pack_id = ? AND status != 'removed'")
    .bind(pack.id)
    .all<{ object_key: string }>();
  const keys = images.results.map(image => image.object_key);
  for (let offset = 0; offset < keys.length; offset += 1000) {
    await context.env.IMAGES.delete(keys.slice(offset, offset + 1000));
  }
  const now = nowSeconds();
  await context.env.DB.batch([
    context.env.DB.prepare('DELETE FROM pack_likes WHERE pack_id = ?').bind(pack.id),
    context.env.DB.prepare('DELETE FROM pack_downloads WHERE pack_id = ?').bind(pack.id),
    context.env.DB.prepare("UPDATE images SET status = 'removed', updated_at = ? WHERE pack_id = ? AND status != 'removed'").bind(
      now,
      pack.id,
    ),
    context.env.DB.prepare("UPDATE packs SET status = 'removed', version = version + 1, updated_at = ? WHERE id = ?").bind(
      now,
      pack.id,
    ),
  ]);
  await writeAudit(context.env, context.get('user').id, 'pack.remove', 'pack', pack.id);
  return context.json({ ok: true });
}

export async function uploadImage(context: AppContext): Promise<Response> {
  const pack = await ownPack(context, context.req.param('packId')!);
  const packUsage = await context.env.DB.prepare(
    "SELECT COUNT(*) AS count FROM images WHERE pack_id = ? AND status != 'removed'",
  )
    .bind(pack.id)
    .first<{ count: number }>();
  if ((packUsage?.count ?? 0) >= MAX_IMAGES_PER_PACK) {
    throw new InputError(`每个图包最多保留 ${MAX_IMAGES_PER_PACK} 张图片`);
  }
  const form = await context.req.formData();
  const file = form.get('file');
  if (!(file instanceof File)) throw new InputError('缺少图片文件');
  const bytes = new Uint8Array(await file.arrayBuffer());
  const ownerUsage = await context.env.DB.prepare(
    `SELECT COALESCE(SUM(i.byte_size), 0) AS bytes
     FROM images i JOIN packs p ON p.id = i.pack_id
     WHERE p.owner_id = ? AND p.status != 'removed' AND i.status != 'removed'`,
  )
    .bind(context.get('user').id)
    .first<{ bytes: number }>();
  if ((ownerUsage?.bytes ?? 0) + bytes.byteLength > MAX_STORAGE_BYTES_PER_USER) {
    throw new InputError('每个账号最多占用 1GB 云端图片空间');
  }
  let inspection;
  try {
    inspection = inspectImage(bytes, file.type || undefined);
  } catch (error) {
    throw new InputError(error instanceof Error ? error.message : '图片校验失败');
  }
  await ensureUploadCapacity(context.env, bytes.byteLength, pack.id);
  const rating = parseRating(form.get('rating'));
  const keywords = parseKeywords(form.get('keywords'));
  const characterName = optionalString(form.get('character_name'), '角色名', 60);
  if (pack.category === '人物' && !characterName) throw new InputError('人物图包必须填写角色名');
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const sha256 = [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, '0')).join('');
  const imageId = newId('image');
  const objectKey = `packs/${pack.id}/${imageId}/${sha256}.${inspection.extension}`;
  await context.env.IMAGES.put(objectKey, bytes, {
    httpMetadata: { contentType: inspection.mimeType, cacheControl: 'public, max-age=31536000, immutable' },
    customMetadata: { sha256, packId: pack.id, imageId },
  });
  const now = nowSeconds();
  try {
    await context.env.DB.prepare(
      `INSERT INTO images
       (id, pack_id, object_key, character_name, rating, keywords_json, mime_type, width, height, byte_size, sha256, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        imageId,
        pack.id,
        objectKey,
        characterName,
        rating,
        JSON.stringify(keywords),
        inspection.mimeType,
        inspection.width,
        inspection.height,
        bytes.byteLength,
        sha256,
        now,
        now,
      )
      .run();
    if (!pack.preview_image_id) {
      await context.env.DB.prepare('UPDATE packs SET preview_image_id = ? WHERE id = ? AND preview_image_id IS NULL')
        .bind(imageId, pack.id)
        .run();
    }
    await bumpPublishedPack(context, pack);
  } catch (error) {
    await context.env.IMAGES.delete(objectKey);
    throw error;
  }
  await writeAudit(context.env, context.get('user').id, 'image.upload', 'image', imageId, { packId: pack.id });
  return context.json(
    {
      image: publicImage(
        {
          id: imageId,
          pack_id: pack.id,
          object_key: objectKey,
          character_name: characterName,
          rating,
          keywords_json: JSON.stringify(keywords),
          mime_type: inspection.mimeType,
          width: inspection.width,
          height: inspection.height,
          byte_size: bytes.byteLength,
          sha256,
          status: 'active',
          created_at: now,
          updated_at: now,
        },
        context.env.PUBLIC_BASE_URL,
      ),
    },
    201,
  );
}

export async function updateImage(context: AppContext): Promise<Response> {
  const pack = await ownPack(context, context.req.param('packId')!);
  const image = await context.env.DB.prepare("SELECT * FROM images WHERE id = ? AND pack_id = ? AND status != 'removed'")
    .bind(context.req.param('imageId')!, pack.id)
    .first<ImageRow>();
  if (!image) return context.json({ error: '图片不存在' }, 404);
  const body = parseJsonObject(await context.req.json());
  const rating = body.rating === undefined ? image.rating : parseRating(body.rating);
  const keywords = body.keywords === undefined ? (JSON.parse(image.keywords_json) as string[]) : parseKeywords(body.keywords);
  const characterName = body.character_name === undefined
    ? image.character_name
    : optionalString(body.character_name, '角色名', 60);
  if (pack.category === '人物' && !characterName) throw new InputError('人物图包必须填写角色名');
  await context.env.DB.prepare(
    'UPDATE images SET character_name = ?, rating = ?, keywords_json = ?, updated_at = ? WHERE id = ?',
  )
    .bind(characterName, rating, JSON.stringify(keywords), nowSeconds(), image.id)
    .run();
  await bumpPublishedPack(context, pack);
  await writeAudit(context.env, context.get('user').id, 'image.update', 'image', image.id, { packId: pack.id });
  return context.json({ ok: true });
}

export async function removeImage(context: AppContext): Promise<Response> {
  const pack = await ownPack(context, context.req.param('packId')!);
  const image = await context.env.DB.prepare("SELECT * FROM images WHERE id = ? AND pack_id = ? AND status != 'removed'")
    .bind(context.req.param('imageId')!, pack.id)
    .first<ImageRow>();
  if (!image) return context.json({ error: '图片不存在' }, 404);
  await context.env.DB.prepare("UPDATE images SET status = 'removed', updated_at = ? WHERE id = ?")
    .bind(nowSeconds(), image.id)
    .run();
  if (pack.preview_image_id === image.id) {
    const replacement = await context.env.DB.prepare(
      "SELECT id FROM images WHERE pack_id = ? AND status = 'active' ORDER BY created_at, id LIMIT 1",
    )
      .bind(pack.id)
      .first<{ id: string }>();
    await context.env.DB.prepare('UPDATE packs SET preview_image_id = ? WHERE id = ?')
      .bind(replacement?.id ?? null, pack.id)
      .run();
  }
  await context.env.IMAGES.delete(image.object_key);
  await bumpPublishedPack(context, pack);
  await writeAudit(context.env, context.get('user').id, 'image.remove', 'image', image.id, { packId: pack.id });
  return context.json({ ok: true });
}

export async function serveImage(context: AppContext): Promise<Response> {
  const image = await context.env.DB.prepare(
    `SELECT i.* FROM images i JOIN packs p ON p.id = i.pack_id
     WHERE i.id = ? AND i.status = 'active' AND p.status = 'published'`,
  )
    .bind(context.req.param('imageId')!)
    .first<ImageRow>();
  if (!image) return context.json({ error: '图片不存在或已下架' }, 404);
  return imageObjectResponse(context, image, true);
}

export async function serveOwnImage(context: AppContext): Promise<Response> {
  const user = context.get('user');
  const image = await context.env.DB.prepare(
    `SELECT i.* FROM images i JOIN packs p ON p.id = i.pack_id
     WHERE i.id = ? AND i.status != 'removed' AND (p.owner_id = ? OR ? = 1)`,
  )
    .bind(context.req.param('imageId')!, user.id, user.isAdmin ? 1 : 0)
    .first<ImageRow>();
  if (!image) return context.json({ error: '图片不存在或无权预览' }, 404);
  return imageObjectResponse(context, image, false);
}

async function imageObjectResponse(context: AppContext, image: ImageRow, publicCache: boolean): Promise<Response> {
  const object = await context.env.IMAGES.get(image.object_key, { onlyIf: context.req.raw.headers });
  if (!object) return context.json({ error: '图片文件缺失' }, 404);
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('ETag', object.httpEtag);
  headers.set('Cache-Control', publicCache ? 'public, max-age=31536000, immutable' : 'private, no-store');
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Content-Security-Policy', "default-src 'none'; sandbox");
  headers.set('Cross-Origin-Resource-Policy', 'cross-origin');
  return new Response('body' in object ? object.body : null, { status: 'body' in object ? 200 : 304, headers });
}
