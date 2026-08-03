# 本格数值化修仙创意工坊后端

Cloudflare Worker + D1 + 私有 R2 的创意工坊 API。正文只在玩家浏览器本地匹配，本服务不接收正文、聊天历史、MVU 变量或世界书。

## 本地开发

```powershell
npm install
Copy-Item .dev.vars.example .dev.vars
# 在 .dev.vars 内填入本地测试 secret，文件禁止提交
npm run db:local
npm run dev
```

生产 D1、R2 与 Worker 已于 2026-08-03 创建并完成首次部署。正式服务地址为：

```text
https://cultivation-illustration-workshop.awenewilly1.workers.dev
```

本地开发继续使用 Wrangler 的本地 D1/R2 模拟；只有带 `--remote` 的迁移和正式部署会访问生产资源。

本地 `.dev.vars` 使用无效占位密钥，只用于健康接口和公开目录联调；真实 Discord 登录必须配置真实 Client Secret。该文件已被 Git 忽略。

## 生产资源

- Worker：`cultivation-illustration-workshop`
- D1：`cultivation-workshop-db`，绑定 `DB`
- 私有 R2：`cultivation-workshop-images`，绑定 `IMAGES`
- Discord Application ID：`1533494278263935108`
- 管理员 Discord ID：`808684321153482812`
- D1 Database ID：`e4ff7a37-a2a7-4253-83b2-a1e4cb9e5036`

不要启用 R2 的 `r2.dev` 公共访问。`DISCORD_CLIENT_SECRET` 与 `SESSION_SECRET` 必须通过 Cloudflare Secret 配置。

## 图片约束

- 仅 JPEG、PNG、WebP。
- 最大 8MB，宽高均不超过 1600px。
- 客户端必须用 Canvas 重新编码；服务端复验魔数、MIME、尺寸，并拒绝仍含 EXIF、文本或时间元数据的文件。
- GIF、SVG、脚本、多态文件和伪造扩展名会被拒绝。

## MVP 配额

- 每账号最多 20 个未删除图包。
- 每图包最多 200 张未删除图片。
- 每账号最多 1GB 有效图片。
- 单图最大 8MB；OAuth、建包和上传另有频率限制。

## 已验证

```powershell
npm run typecheck
npm test
npm run db:local
npx wrangler deploy --dry-run
```

本地 D1 迁移、`GET /api/health` 与空的 `GET /api/packs` 已完成实测。
