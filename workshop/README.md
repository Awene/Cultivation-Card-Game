# 本格数值化修仙创意工坊后端

Cloudflare Worker + D1 + 私有 R2 的创意工坊 API。正文只在玩家浏览器本地匹配，本服务不接收正文、聊天历史或 MVU 变量；只有作者明确上传的创意工坊世界书包会存入私有 R2。

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
- 最大 6MB，宽高均不超过 1600px。
- 客户端必须用 Canvas 重新编码；服务端复验魔数、MIME、尺寸，并拒绝仍含 EXIF、文本或时间元数据的文件。
- GIF、SVG、脚本、多态文件和伪造扩展名会被拒绝。

## 世界书包约束

- 接受 SillyTavern 世界书 JSON，单包最多 5MB、500 个条目。
- 每个条目名称均须以 `[DLC][角色|事件|扩展][名称]` 开头，并且同一文件内的前三段必须完全一致；任意条目不合规会拒绝整个文件。
- 可在必填前缀后追加命定格式的关系标记：`[!目标]` 表示互斥、`[>目标]` 表示替换、`[<目标]` 表示前置依赖。
- 前置依赖缺失只显示警告，不阻止启用；互斥包会停用，替换条目在停用或卸载包后恢复原状态。
- 每账号最多保留 30 个未删除世界书包。世界书可能包含 EJS 等可执行内容，客户端安装界面会提示用户只安装可信作者的内容。

## MVP 配额

- 每账号最多 20 个未删除图包。
- 每图包最多 200 张未删除图片。
- 每账号最多 1GB 有效图片。
- 单图最大 6MB；OAuth、建包和上传另有频率限制。

## 云端容量与热度

- `STORAGE_SOFT_LIMIT_BYTES`：触发自动清理的软上限，默认 9,000,000,000 字节。
- `STORAGE_TARGET_BYTES`：触发后回收至的目标水位，默认 8,500,000,000 字节。
- `PACK_GRACE_PERIOD_DAYS`：公开图包的保护期，默认 30 天。
- 草稿和下架图包不会被自动淘汰；没有合格候选时会拒绝新上传，不会删除作者的未公开内容。
- 保护期外按保留分从低到高清理：`8×ln(1+点赞) + 3×ln(1+下载) + 12÷√(发布天数/保护期)`。因此新图包有保鲜分，长期无人问津的图包会逐渐排到前面，老牌高互动图包仍会保留。
- 点赞按 Discord 账号去重；下载按图包和匿名客户端哈希去重，不保存原始 IP。

## 已验证

```powershell
npm run typecheck
npm test
npm run db:local
npx wrangler deploy --dry-run
```

本地 D1 迁移、`GET /api/health` 与空的 `GET /api/packs` 已完成实测。
