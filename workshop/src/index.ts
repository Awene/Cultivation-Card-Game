import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { secureHeaders } from 'hono/secure-headers';
import { exchangeLoginCode, finishDiscordLogin, logout, requireAuth, startDiscordLogin } from './auth';
import { enforceRateLimit } from './db';
import {
  createPack,
  getOwnPack,
  getPackVersion,
  getPublicPack,
  listOwnPacks,
  listPublicPacks,
  publishPack,
  removeImage,
  removePack,
  serveImage,
  serveOwnImage,
  unpublishPack,
  updateImage,
  updatePack,
  uploadImage,
} from './packs';
import type { AppVariables, Bindings } from './types';
import { InputError } from './validation';

const app = new Hono<{ Bindings: Bindings; Variables: AppVariables }>();

app.use('*', secureHeaders({ referrerPolicy: 'no-referrer', crossOriginOpenerPolicy: false }));
app.use('*', async (context, next) => {
  await next();
  context.header(
    'Cross-Origin-Opener-Policy',
    context.req.path.startsWith('/auth/discord/') ? 'unsafe-none' : 'same-origin',
  );
});
app.use(
  '/api/*',
  cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Authorization', 'Content-Type', 'If-None-Match'],
    exposeHeaders: ['ETag', 'Content-Length'],
    maxAge: 86400,
  }),
);

app.get('/', context =>
  context.html(`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<title>本格数值化修仙创意工坊</title></head><body><main><h1>本格数值化修仙创意工坊</h1>
<p>服务已经运行。请从酒馆角色卡中的创意工坊界面访问图包。</p></main></body></html>`),
);
app.get('/api/health', context => context.json({ ok: true, service: 'cultivation-illustration-workshop', version: '0.1.0' }));

app.get('/auth/discord/start', async context => {
  await enforceRateLimit(context.env, 'oauth-start', context.req.header('CF-Connecting-IP') ?? 'unknown', 20, 600);
  return startDiscordLogin(context);
});
app.get('/auth/discord/callback', finishDiscordLogin);
app.post('/api/auth/exchange', exchangeLoginCode);
app.post('/api/auth/logout', logout);
app.get('/api/auth/me', requireAuth, context => context.json({ user: context.get('user') }));

app.get('/api/packs', listPublicPacks);
app.get('/api/packs/:packId', getPublicPack);
app.get('/api/packs/:packId/version', getPackVersion);
app.get('/api/images/:imageId', serveImage);

app.get('/api/me/packs', requireAuth, listOwnPacks);
app.get('/api/me/packs/:packId', requireAuth, getOwnPack);
app.get('/api/me/images/:imageId', requireAuth, serveOwnImage);
app.post('/api/packs', requireAuth, async context => {
  await enforceRateLimit(context.env, 'pack-create', context.get('user').id, 30, 86400);
  return createPack(context);
});
app.patch('/api/packs/:packId', requireAuth, updatePack);
app.post('/api/packs/:packId/publish', requireAuth, publishPack);
app.post('/api/packs/:packId/unpublish', requireAuth, unpublishPack);
app.delete('/api/packs/:packId', requireAuth, removePack);
app.post('/api/packs/:packId/images', requireAuth, async context => {
  await enforceRateLimit(context.env, 'image-upload', context.get('user').id, 100, 86400);
  return uploadImage(context);
});
app.patch('/api/packs/:packId/images/:imageId', requireAuth, updateImage);
app.delete('/api/packs/:packId/images/:imageId', requireAuth, removeImage);

app.notFound(context => context.json({ error: '接口不存在' }, 404));
app.onError((error, context) => {
  if (error instanceof InputError) return context.json({ error: error.message }, 400);
  if (error instanceof Response) return error;
  console.error('[workshop]', error);
  return context.json({ error: '服务器内部错误' }, 500);
});

export default app;
