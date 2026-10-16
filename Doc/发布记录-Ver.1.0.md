# Ver.1.0 发布记录

日期：2026-10-16。交付版本为 `Ver.1.0`，前端固定版本为 `v1.0.60`。三份交付物位于 `发布文件/Ver.1.0/`。

## 构建与 Git 版本

- 前端功能源码：`5fe28db5723eb6cfcf95d63e458dc28cec5ece3e`。
- 前端构建输入（含回归检查调整）：`97cdf860e736e683f00af65657023293fbcc3017`。
- 前端产物提交、`v1.0.60` 解引用目标：`ecedcb95541dca4527508a8c0ba25c5e68b0b692`。
- 前端构建读取的角色卡规则提交：`c871af074412de97c381df11a408a3aa7388132c`。后续预设字数修复与正式指针变更不属于前端编译输入。
- 路由插件：`9142370ab1cdb009bd76b6c0b22a7b11d0a88c70`，已推送 `main`；本地酒馆扩展目录使用该提交。
- 角色卡最终发布提交为包含本文及三份交付物的 `release: publish Ver.1.0 delivery artifacts` 提交，可通过 Git 日志查询；推送后须核对远端 `main`。

三个仓库均通过 Git 发布；前端另推送不可变 tag。未将无关参考文件删除、诊断样本和示例构建产物纳入本次提交。

## 本次内容与验证

- 预设按最新源码重新打包。语言字数设置使用普通宏保存值，在 SETTING 中按路由选择日常或世界推进字数，避免 EJS 与宏执行顺序导致原始宏泄漏。初始化不再清空字数。
- 用户确认当前预设测试正常。自动回归覆盖模型、世界推进、异常路由和变量模式；浏览器实际执行宏替换与 EJS 渲染的四种路由案例通过，没有原始字数宏残留。
- 前端包含原生停止按钮取消任务与灵根测试开局修改，路由插件包含停止后中断路由及后续请求的处理。
- Node.js 24.13.1、pnpm 10.33.2；`pnpm install --frozen-lockfile`、`pnpm dump`、`pnpm lint`、`pnpm build:frontend` 均成功。lint 为 0 错误、89 警告，构建有包体积警告。
- 前端回归：`test_character_generation_task.mjs`、`test_story_catalog.mjs`、`test_discord_fixes.mjs`、`test_formation_items.mjs` 通过。
- 角色卡 `node scratchpad/test_preset_short_cot.mjs` 通过；路由插件语法检查及 `tests/cancellation.mjs` 通过。
- `node tavern_sync.mjs bundle 本格修仙`、`node tavern_sync.mjs bundle 本格修仙预设` 成功。交付 PNG、预设和路由配置与各自当前打包结果或源文件逐字节一致。
- PNG 的 chara 与 ccv3 元数据均检查：角色版本为 Ver.1.0，正式入口指向 v1.0.60，正式正则启用、测试入口禁用，包含总结持久化与新大总结提示词。

## CDN 与导入验证

CDN 基址：`https://testingcf.jsdelivr.net/gh/Awene/tavern_helper_template-main@v1.0.60/`。

已 GET 验证 `dist/修仙状态栏/index.html`、`dist/自定义开局/index.html`、`dist/正文美化/index.html`、`dist/创意工坊/index.js`、`dist/楼层iframe回收/index.js`：均返回 200，字节内容与 Git tag 中的对应文件一致。凡界、灵界的 12 张地图同样通过内容核对。

在本地酒馆导入交付 PNG 和预设，新建测试角色并打开自定义开局，成功进入配置步骤。浏览器实际加载自定义开局 v1.0.60 CDN 地址；总结脚本包含新的设置存储键。PNG 导入后辅助工具按文件名查找角色时报名称不一致，已确认酒馆实际成功导入，新角色的版本为 Ver.1.0，原角色保留。

路由配置通过插件实际导入处理器导入；核对导入后的提示词及两本世界书的全部配置与交付 JSON 一致。导入保留本机 API Key。

待验收：未执行真实模型调用下的完整开局、停止按钮联调和总结生成；未完成状态栏全部编辑操作、主题同步、手机布局、正文回退及旧角色卡兼容的完整浏览器冒烟测试。以上静态检查、单元回归与局部导入测试不代表这些项目已通过。

## 交付文件 SHA-256

| 文件 | 字节数 | SHA-256 |
| --- | ---: | --- |
| 本格修仙 Ver.1.0.png | 13749182 | `43a144f44fef84ed0bdc357e949744e58d273923bd51f3ba618da44d7e2bd20e` |
| 本格修仙preset-Ver.1.0.json | 183714 | `c7fa7858c9d2578d12782072b557f85290a33424a3b728d5bf828b702cfd37f9` |
| 本格修仙router-config-Ver.1.0.json | 6418 | `bc0412a5ec8f97de4faf1136723d4dbaa307229acaa2ed8947457c231dc31b12` |
