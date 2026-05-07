# 本格修仙 · Cultivation Card Game

> 一张面向 SillyTavern 的 AIRP（AI Role Play）角色卡。以"本格推理"般严谨的数值化框架还原修仙世界 —— 灵根、体质、境界、技艺、修为、突破、战斗、生产制作均由系数与骰池共同推演。

- **角色卡名称**：本格修仙
- **配套世界书**：本格数值化修仙
- **作者**：Awene & Vandark 范答客
- **当前版本**：Ver.1.0
- **首发与许可**：首发[类脑·旅途](https://discord.gg/nb-travel)，免费 AI 角色分享，**禁止商用**

---

## 项目定位

本仓库是 **SillyTavern 角色卡的源工程**，并非可直接导入的成品文件。它把一张完整的角色卡拆成可读、可编辑、可版本管理的纯文本文件，再通过 [`tavern_sync`](https://gitgud.io/StageDog/tavern_sync) 工具与酒馆双向同步、或一键打包出可分发的 `.png` 卡片。

整张卡片由四个模块协同工作：

| 模块 | 角色 | 位置 |
| --- | --- | --- |
| **世界书** | 世界观、人物、规则、变量框架 | [世界书/](世界书/) |
| **正则** | 输出格式化、状态栏注入、思维链折叠 | [正则/](正则/) |
| **脚本** | MVU 变量结构（Zod schema）注册 | [脚本/](脚本/) |
| **预设** | 适配 Gemini 的提示词预设 | [预设/](预设/) |
| **前端美化** | 状态栏 / 自定义开局 / 正文与思维链美化（Vue + TS 工程） | 配套仓库 [tavern_helper_template-main/src/](../tavern_helper_template-main/src/) |

主控配置文件是 [本格修仙.yaml](本格修仙.yaml) —— 它声明了角色卡所引用的全部世界书条目、激活策略（蓝灯/绿灯）、插入位置、关键字、正则与脚本库；[tavern_sync.yaml](tavern_sync.yaml) 则把这份本地工程映射到酒馆中的同名角色卡。

---

## 玩法核心：数值化修仙

不同于"开局即金手指"的爽文模板，本卡片要求 AI **每一次叙事都先在面板里完成数值推演**，再输出剧情：

- **核心系数总表** 决定境界倍率、品阶倍率、气血/灵气/遁速公式
- **骰子池** 由系统预投，AI 必须按顺序取用，禁止自行假设
- **状态/战斗/突破/领悟/修为/生产/非战斗判定** 各有独立规则块
- **MVU 变量** 全程跟踪人物面板、社交关系、储物、不动产、时间地点

> 详见 [Doc/架构设计.txt](Doc/架构设计.txt) 和 [Doc/生成结果示例.txt](Doc/生成结果示例.txt)。

---

## 目录详解

### `世界书/` — 世界书条目

按命名前缀分组，单文件即一条世界书条目：

#### 设定与规则

- **`世界设定-*.txt`** — 世界观、五行生克、伦理、修为境界、灵根与体质、生命种族、经济系统、物品功法、技艺
- **`[xxx规则].txt`** — 角色生成 / 物品功法生成 / 战斗 / 非战斗判定 / 修为获取 / 突破 / 领悟 / 状态 / 时间推进 / 生产制作 / compliance 合规
- **`[核心系数总表].txt`、`[随机池].txt`** — 数值推演的常量表与骰池

#### 地理与势力

- **`世界层级-凡界.txt`、`世界地图-凡界.txt`** — 凡界全景
- **`地域-凡界-{东土,中原,北境,南疆,西域}.txt`** — 五大地域
- **`门派-*.txt`** — 17 个门派（问道仙宗、霸体宗、血杀殿、合欢宗、琉璃丹宗、魔渊阁、天衍楼、天玄剑宗、玉女宗、五毒教、幽冥府、万兽宗、千机门、聆风斋、北辰学宫……）
- **`王朝-凡界-中原-乾元圣朝.txt`、`组织-*.txt`** — 王朝、镇魔司、万妖盟

#### 人物（NPC 卡池）

- **`人物-*.txt`** — 50+ 张可被关键字激活的角色面板，覆盖正道、魔道、皇朝、妖族（潜龙族 / 落凤族 / 青丘狐族）等阵营

#### MVU 变量框架

- **`[mvu_update]变量更新规则 / 输出列表 / 输出格式 / 格式强调.yaml`** — 控制 AI 在 `<UpdateVariable>` 中如何输出 JSON Patch
- **`[initvar]变量初始化默认禁用.yaml`** — 默认变量初始化模板（默认禁用，由自定义开局接管）

> 各条目的激活策略（蓝灯常驻 / 绿灯关键字触发）、插入深度、黏性等均在 [本格修仙.yaml](本格修仙.yaml) 中声明。

### `正则/` — 输出处理

| 文件 | 作用 |
| --- | --- |
| `[折叠]完整变量更新.txt` / `[折叠]变量更新中.txt` | 把 `<UpdateVariable>` 块折叠成可点开的 UI |
| `状态栏.txt` / `状态栏（测试）.txt` | 把 `<StatusPlaceHolderImpl/>` 替换为前端状态栏 iframe |
| `正文美化(测试).txt` | 解析 `<now_plot>` 中的 `<gametxt>` / `<char_info>` / `<tp>` 等标签为美化卡片 |
| `思维链美化(测试).txt` | 折叠并美化 `<think>` 思维链块 |
| `自定义开局.txt` / `自定义开局（测试）.txt` | 把首条消息的 `<customized>` 占位替换为开局向导前端 |

### `脚本/` — 酒馆助手脚本

- **`变量结构.js`** — 通过 `registerMvuSchema` 注册一整套 Zod schema：寿元 / 灵根 / 体质 / 修炼进度 / 技艺 / 资源池 / 物品 / 装备 / 不动产 / 社交关系（当前互动 / 道侣 / 仇敌）。这是 MVU 框架做变量校验与默认值的依据。
- **MVU 主脚本** 直接通过 jsdelivr 引入 [`MagVarUpdate`](https://github.com/MagicalAstrogy/MagVarUpdate)，无需本地维护。

### `预设/` — 提示词预设

- **`本格修仙Kemini5-3.4.json`** — 针对 Gemini 调优的完整预设
- **`拆分/`** — 预设拆分版本（便于差异比对）

### `第一条消息/`

- **`0.txt`** — 仅包含 `<customized>自定义开局页面</customized>` 占位符，由正则替换为前端开局向导（灵根 / 体质 / 出生地 / 难度 / 物品 / 剧本 / 封面）。

### `Doc/` — 设计文档与工具

- **`DOC.md`** — 同步脚本快速上手（基于 tavern_sync 模板）
- **`未来改进设计.txt`** — 尚未应用的未来构想，目前无用
- **`生成结果示例.txt`** — 完整的一次 AI 输出示例
- **`prompt.py` / `prompt.txt`** — 提示词调试用脚本与导出
- **`preset_split.ipynb` / `sync_regex.py` / `check_unused_files_simple.ipynb`** — 预设拆分、正则同步、未使用文件检查的工具脚本

### `tavern_sync.yaml` & `tavern_sync.mjs`

`tavern_sync` 是把本地文件树双向同步到酒馆的 Node 工具。常用命令：

```bash
node tavern_sync.mjs pull 本格修仙    # 从酒馆拉取
node tavern_sync.mjs push 本格修仙    # 推送到酒馆
node tavern_sync.mjs watch 本格修仙   # 监听本地修改自动同步
node tavern_sync.mjs bundle 本格修仙  # 打包成可导入的角色卡
```

---

## 配套前端：`tavern_helper_template-main/`

姊妹仓库 [tavern_helper_template-main](../tavern_helper_template-main/) 是基于 [酒馆助手前端模板](https://github.com/StageDog/tavern_helper_template) 的 Vue 3 + TypeScript + Tailwind 工程，编译产物通过 jsdelivr 注入到正则中。三个独立子应用：

| 子应用 | 入口 | 用途 |
| --- | --- | --- |
| **修仙状态栏** | [src/修仙状态栏/](../tavern_helper_template-main/src/修仙状态栏/) | 顶部 HUD：道号 / 境界 / 气血灵力 / 技艺 / 储物 / 社交 / 传闻 |
| **自定义开局** | [src/自定义开局/](../tavern_helper_template-main/src/自定义开局/) | 多步骤向导：封面 → 灵根 → 难度 → 出生地 → 物品 → 剧本 → 确认 |
| **面板美化** | [src/面板美化/](../tavern_helper_template-main/src/面板美化/) | 单 HTML：思维链折叠卡 + 正文角色/动作/场景面板的 CSS |

视觉语言统一：远山 SVG 背景 + 仙鹤动画 + 卷轴主体 + 暗色琉璃质感。

---

## 上手流程

1. **环境**：Node ≥ 22 + Git
2. 克隆本仓库 → 在酒馆助手中安装 [`tavern_sync` 脚本](https://gitgud.io/StageDog/tavern_sync)
3. 在酒馆中创建空白角色卡"本格修仙"
4. `node tavern_sync.mjs push 本格修仙` 推送本地内容
5. 在酒馆里加载预设 [`本格修仙Kemini5-3.4.json`](预设/本格修仙Kemini5-3.4.json)
6. 打开角色卡，自定义开局向导会自动出现 —— 选择灵根、体质、剧本即可开局

更详细的同步脚本说明见 [Doc/DOC.md](Doc/DOC.md)。

---

## 鸣谢与生态

- **MVU 变量框架** — [MagicalAstrogy/MagVarUpdate](https://github.com/MagicalAstrogy/MagVarUpdate)
- **同步与模板** — [StageDog/tavern_sync](https://gitgud.io/StageDog/tavern_sync) · [StageDog/tavern_helper_template](https://github.com/StageDog/tavern_helper_template)
- **运行环境** — [SillyTavern](https://github.com/SillyTavern/SillyTavern) + [JS-Slash-Runner（酒馆助手）](https://github.com/N0VI028/JS-Slash-Runner)

---

## 许可

免费分享 · 禁止商用 · 转载请保留作者署名（Awene & Vandark 范答客）。
