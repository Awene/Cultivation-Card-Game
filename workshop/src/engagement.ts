import type { Context } from 'hono';
import { nowSeconds } from './db';
import type { AppVariables, Bindings } from './types';

type AppContext = Context<{ Bindings: Bindings; Variables: AppVariables }>;

async function assertPublished(context: AppContext, packId: string): Promise<void> {
  const pack = await context.env.DB.prepare("SELECT id FROM packs WHERE id = ? AND status = 'published'")
    .bind(packId)
    .first<{ id: string }>();
  if (!pack) throw new Response('图包不存在或已下架', { status: 404 });
}

async function packCounts(context: AppContext, packId: string): Promise<{ like_count: number; download_count: number }> {
  const row = await context.env.DB.prepare('SELECT like_count, download_count FROM packs WHERE id = ?')
    .bind(packId)
    .first<{ like_count: number; download_count: number }>();
  return { like_count: row?.like_count ?? 0, download_count: row?.download_count ?? 0 };
}

export async function likePack(context: AppContext): Promise<Response> {
  const packId = context.req.param('packId')!;
  await assertPublished(context, packId);
  const result = await context.env.DB.prepare('INSERT OR IGNORE INTO pack_likes (pack_id, user_id, created_at) VALUES (?, ?, ?)')
    .bind(packId, context.get('user').id, nowSeconds())
    .run();
  if (result.meta.changes) {
    await context.env.DB.prepare('UPDATE packs SET like_count = like_count + 1 WHERE id = ?').bind(packId).run();
  }
  return context.json({ ...(await packCounts(context, packId)), liked: true });
}

export async function unlikePack(context: AppContext): Promise<Response> {
  const packId = context.req.param('packId')!;
  const result = await context.env.DB.prepare('DELETE FROM pack_likes WHERE pack_id = ? AND user_id = ?')
    .bind(packId, context.get('user').id)
    .run();
  if (result.meta.changes) {
    await context.env.DB.prepare('UPDATE packs SET like_count = MAX(0, like_count - 1) WHERE id = ?').bind(packId).run();
  }
  return context.json({ ...(await packCounts(context, packId)), liked: false });
}

export async function listMyLikes(context: AppContext): Promise<Response> {
  const rows = await context.env.DB.prepare(
    `SELECT l.pack_id FROM pack_likes l JOIN packs p ON p.id = l.pack_id
     WHERE l.user_id = ? AND p.status = 'published' ORDER BY l.created_at DESC`,
  )
    .bind(context.get('user').id)
    .all<{ pack_id: string }>();
  return context.json({ pack_ids: rows.results.map(row => row.pack_id) });
}

export async function recordPackDownload(context: AppContext): Promise<Response> {
  const packId = context.req.param('packId')!;
  await assertPublished(context, packId);
  const fingerprint = [
    context.req.header('CF-Connecting-IP') ?? 'unknown',
    context.req.header('User-Agent') ?? 'unknown',
    packId,
  ].join('|');
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(fingerprint));
  const downloaderHash = [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, '0')).join('');
  const result = await context.env.DB.prepare(
    'INSERT OR IGNORE INTO pack_downloads (pack_id, downloader_hash, created_at) VALUES (?, ?, ?)',
  )
    .bind(packId, downloaderHash, nowSeconds())
    .run();
  if (result.meta.changes) {
    await context.env.DB.prepare('UPDATE packs SET download_count = download_count + 1 WHERE id = ?').bind(packId).run();
  }
  return context.json({ ...(await packCounts(context, packId)), counted: Boolean(result.meta.changes) });
}

