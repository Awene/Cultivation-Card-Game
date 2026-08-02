import type { AuthUser, Bindings } from './types';

export const nowSeconds = (): number => Math.floor(Date.now() / 1000);

export function newId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replaceAll('-', '')}`;
}

export function adminIds(env: Bindings): Set<string> {
  return new Set(env.ADMIN_DISCORD_IDS.split(',').map(value => value.trim()).filter(Boolean));
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
    isAdmin: adminIds(env).has(row.id),
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
  if ((row?.count ?? 0) > limit) throw new Response('请求过于频繁，请稍后再试', { status: 429 });
}

