# Cultivation-Card-Game scratchpad 临时工作区规范

本目录是卡片工程的**临时演练场、构建验证区与安全备份库**。

> [!WARNING]
> **本目录默认不属于长期维护的代码库**。
> 1. **严禁在 `scratchpad/` 根目录直接平铺生成文件**。
> 2. **Git 忽略**：此目录包含体积巨大的测试卡 PNG（单张 10~15MB）和自动化测试产物，已在 `.gitignore` 中配置排除。
> 3. **定期清理**：本目录下的产物在单次任务验收完成后均具备时效性，可适时清空或归档。

---

## 目录分层架构

```text
Cultivation-Card-Game/scratchpad/
├── README.md                   # 本文件 (临时工作区规范)
│
├── 01-card-backups/            # 角色卡危险操作前的全量快照 (PNG/JSON)
│   ├── release-v1.0.58-before.png
│   ├── release-v1.0.57-before.png
│   ├── 本格修仙-灵界开局修改前.png
│   └── full-card-backup/       # 本格修仙-before-full-build.png 等
│
├── 02-ui-previews/             # 独立预览构建与临时页面
│   ├── world-advance-preview.html
│   ├── spirit-start-build/
│   ├── world-advance-build/
│   └── legacy-overview-tests/
│
├── 03-test-artifacts/          # 自动化回归测试产物、抓包快照与临时数据包
│   ├── latest-test-bundle.json # 测试全量 JSON
│   ├── chapter-sync-readback.json
│   └── cast-*.json             # 生成的人物数据对照包
│
├── 04-test-scripts/            # 临时性排查、批量回填与迁移脚本
│   ├── test_*.mjs              # 单项事件与语法校验测试脚本
│   ├── build_*.mjs             # 临时编译与总览生成脚本
│   └── sync_*.mjs              # 临时名册或同步脚本
│
└── 05-runtime-profiles/        # 自动化测试虚拟环境产生的临时配置与缓存
    └── ds-play-profile/        # 浏览器用户缓存与模拟环境（可随时完全删除）
```

---

## AI 维护准则

1. **备份卡管理**：
   - AI 在执行全量覆盖、破坏性大重构前，若需备份旧卡，统一放入 `01-card-backups/`。
   - 保持只保留最近 1~2 份关键备份，避免积累过多 15MB+ PNG 导致磁盘膨胀。
2. **测试脚本规范**：
   - 临时写来验证某个 EJS 语法或词条同步的 `test_*.mjs`，统一放在 `04-test-scripts/` 中。
   - 脚本中若需读取项目根目录文件，使用基于当前工作目录的相对路径，例如 `fs.readFileSync('本格修仙.yaml', 'utf8')`。
3. **测试数据与截图**：
   - 运行产生的 JSON 比较报告或快照统一写入 `03-test-artifacts/`。

