import { HTTPException } from 'hono/http-exception';
import type { AuthUser, Bindings } from './types';

export const nowSeconds = (): number => Math.floor(Date.now() / 1000);

export function newId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replaceAll('-', '')}`;
}

/**
 * 管理员权限组判定：ADMIN_DISCORD_IDS 列表内（逗号分隔）任一值命中即视为管理员。
 * 支持三种匹配，大小写不敏感：
 *   1. Discord 数字用户 ID（最可靠，推荐）
 *   2. 用户名（Discord 全局唯一，如 "awene"）
 *   3. 全局显示名（不唯一，谨慎使用，如 "Awene"）
 * 管理员组可豁免上传数量限制等资材类限制。
 */
export function isAdminUser(
  env: Bindings,
  row: { id: string; username: string; global_name: string | null },
): boolean {
  const values = env.ADMIN_DISCORD_IDS.split(',')
    .map(value => value.trim().toLowerCase())
    .filter(Boolean);
  if (values.includes(row.id.toLowerCase())) return true;
  if (values.includes(row.username.toLowerCase())) return true;
  const globalName = (row.global_name || '').toLowerCase();
  return globalName.length > 0 && values.includes(globalName);
}

export async function getUserBySession(env: Bindings, tokenHash: string): Promise<AuthUser | null> {
  const now = nowSeconds();
  const row = await env.DB.prepare(
    `SELECT u.id, u.username, u.global_name, u.avatar, u.status
     FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = ? AND s.expires_at > ?`,
  )
    .bind(tokenHash, now)
    .first<{ id: string; username: string; global_name: string | null; avatar: string | null; status: 'active' | 'banned' }>();
  if (!row) return null;
  void env.DB.prepare('UPDATE sessions SET last_used_at = ? WHERE token_hash = ?').bind(now, tokenHash).run();
  return {
    id: row.id,
    username: row.username,
    globalName: row.global_name,
    avatar: row.avatar,
    status: row.status,
    isAdmin: isAdminUser(env, row),
  };
}

export async function writeAudit(
  env: Bindings,
  actorId: string | null,
  action: string,
  targetType: string,
  targetId: string,
  details: Record<string, unknown> = {},
): Promise<void> {
  await env.DB.prepare(
    'INSERT INTO audit_logs (id, actor_id, action, target_type, target_id, details_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
  )
    .bind(newId('audit'), actorId, action, targetType, targetId, JSON.stringify(details), nowSeconds())
    .run();
}

export async function enforceRateLimit(
  env: Bindings,
  bucket: string,
  subject: string,
  limit: number,
  windowSeconds: number,
): Promise<void> {
  const now = nowSeconds();
  const windowStart = Math.floor(now / windowSeconds) * windowSeconds;
  await env.DB.prepare(
    `INSERT INTO rate_limits (bucket, subject, window_start, count) VALUES (?, ?, ?, 1)
     ON CONFLICT(bucket, subject, window_start) DO UPDATE SET count = count + 1`,
  )
    .bind(bucket, subject, windowStart)
    .run();
  const row = await env.DB.prepare(
    'SELECT count FROM rate_limits WHERE bucket = ? AND subject = ? AND window_start = ?',
  )
    .bind(bucket, subject, windowStart)
    .first<{ count: number }>();
  // 注意：必须抛 HTTPException（Error 子类）。直接 throw new Response 会被 Hono 的
  // compose 原样 re-throw（其 catch 只接 Error 实例），变成未捕获异常 → Cloudflare 掐断连接 → 前端 fail to fetch。
  if ((row?.count ?? 0) > limit) throw new HTTPException(429, { message: '请求过于频繁，请稍后再试' });
}

