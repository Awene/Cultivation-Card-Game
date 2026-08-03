import type { Context, Next } from 'hono';
import { pkceChallenge, randomToken, sha256Hex } from './crypto';
import { getUserBySession, newId, nowSeconds, writeAudit } from './db';
import type { AppVariables, Bindings } from './types';
import { InputError, parseJsonObject, parseOpenerOrigin, requireString } from './validation';

type AppContext = Context<{ Bindings: Bindings; Variables: AppVariables }>;

function bearerToken(header: string | undefined): string | null {
  const match = header?.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

export async function requireAuth(context: AppContext, next: Next): Promise<Response | void> {
  const token = bearerToken(context.req.header('Authorization'));
  if (!token) return context.json({ error: '需要登录' }, 401);
  const user = await getUserBySession(context.env, await sha256Hex(token));
  if (!user) return context.json({ error: '登录已失效' }, 401);
  if (user.status === 'banned') return context.json({ error: '账号已被封禁' }, 403);
  context.set('user', user);
  await next();
}

export async function startDiscordLogin(context: AppContext): Promise<Response> {
  const openerOrigin = parseOpenerOrigin(context.req.query('opener_origin') ?? null);
  const loginIdValue = context.req.query('login_id');
  const loginId = loginIdValue ? requireString(loginIdValue, '登录标识', 32, 128) : null;
  const state = loginId ? `${loginId}.${randomToken()}` : randomToken();
  const verifier = randomToken(48);
  const now = nowSeconds();
  await context.env.DB.prepare(
    'INSERT INTO oauth_states (state_hash, code_verifier, opener_origin, expires_at, created_at) VALUES (?, ?, ?, ?, ?)',
  )
    .bind(await sha256Hex(state), verifier, openerOrigin, now + 600, now)
    .run();
  const authorize = new URL('https://discord.com/oauth2/authorize');
  authorize.searchParams.set('client_id', context.env.DISCORD_CLIENT_ID);
  authorize.searchParams.set('response_type', 'code');
  authorize.searchParams.set('redirect_uri', context.env.DISCORD_REDIRECT_URI);
  authorize.searchParams.set('scope', 'identify');
  authorize.searchParams.set('state', state);
  authorize.searchParams.set('code_challenge', await pkceChallenge(verifier));
  authorize.searchParams.set('code_challenge_method', 'S256');
  return context.redirect(authorize.toString(), 302);
}

export async function finishDiscordLogin(context: AppContext): Promise<Response> {
  const code = context.req.query('code');
  const state = context.req.query('state');
  if (!code || !state) throw new InputError('Discord 回调缺少 code/state');
  const stateHash = await sha256Hex(state);
  const stored = await context.env.DB.prepare(
    'SELECT code_verifier, opener_origin, expires_at FROM oauth_states WHERE state_hash = ?',
  )
    .bind(stateHash)
    .first<{ code_verifier: string; opener_origin: string; expires_at: number }>();
  if (!stored || stored.expires_at <= nowSeconds()) throw new InputError('登录状态已失效，请重新登录');
  await context.env.DB.prepare('DELETE FROM oauth_states WHERE state_hash = ?').bind(stateHash).run();

  const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: context.env.DISCORD_CLIENT_ID,
      client_secret: context.env.DISCORD_CLIENT_SECRET,
      grant_type: 'authorization_code',
      code,
      redirect_uri: context.env.DISCORD_REDIRECT_URI,
      code_verifier: stored.code_verifier,
    }),
  });
  if (!tokenResponse.ok) throw new Error(`Discord token 交换失败：${tokenResponse.status}`);
  const tokenData = (await tokenResponse.json()) as { access_token?: string; token_type?: string };
  if (!tokenData.access_token) throw new Error('Discord 未返回 access_token');
  const profileResponse = await fetch('https://discord.com/api/v10/users/@me', {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });
  if (!profileResponse.ok) throw new Error(`Discord 身份读取失败：${profileResponse.status}`);
  const profile = (await profileResponse.json()) as {
    id: string;
    username: string;
    global_name?: string | null;
    avatar?: string | null;
  };
  const now = nowSeconds();
  await context.env.DB.prepare(
    `INSERT INTO users (id, username, global_name, avatar, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET username = excluded.username, global_name = excluded.global_name,
       avatar = excluded.avatar, updated_at = excluded.updated_at`,
  )
    .bind(profile.id, profile.username, profile.global_name ?? null, profile.avatar ?? null, now, now)
    .run();
  const loginIdSeparator = state.indexOf('.');
  const loginCode = loginIdSeparator > 0 ? state.slice(0, loginIdSeparator) : randomToken();
  await context.env.DB.prepare(
    'INSERT INTO login_codes (code_hash, user_id, opener_origin, expires_at, created_at) VALUES (?, ?, ?, ?, ?)',
  )
    .bind(await sha256Hex(loginCode), profile.id, stored.opener_origin, now + 120, now)
    .run();
  await writeAudit(context.env, profile.id, 'auth.login', 'user', profile.id);

  const nonce = randomToken(18);
  const payload = JSON.stringify({ type: 'cultivation-workshop-oauth', code: loginCode });
  const targetOrigin = JSON.stringify(stored.opener_origin);
  const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>登录成功</title></head>
<body><p>Discord 登录成功，此窗口将自动关闭。</p><script nonce="${nonce}">
if(window.opener){window.opener.postMessage(${payload},${targetOrigin});}window.close();
</script></body></html>`;
  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Security-Policy': `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'none'; base-uri 'none'; frame-ancestors 'none'`,
      'Referrer-Policy': 'no-referrer',
    },
  });
}

export async function exchangeLoginCode(context: AppContext): Promise<Response> {
  const body = parseJsonObject(await context.req.json());
  const code = requireString(body.code, '登录码', 20, 256);
  const codeHash = await sha256Hex(code);
  const now = nowSeconds();
  const row = await context.env.DB.prepare(
    'SELECT user_id, expires_at, used_at FROM login_codes WHERE code_hash = ?',
  )
    .bind(codeHash)
    .first<{ user_id: string; expires_at: number; used_at: number | null }>();
  if (!row || row.used_at || row.expires_at <= now) return context.json({ error: '登录码无效或已使用' }, 400);
  const result = await context.env.DB.prepare(
    'UPDATE login_codes SET used_at = ? WHERE code_hash = ? AND used_at IS NULL',
  )
    .bind(now, codeHash)
    .run();
  if (!result.meta.changes) return context.json({ error: '登录码已使用' }, 400);
  const token = randomToken();
  await context.env.DB.prepare(
    'INSERT INTO sessions (token_hash, user_id, expires_at, created_at, last_used_at) VALUES (?, ?, ?, ?, ?)',
  )
    .bind(await sha256Hex(token), row.user_id, now + 7 * 24 * 60 * 60, now, now)
    .run();
  return context.json({ token, expires_at: now + 7 * 24 * 60 * 60 });
}

export async function logout(context: AppContext): Promise<Response> {
  const token = bearerToken(context.req.header('Authorization'));
  if (token) await context.env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(await sha256Hex(token)).run();
  return context.json({ ok: true });
}
