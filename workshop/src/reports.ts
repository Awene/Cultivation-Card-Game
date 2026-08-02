import type { Context } from 'hono';
import { newId, nowSeconds, writeAudit } from './db';
import type { AppVariables, Bindings } from './types';
import { InputError, parseJsonObject, requireString } from './validation';

type AppContext = Context<{ Bindings: Bindings; Variables: AppVariables }>;

export async function createReport(context: AppContext): Promise<Response> {
  const user = context.get('user');
  const body = parseJsonObject(await context.req.json());
  const targetType = body.target_type;
  if (targetType !== 'pack' && targetType !== 'image') throw new InputError('举报对象类型无效');
  const targetId = requireString(body.target_id, '举报对象', 3, 100);
  const reason = requireString(body.reason, '举报理由', 5, 500);
  const table = targetType === 'pack' ? 'packs' : 'images';
  const target = await context.env.DB.prepare(`SELECT id FROM ${table} WHERE id = ? AND status != 'removed'`)
    .bind(targetId)
    .first<{ id: string }>();
  if (!target) return context.json({ error: '举报对象不存在' }, 404);
  const existing = await context.env.DB.prepare(
    "SELECT id FROM reports WHERE reporter_id = ? AND target_type = ? AND target_id = ? AND status = 'open'",
  )
    .bind(user.id, targetType, targetId)
    .first();
  if (existing) return context.json({ error: '你已经提交过尚未处理的举报' }, 409);
  const reportId = newId('report');
  await context.env.DB.prepare(
    'INSERT INTO reports (id, reporter_id, target_type, target_id, reason, created_at) VALUES (?, ?, ?, ?, ?, ?)',
  )
    .bind(reportId, user.id, targetType, targetId, reason, nowSeconds())
    .run();
  await writeAudit(context.env, user.id, 'report.create', 'report', reportId, { targetType, targetId });
  return context.json({ report_id: reportId }, 201);
}

export async function listReports(context: AppContext): Promise<Response> {
  const status = context.req.query('status') ?? 'open';
  if (!['open', 'resolved', 'rejected'].includes(status)) throw new InputError('举报状态无效');
  const rows = await context.env.DB.prepare(
    `SELECT r.*, COALESCE(u.global_name, u.username) AS reporter_name
     FROM reports r JOIN users u ON u.id = r.reporter_id
     WHERE r.status = ? ORDER BY r.created_at DESC LIMIT 200`,
  )
    .bind(status)
    .all();
  return context.json({ items: rows.results });
}

export async function handleReport(context: AppContext): Promise<Response> {
  const reportId = context.req.param('reportId')!;
  const body = parseJsonObject(await context.req.json());
  const status = body.status;
  if (status !== 'resolved' && status !== 'rejected') throw new InputError('处置状态无效');
  const resolution = requireString(body.resolution, '处置说明', 2, 500);
  const now = nowSeconds();
  const result = await context.env.DB.prepare(
    "UPDATE reports SET status = ?, resolution = ?, handled_by = ?, handled_at = ? WHERE id = ? AND status = 'open'",
  )
    .bind(status, resolution, context.get('user').id, now, reportId)
    .run();
  if (!result.meta.changes) return context.json({ error: '举报不存在或已经处理' }, 404);
  await writeAudit(context.env, context.get('user').id, `report.${status}`, 'report', reportId, { resolution });
  return context.json({ ok: true });
}

export async function adminHideImage(context: AppContext): Promise<Response> {
  const imageId = context.req.param('imageId')!;
  const result = await context.env.DB.prepare(
    "UPDATE images SET status = 'hidden', updated_at = ? WHERE id = ? AND status = 'active'",
  )
    .bind(nowSeconds(), imageId)
    .run();
  if (!result.meta.changes) return context.json({ error: '图片不存在或已隐藏' }, 404);
  await context.env.DB.prepare(
    `UPDATE packs SET version = version + 1, updated_at = ?
     WHERE id = (SELECT pack_id FROM images WHERE id = ?)`,
  )
    .bind(nowSeconds(), imageId)
    .run();
  await writeAudit(context.env, context.get('user').id, 'admin.image.hide', 'image', imageId);
  return context.json({ ok: true });
}

export async function adminUnpublishPack(context: AppContext): Promise<Response> {
  const packId = context.req.param('packId')!;
  const result = await context.env.DB.prepare(
    "UPDATE packs SET status = 'hidden', version = version + 1, updated_at = ? WHERE id = ? AND status = 'published'",
  )
    .bind(nowSeconds(), packId)
    .run();
  if (!result.meta.changes) return context.json({ error: '图包不存在或未发布' }, 404);
  await writeAudit(context.env, context.get('user').id, 'admin.pack.unpublish', 'pack', packId);
  return context.json({ ok: true });
}
