# Ver.1.1 发布记录

发布批次：Ver.1.1。三份交付物本次均有实际变化，分别由 Ver.1.0 递增为 Ver.1.1。归档目录：`发布文件/Ver.1.1/`。

## 内容与版本判断

- 预设：迁移后的条目架构、模型模式、消息分区与空行处理，加入组件修订标识 `2026.10.22`。
- 路由配置：加入世界书对应的 `configMetadata`，与原交付文件字节不同；格式版本未因此改变。
- 角色卡：初次以旧指针、旧版本重打包时，与 Ver.1.0 PNG 完全一致。换入已验证的 v1.0.62 前端后，尚未修改卡片版本时，SHA-256 已变为 `a7cb6deb2cfb16824f1eeb5bb19d867732b53a69a466f5a7b4aadc3f5b83fbc5`，据此递增角色卡版本并重新打包，而非用版本号自身制造变化。
- 组件修订号、交付版本、前端 tag、插件版本分别维护；以后未变化的交付文件沿用原版本与原字节。

## 构建与提交

| 项目 | SHA / 版本 |
| --- | --- |
| 前端构建输入 | `acc77ebdc890588f578f090344dcf4f1900af92d` |
| 构建使用的角色卡规则输入 | `2d3d6a76cc09ad6366cf6759635c3499389b894e` |
| 前端正式产物 / main / v1.0.62 解引用 | `f81c9471de467fcdc43542559d911129f399618f` |
| 路由插件 main | `974f470d48554392315b704152dcf9741ecccff3` / 0.19.6 |
| 角色卡交付物提交 | `e0e25c94993c8d64253b1e38f6c0695fee6d3eb8` |

前端先同步远端两笔依赖更新。Node.js 24.13.1、pnpm 10.33.2；`pnpm install --frozen-lockfile`、`pnpm dump`、`pnpm lint`、`pnpm build:frontend` 成功。全库 lint 为 0 错误、108 警告，构建有包体积提示。最终检测修复另经定向 lint、组件回归和完整前端构建验证。

v1.0.61 已发布后，实际配置联调发现附带总结世界书无启用规则会误报，遂改为要求绑定配置中至少存在一组启用的本卡规则，并发布 v1.0.62。保留 v1.0.61，不移动历史 tag。正式卡仅引用 v1.0.62。

角色卡打包命令：`node tavern_sync.mjs bundle 本格修仙`；预设打包命令：`node tavern_sync.mjs bundle 本格修仙预设`。测试推送目标仍为 `本格修仙preset-test`。

## 交付文件校验

| 文件 | 文件版本 | 对比上次 | 上次 SHA-256 | 本次 SHA-256 |
| --- | --- | --- | --- | --- |
| `本格修仙 Ver.1.1.png` | Ver.1.1 | 有变化 | `43a144f44fef84ed0bdc357e949744e58d273923bd51f3ba618da44d7e2bd20e` | `09c8b17283b63568f79041da144b43fb2bd67142137dd32e60c67b145dee0bd2` |
| `本格修仙preset-Ver.1.1.json` | Ver.1.1 | 有变化 | `c7fa7858c9d2578d12782072b557f85290a33424a3b728d5bf828b702cfd37f9` | `c058883c35e8283ee5fa4ebd1d3f76cb28d3118bc37d8101ecd4f1a6a0ebeaba` |
| `本格修仙router-config-Ver.1.1.json` | Ver.1.1 | 有变化 | `bc0412a5ec8f97de4faf1136723d4dbaa307229acaa2ed8947457c231dc31b12` | `f8eca1aa59d0706fbf6e463baa8a44d8856777000260d86b5a8cc6b93a396415` |

三个交付文件的 Git blob 与本地归档字节一致。PNG 的 chara 与 ccv3 均包含 `character_version: Ver.1.1`，分别核对 241 个文件型世界书条目、六处正式资源引用及正则开关；测试入口全部关闭，正式入口不含 localhost 或浮动分支。路由副本与配置源文件字节一致。

## CDN 验证

新 tag 最初遇到 `503 No healthy backends`，未在失败时更新角色卡正式指针。随后 CDN 恢复，五个正式入口与十四张地图均 GET 200，原始字节 SHA-256 与 v1.0.62 的 Git blob 一致；浏览器也已访问正式入口。完整哈希如下：

| 资源 | SHA-256 |
| --- | --- |
| `dist/修仙状态栏/index.html` | `b8dfdc575bc39ac144c16f320bff64ba4e59b5706c6771c41553d1b0c8dafc5d` |
| `dist/自定义开局/index.html` | `57b7deb5081f81e49ef767ab1c3607c1541930c9c7e9bdc6e801b69ddf3ddc29` |
| `dist/正文美化/index.html` | `8b43dfb3316aaf36354dc0401cd094938ec93f7f83b16dc1c7b5949738447307` |
| `dist/创意工坊/index.js` | `fb09d0f552ed1d155399702fb24a2d926d472de41fa70d0f25af5ab638d06473` |
| `dist/楼层iframe回收/index.js` | `c0e4634c667be1075edbd0b436f9cdeab837516abad97f4b7372472188a0ea71` |
| `src/修仙状态栏/maps/冥界/冥界地图.png` | `c7a9f77218d7662f362c2156915ac2aeae9c77cefdd47c40682d87878aec5ff5` |
| `src/修仙状态栏/maps/凡界/东土地图.png` | `46f8d3811688e6e6392accb23871b66e7d1db154293bcdbee8aaa8dcf94ffcf5` |
| `src/修仙状态栏/maps/凡界/中原地图.png` | `82cbeca0c4d6a06cf1c32c8ac8813de5b2914e786dc59e537cd6c5b7495cba87` |
| `src/修仙状态栏/maps/凡界/北境地图.png` | `6aa0adfa965842a67d2680c552a82a4e374db691c721f78a89fda77e375b3767` |
| `src/修仙状态栏/maps/凡界/南疆地图.png` | `5db307ae7523a0a0617cf2da588aab5fa90a41a684603c4dbf22b070005d0d9d` |
| `src/修仙状态栏/maps/凡界/西域地图.png` | `3934232941402ac79fe6efcec5854aa4bc154dd6f2a4a862647cf54784d9156d` |
| `src/修仙状态栏/maps/地球/地球地图.png` | `b86b1652b80e67f7bd01137625581f0e25f33eced8917bd202cefe10990b706f` |
| `src/修仙状态栏/maps/灵界/万兽大陆地图.png` | `c51aad2794abf3e756ec41180e83fc1bb53009082a68a464cc2d8fcfea4af5d4` |
| `src/修仙状态栏/maps/灵界/圣银大陆地图.png` | `c4af1316e98d2d230c7c8b9d9f15efaaf5ac74dd4740076cc3f005b2095eff1f` |
| `src/修仙状态栏/maps/灵界/太初大陆地图.png` | `6c985951dc30272b25279a072c826206cfd6f78e4ade9bb23147e86665246afc` |
| `src/修仙状态栏/maps/灵界/星坠大陆地图.png` | `1330318e82736e9a65921badc44d100274dec2b04ea8ba8ff09a4de9ae7780f7` |
| `src/修仙状态栏/maps/灵界/殒落大陆地图.png` | `5cd5b1e85736f784abd52ab4b7931478cbf60cef4ed43cc04d2cbf58ffdac609` |
| `src/修仙状态栏/maps/灵界/沧溟大陆地图.png` | `d0c3305aa50b5fe1038cc0b157aad07a8228ec57a3b2308a8c0df2813007ab98` |
| `src/修仙状态栏/maps/灵界/灵境大陆地图.png` | `4a7c697a1829e33b96c36519d6b75eb9b14e0ccbae89936e7ba301790db5f993` |

## 验收结果与范围

已通过：

- 预设宏顺序 16 组合、原生正则 99 项、可选条目 EJS 384 组合、布局 16 组合、预设 144 渲染组合及 63 个引用文件，以及消息分区、预览空行、世界推进回归。
- 开局选择 82 项及初始数量 37 项、组件/模型控制、路由元数据导入导出、停止请求回归；相关脚本语法及发布文件 diff 检查。
- 实际酒馆导入交付预设，导入 PNG 创建独立验收角色；原角色与原聊天未覆盖。助手导入函数因文件名末尾小数截断而在后续刷新时报“角色不存在”，但酒馆已成功创建 `本格修仙 Ver.1.png`；随后选择该新卡，核对内嵌版本和实际界面。
- 通过路由插件本地同步导入与交付副本相同的配置，版本诊断确认为 `2026.10.22`，保留本机 API Key。
- 正式 CDN 开局封面 → 检测 → 模型配置顺序正确，六项检测均就绪。MVU 明确只验证运行接口。
- 桌面 iframe 宽 820px、手机视口 390px 下 iframe 宽 298px；检测与配置页 scrollWidth 均不超过 clientWidth。
- 实际 UI 切换 Claude 后只启用 Claude 头部并即时保存，再恢复 Gemini；测试后切回原测试预设。
- 路由模型输入框为 input+datalist，手输模型名能即时保存，已恢复原输入。模型列表不覆盖当前输入经代码核对，未额外调用供应商 API。

未验证：真实 AI 完整开局生成、生成后的状态栏设置交互、通用资产编辑/主题同步/创意工坊完整交互及所有窄屏页面；本次不声称这些项目已完成浏览器冒烟验收。状态栏相关共享组件经过构建、模板编译与逻辑回归，CDN 已核验。

未将用户生成示例、参考文件增删及本地预览截图纳入本次发布提交。前端完整构建产生的示例入口变化也未纳入正式产物。

三个仓库均需推送并核对远端 main：前端及路由 SHA 如上；角色卡最终 main 为包含本记录的后续文档提交，可用 `git log --oneline -- Doc/发布记录-Ver.1.1.md` 定位，交付物提交 SHA 固定如上。
