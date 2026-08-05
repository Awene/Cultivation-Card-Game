import type { Context } from 'hono';
import { ensureUploadCapacity } from './capacity';
import { newId, nowSeconds, writeAudit } from './db';
import { inspectImage } from './image';
import type { AppVariables, Bindings } from './types';
import { InputError, optionalString, parseJsonObject } from './validation';
import { validateWorldbookPayload, type DlcRelations, type WorldbookCategory } from './worldbook-prefix';

type AppContext = Context<{ Bindings: Bindings; Variables: AppVariables }>;

const MAX_WORLDBOOKS_PER_USER = 30;
const MAX_WORLDBOOK_BYTES = 5 * 1024 * 1024;

interface WorldbookPackRow {
  id: string;
  owner_id: string;
  owner_name?: string;
  name: string;
  description: string;
  category: WorldbookCategory;
  dlc_key: string;
  relations_json: string;
  status: 'draft' | 'published' | 'hidden' | 'removed';
  version: number;
  entry_count: number;
  object_key: string;
  byte_size: number;
  sha256: string;
  cover_object_key: string | null;
  cover_mime_type: string | null;
  cover_byte_size: number | null;
  cover_sha256: string | null;
  created_at: number;
  updated_at: number;
  published_at: number | null;
}

function publicWorldbook(row: WorldbookPackRow, baseUrl: string) {
  return {
    id: row.id,
    owner_id: row.owner_id,
    owner_name: row.owner_name,
    name: row.name,
    description: row.description,
    category: row.category,
    dlc_key: row.dlc_key,
    relations: JSON.parse(row.relations_json) as DlcRelations,
    status: row.status,
    version: row.version,
    entry_count: row.entry_count,
    byte_size: row.byte_size,
    sha256: row.sha256,
    download_url: `${baseUrl}/api/worldbooks/${row.id}/content`,
    cover_url: row.cover_object_key ? `${baseUrl}/api/worldbooks/${row.id}/cover?v=${row.cover_sha256?.slice(0, 12) ?? row.updated_at}` : null,
    created_at: row.created_at,
    updated_at: row.updated_at,
    published_at: row.published_at,
  };
}

async function ownWorldbook(context: AppContext, packId: string): Promise<WorldbookPackRow> {
  const user = context.get('user');
  const row = await context.env.DB.prepare("SELECT * FROM worldbook_packs WHERE id = ? AND status != 'removed'").bind(packId).first<WorldbookPackRow>();
  if (!row) throw new Response('世界书包不存在', { status: 404 });
  if (row.owner_id !== user.id && !user.isAdmin) throw new Response('无权操作此世界书包', { status: 403 });
  return row;
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes.slice().buffer as ArrayBuffer);
  return [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, '0')).join('');
}

interface CoverUpload {
  bytes: Uint8Array;
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
  extension: 'jpg' | 'png' | 'webp';
  sha256: string;
}

async function readCover(value: FormDataEntryValue | null): Promise<CoverUpload | null> {
  if (!(value instanceof File) || value.size === 0) return null;
  const bytes = new Uint8Array(await value.arrayBuffer());
  let inspection;
  try {
    inspection = inspectImage(bytes, value.type || undefined);
  } catch (error) {
    throw new InputError(error instanceof Error ? error.message : '封面图片校验失败');
  }
  return {
    bytes,
    mimeType: inspection.mimeType,
    extension: inspection.extension,
    sha256: await sha256Hex(bytes),
  };
}

async function readUpload(context: AppContext): Promise<{
  bytes: Uint8Array;
  description: string;
  cover: CoverUpload | null;
}> {
  const form = await context.req.formData();
  const file = form.get('file');
  if (!(file instanceof File)) throw new InputError('缺少世界书 JSON 文件');
  if (file.size < 2 || file.size > MAX_WORLDBOOK_BYTES) throw new InputError('世界书文件必须小于 5MB');
  return {
    bytes: new Uint8Array(await file.arrayBuffer()),
    description: optionalString(form.get('description'), '世界书包简介', 500),
    cover: await readCover(form.get('cover')),
  };
}

async function storeCover(context: AppContext, packId: string, cover: CoverUpload, capacityChecked = false): Promise<string> {
  if (!capacityChecked) await ensureUploadCapacity(context.env, cover.bytes.byteLength, packId);
  const objectKey = `worldbooks/${packId}/cover/${cover.sha256}.${cover.extension}`;
  await context.env.IMAGES.put(objectKey, cover.bytes, {
    httpMetadata: {
      contentType: cover.mimeType,
      cacheControl: 'public, max-age=31536000, immutable',
    },
    customMetadata: { sha256: cover.sha256, packId, kind: 'worldbook-cover' },
  });
  return objectKey;
}

export async function listPublicWorldbooks(context: AppContext): Promise<Response> {
  const query = (context.req.query('query') ?? '').trim().slice(0, 80);
  const category = context.req.query('category');
  const limit = Math.min(Math.max(Number(context.req.query('limit') ?? 24) || 24, 1), 50);
  const offset = Math.max(Number(context.req.query('offset') ?? 0) || 0, 0);
  const clauses = ["w.status = 'published'"];
  const bindings: unknown[] = [];
  if (query) {
    const pattern = `%${query}%`;
    clauses.push('(w.name LIKE ? OR w.description LIKE ? OR u.username LIKE ? OR u.global_name LIKE ?)');
    bindings.push(pattern, pattern, pattern, pattern);
  }
  if (category) {
    if (category !== '角色' && category !== '事件' && category !== '扩展') throw new InputError('世界书类别无效');
    clauses.push('w.category = ?');
    bindings.push(category);
  }
  bindings.push(limit + 1, offset);
  const rows = await context.env.DB.prepare(
    `SELECT w.*, COALESCE(u.global_name, u.username) AS owner_name
     FROM worldbook_packs w JOIN users u ON u.id = w.owner_id
     WHERE ${clauses.join(' AND ')} ORDER BY w.updated_at DESC LIMIT ? OFFSET ?`,
  )
    .bind(...bindings)
    .all<WorldbookPackRow>();
  return context.json({
    items: rows.results.slice(0, limit).map(row => publicWorldbook(row, context.env.PUBLIC_BASE_URL)),
    next_offset: rows.results.length > limit ? offset + limit : null,
  });
}

export async function getPublicWorldbook(context: AppContext): Promise<Response> {
  const row = await context.env.DB.prepare(
    `SELECT w.*, COALESCE(u.global_name, u.username) AS owner_name
     FROM worldbook_packs w JOIN users u ON u.id = w.owner_id WHERE w.id = ? AND w.status = 'published'`,
  )
    .bind(context.req.param('packId')!)
    .first<WorldbookPackRow>();
  if (!row) return context.json({ error: '世界书包不存在或已下架' }, 404);
  return context.json({
    pack: publicWorldbook(row, context.env.PUBLIC_BASE_URL),
  });
}

export async function getWorldbookVersion(context: AppContext): Promise<Response> {
  const row = await context.env.DB.prepare('SELECT id, version, status, updated_at FROM worldbook_packs WHERE id = ?')
    .bind(context.req.param('packId')!)
    .first<{
      id: string;
      version: number;
      status: string;
      updated_at: number;
    }>();
  if (!row || row.status === 'removed') return context.json({ error: '世界书包不存在' }, 404);
  return context.json(row);
}

export async function listOwnWorldbooks(context: AppContext): Promise<Response> {
  const rows = await context.env.DB.prepare("SELECT * FROM worldbook_packs WHERE owner_id = ? AND status != 'removed' ORDER BY updated_at DESC")
    .bind(context.get('user').id)
    .all<WorldbookPackRow>();
  return context.json({
    items: rows.results.map(row => publicWorldbook(row, context.env.PUBLIC_BASE_URL)),
  });
}

export async function getOwnWorldbook(context: AppContext): Promise<Response> {
  const row = await ownWorldbook(context, context.req.param('packId')!);
  return context.json({
    pack: publicWorldbook(row, context.env.PUBLIC_BASE_URL),
  });
}

export async function createWorldbookPack(context: AppContext): Promise<Response> {
  const user = context.get('user');
  const usage = await context.env.DB.prepare("SELECT COUNT(*) AS count FROM worldbook_packs WHERE owner_id = ? AND status != 'removed'")
    .bind(user.id)
    .first<{ count: number }>();
  if ((usage?.count ?? 0) >= MAX_WORLDBOOKS_PER_USER) {
    throw new InputError(`每个账号最多保留 ${MAX_WORLDBOOKS_PER_USER} 个世界书包`);
  }
  const upload = await readUpload(context);
  const metadata = validateWorldbookPayload(upload.bytes);
  const id = newId('worldbook');
  const digest = await sha256Hex(upload.bytes);
  const objectKey = `worldbooks/${id}/${digest}.json`;
  const now = nowSeconds();
  await ensureUploadCapacity(context.env, upload.bytes.byteLength + (upload.cover?.bytes.byteLength ?? 0), id);
  await context.env.IMAGES.put(objectKey, upload.bytes, {
    httpMetadata: {
      contentType: 'application/json; charset=utf-8',
      cacheControl: 'private, no-store',
    },
    customMetadata: { sha256: digest, packId: id, kind: 'worldbook' },
  });
  let coverObjectKey: string | null = null;
  try {
    coverObjectKey = upload.cover ? await storeCover(context, id, upload.cover, true) : null;
    await context.env.DB.prepare(
      `INSERT INTO worldbook_packs
       (id, owner_id, name, description, category, dlc_key, relations_json, entry_count, object_key, byte_size, sha256,
        cover_object_key, cover_mime_type, cover_byte_size, cover_sha256, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        id,
        user.id,
        metadata.name,
        upload.description,
        metadata.category,
        metadata.dlcKey,
        JSON.stringify(metadata.relations),
        metadata.entryCount,
        objectKey,
        upload.bytes.byteLength,
        digest,
        coverObjectKey,
        upload.cover?.mimeType ?? null,
        upload.cover?.bytes.byteLength ?? null,
        upload.cover?.sha256 ?? null,
        now,
        now,
      )
      .run();
  } catch (error) {
    await context.env.IMAGES.delete(objectKey);
    if (coverObjectKey) await context.env.IMAGES.delete(coverObjectKey);
    throw error;
  }
  await writeAudit(context.env, user.id, 'worldbook.create', 'worldbook', id, {
    dlcKey: metadata.dlcKey,
  });
  const row = await ownWorldbook(context, id);
  return context.json({ pack: publicWorldbook(row, context.env.PUBLIC_BASE_URL) }, 201);
}

export async function updateWorldbookPack(context: AppContext): Promise<Response> {
  const row = await ownWorldbook(context, context.req.param('packId')!);
  const body = parseJsonObject(await context.req.json());
  const description = body.description === undefined ? row.description : optionalString(body.description, '世界书包简介', 500);
  const now = nowSeconds();
  await context.env.DB.prepare(
    `UPDATE worldbook_packs SET description = ?, version = version + CASE WHEN status = 'published' THEN 1 ELSE 0 END,
     updated_at = ? WHERE id = ?`,
  )
    .bind(description, now, row.id)
    .run();
  await writeAudit(context.env, context.get('user').id, 'worldbook.update', 'worldbook', row.id);
  return context.json({ ok: true });
}

export async function uploadWorldbookCover(context: AppContext): Promise<Response> {
  const row = await ownWorldbook(context, context.req.param('packId')!);
  const form = await context.req.formData();
  const cover = await readCover(form.get('cover'));
  if (!cover) throw new InputError('缺少封面图片');
  const objectKey = await storeCover(context, row.id, cover);
  const now = nowSeconds();
  try {
    await context.env.DB.prepare(
      `UPDATE worldbook_packs SET cover_object_key = ?, cover_mime_type = ?, cover_byte_size = ?, cover_sha256 = ?,
       updated_at = ? WHERE id = ?`,
    )
      .bind(objectKey, cover.mimeType, cover.bytes.byteLength, cover.sha256, now, row.id)
      .run();
  } catch (error) {
    await context.env.IMAGES.delete(objectKey);
    throw error;
  }
  if (row.cover_object_key && row.cover_object_key !== objectKey) await context.env.IMAGES.delete(row.cover_object_key);
  await writeAudit(context.env, context.get('user').id, 'worldbook.cover.update', 'worldbook', row.id);
  const updated = await ownWorldbook(context, row.id);
  return context.json({
    pack: publicWorldbook(updated, context.env.PUBLIC_BASE_URL),
  });
}

export async function replaceWorldbookContent(context: AppContext): Promise<Response> {
  const row = await ownWorldbook(context, context.req.param('packId')!);
  const upload = await readUpload(context);
  const metadata = validateWorldbookPayload(upload.bytes);
  const digest = await sha256Hex(upload.bytes);
  const objectKey = `worldbooks/${row.id}/${digest}.json`;
  const now = nowSeconds();
  if (objectKey !== row.object_key) await ensureUploadCapacity(context.env, upload.bytes.byteLength, row.id);
  await context.env.IMAGES.put(objectKey, upload.bytes, {
    httpMetadata: {
      contentType: 'application/json; charset=utf-8',
      cacheControl: 'private, no-store',
    },
    customMetadata: { sha256: digest, packId: row.id, kind: 'worldbook' },
  });
  try {
    await context.env.DB.prepare(
      `UPDATE worldbook_packs SET name = ?, description = ?, category = ?, dlc_key = ?, relations_json = ?,
       entry_count = ?, object_key = ?, byte_size = ?, sha256 = ?,
       version = version + CASE WHEN status = 'published' THEN 1 ELSE 0 END, updated_at = ? WHERE id = ?`,
    )
      .bind(
        metadata.name,
        upload.description,
        metadata.category,
        metadata.dlcKey,
        JSON.stringify(metadata.relations),
        metadata.entryCount,
        objectKey,
        upload.bytes.byteLength,
        digest,
        now,
        row.id,
      )
      .run();
  } catch (error) {
    if (objectKey !== row.object_key) await context.env.IMAGES.delete(objectKey);
    throw error;
  }
  if (objectKey !== row.object_key) await context.env.IMAGES.delete(row.object_key);
  await writeAudit(context.env, context.get('user').id, 'worldbook.content.update', 'worldbook', row.id, {
    dlcKey: metadata.dlcKey,
  });
  return context.json({ ok: true });
}

export async function publishWorldbook(context: AppContext): Promise<Response> {
  const row = await ownWorldbook(context, context.req.param('packId')!);
  const now = nowSeconds();
  await context.env.DB.prepare(
    `UPDATE worldbook_packs SET status = 'published', version = version + CASE WHEN published_at IS NULL THEN 0 ELSE 1 END,
     published_at = COALESCE(published_at, ?), updated_at = ? WHERE id = ?`,
  )
    .bind(now, now, row.id)
    .run();
  await writeAudit(context.env, context.get('user').id, 'worldbook.publish', 'worldbook', row.id);
  return context.json({ ok: true });
}

export async function unpublishWorldbook(context: AppContext): Promise<Response> {
  const row = await ownWorldbook(context, context.req.param('packId')!);
  await context.env.DB.prepare("UPDATE worldbook_packs SET status = 'hidden', version = version + 1, updated_at = ? WHERE id = ?")
    .bind(nowSeconds(), row.id)
    .run();
  await writeAudit(context.env, context.get('user').id, 'worldbook.unpublish', 'worldbook', row.id);
  return context.json({ ok: true });
}

export async function removeWorldbookPack(context: AppContext): Promise<Response> {
  const row = await ownWorldbook(context, context.req.param('packId')!);
  await context.env.DB.prepare("UPDATE worldbook_packs SET status = 'removed', version = version + 1, updated_at = ? WHERE id = ?")
    .bind(nowSeconds(), row.id)
    .run();
  await context.env.IMAGES.delete(row.object_key);
  if (row.cover_object_key) await context.env.IMAGES.delete(row.cover_object_key);
  await writeAudit(context.env, context.get('user').id, 'worldbook.remove', 'worldbook', row.id);
  return context.json({ ok: true });
}

export async function serveWorldbookContent(context: AppContext): Promise<Response> {
  const row = await context.env.DB.prepare("SELECT * FROM worldbook_packs WHERE id = ? AND status = 'published'")
    .bind(context.req.param('packId')!)
    .first<WorldbookPackRow>();
  if (!row) return context.json({ error: '世界书包不存在或已下架' }, 404);
  return worldbookObjectResponse(context, row, true);
}

export async function serveOwnWorldbookContent(context: AppContext): Promise<Response> {
  const row = await ownWorldbook(context, context.req.param('packId')!);
  return worldbookObjectResponse(context, row, false);
}

export async function serveWorldbookCover(context: AppContext): Promise<Response> {
  const row = await context.env.DB.prepare("SELECT * FROM worldbook_packs WHERE id = ? AND status != 'removed'")
    .bind(context.req.param('packId')!)
    .first<WorldbookPackRow>();
  if (!row?.cover_object_key) return context.json({ error: '世界书包没有封面' }, 404);
  const object = await context.env.IMAGES.get(row.cover_object_key, {
    onlyIf: context.req.raw.headers,
  });
  if (!object) return context.json({ error: '世界书包封面缺失' }, 404);
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('ETag', object.httpEtag);
  headers.set('Cache-Control', 'public, max-age=300');
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Cross-Origin-Resource-Policy', 'cross-origin');
  return new Response('body' in object ? object.body : null, {
    status: 'body' in object ? 200 : 304,
    headers,
  });
}

async function worldbookObjectResponse(context: AppContext, row: WorldbookPackRow, publicCache: boolean): Promise<Response> {
  const object = await context.env.IMAGES.get(row.object_key, {
    onlyIf: context.req.raw.headers,
  });
  if (!object) return context.json({ error: '世界书文件缺失' }, 404);
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('ETag', object.httpEtag);
  headers.set('Cache-Control', publicCache ? 'public, max-age=300' : 'private, no-store');
  headers.set('Content-Disposition', `attachment; filename="worldbook-${row.id}.json"`);
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Cross-Origin-Resource-Policy', 'cross-origin');
  return new Response('body' in object ? object.body : null, {
    status: 'body' in object ? 200 : 304,
    headers,
  });
}
