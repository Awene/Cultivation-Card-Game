import { cast, groupBy, patch } from "./build_spirit_cast.mjs";
import { regions } from "./spirit_cast_sources.mjs";
const people = regions.flatMap(cast),
  groups = regions.flatMap((r) =>
    [...groupBy(people.filter((p) => p.region === r))].map(([name, ps]) => ({
      region: r,
      name,
      people: ps,
      path: ps[0].path,
    })),
  );
let text = "# 灵界人物落地清单\n\n";
text += "## 范围与数量\n\n";
text +=
  "覆盖星坠、圣银、灵境、万兽、沧溟、太初六个大陆正式蓝图与总览中的具名人物；不采用殒落占位。写作按大陆及组织分批，由指定 Astra 模型逐批扩写、主流程逐批核对并装配。\n\n";
text += "| 大陆 | 人物 | 女性 | 男性 | 人物文件 |\n|---|---:|---:|---:|---:|\n";
for (const r of regions) {
  const ps = people.filter((p) => p.region === r);
  text +=
    "| " +
    [
      r,
      ps.length,
      ps.filter((p) => p.gender === "女").length,
      ps.filter((p) => p.gender === "男").length,
      groupBy(ps).size,
    ].join(" | ") +
    " |\n";
}
text +=
  "| 合计 | " +
  [
    people.length,
    people.filter((p) => p.gender === "女").length,
    people.filter((p) => p.gender === "男").length,
    groups.length,
  ].join(" | ") +
  " |\n\n";
text += "## 数据和写作边界\n\n";
text +=
  "人物深写修订进度：" +
  people.filter((p) => p.deep).length +
  "/" +
  people.length +
  "。深写按照《人物提示词示例》提供魅力、内外着装、法宝、性格底色、两种性格各三段情境、主动表白与四段道侣日常；分批人工创作，不以流水线短标签替代正文。结构检查只证明覆盖与格式，不能替代文风审读。\n\n";
text +=
  "本轮逐批审读与回修重点：万兽与圣银首批补足私下趣味、性格缺点和主动表白的个人声音；沧溟核对水下饮用、原身体态、器灵本源和非人形陪伴，回修苏知帆、鲸泊远、海迟舟、虫守畦等日常段落。后续抽查花照年、叶绡、姬照微、姬明夷、钟小铛、田穗穗、郁见山、陶素渠，核对生活情境、原有局限与大陆背景，不以恋爱自动治愈缺点或改写社会秩序。\n\n";
text +=
  "独立互审再抽查沧溟八种不同形态与身份，未发现明确身体、本源或水下环境硬冲突；依审稿结果定点回修绯砚汐、海迟舟、卷停霜、叶漪纺共八段，将公务纠偏与规则总结改为收藏趣事、听戏、谜语及共同玩笑。灵境末批另核织锦心近织机显形、舟晚汐船体与安全航域限制。\n\n";
text +=
  "- 原有凡界 CSV 行的 11 列内容保留，新增列留空；灵界逐人补齐种族、境界、实际年龄（未定明确标记）、身份、衣饰、气质、说话方式、习惯、初遇、关系及可选故事。\n";
text +=
  "- 星坠蓝图有 42 人，旧总览只载 34 人，本轮纳入另外 8 人：沈星晷、钟小铛、田穗穗、卓守拙、唐榫、姬逐风、阿牧、安澜。\n";
text +=
  "- 女性统一御姐、少女、萝莉，均为成年；原文无固定岁数的不反推年龄。男性一并建档。种族形态、鱼人称谓、沧溟无原生人类等原设定优先。\n";
text +=
  "- 每人拥有独立生活细节与互动入口；扩写的初遇与故事是可选设计，不是已经发生的事实，不写天魔入侵具体日期，不预设恋爱、赠宝和职位。\n";
text +=
  "- 凡国人物最高金丹，宗门与凡国分别建档；庇护关系同步到凡国清单。未单独制作主线事件的宗门保持 FALSE，不将故事钩子误记为已落地主线。\n\n";
text += "## 已更新的管理文件\n\n";
text +=
  "- [角色蓝图.csv](角色蓝图.csv)：共 31 列；原 11 列保留，13 列记录身份与写作辅助信息，另 7 列归档底色、两组性格情境、表白与道侣正文。灵界每人一行，多段正文使用标准 CSV 引号和单元格内换行。\n- [宗门设定清单.csv](宗门设定清单.csv)：追加 42 宗门及养真院 1 个公共修行机构，登记已有人设角色。\n- [秘境清单.csv](秘境清单.csv)：追加 144 秘境；原文未定逐阶段境界者保留总体推荐范围，不伪造阶段等级。\n- [灵界凡国设定清单.csv](灵界凡国设定清单.csv)：33 凡国的治理、庇护与人物对应。\n- [人物世界书结构设计.md](人物世界书结构设计.md)、[宗门细化工作流程.md](宗门细化工作流程.md)、[灵界总览格式核对.md](灵界总览格式核对.md)：同步载体、字段、范围和维护说明。\n\n";
text +=
  "开局清单代表实际可用开局，本次未新增开局功能，因此不虚构开局条目；事件清单、体质和物品预设同样不因人物扩写自动增加。\n\n";
text += "## 分组与文件\n\n";
for (const r of regions) {
  text += "### " + r + "\n\n| 分组 | 人物 | 世界书文件 |\n|---|---|---|\n";
  for (const g of groups.filter((g) => g.region === r))
    text +=
      "| " +
      g.name +
      " | " +
      g.people.map((p) => p.name).join("、") +
      " | [文件](../" +
      g.path.replaceAll(" ", "%20") +
      ") |\n";
  text += "\n";
}
text += "## 加载与连续性\n\n";
text +=
  "`本格修仙.yaml` 中新增绿灯条目，顺序 200，角色定义之前，概率 100，黏性 5，禁止递归激活其他条目。名字命中输出本人详情，组织命中输出该组名册，二者同中附其他成员简报；在灵界可跨大陆按名触发。\n\n";
text +=
  "每份文件有独立 EJS 块作用域，使用本机 ST-Prompt-Template 的 getChatMessages(-10) 读取最近十条字符串；不可混用酒馆助手的字符串范围与对象参数，也不宣称此接口自动过滤隐藏楼层。关系列表已有的人物不重复输出初始境界、外貌档案；扩写只作可被当前剧情覆盖的参考，不回写变量。总览负责地理与组织名册，独立人物文件负责细写。\n\n";
text +=
  "正文以多行段落保存，避免把创作压成单行转义文本。表白和道侣分别保存：已出场且好感大于 80 才提供表白参考；已为道侣时提供四段相处参考，不同时堆叠表白。数值条件不代表自动发生事件。具体接口排查见 [世界书接口与顺序审计.md](世界书接口与顺序审计.md)。\n\n";
text += "## 维护与核验\n\n";
text +=
  "创作源：各大陆蓝图、`scratchpad/cast-<大陆>.json` 的基础档案和 `scratchpad/deep-cast-<大陆>.json` 的完整深写。深写覆盖魅力、衣饰、法宝和人格正文，基础档案保留身份映射及辅助灵感；修改新正文应编辑 deep-cast，不能只改旧短稿。素材保留以支持逐人修订，勿用随机模板覆盖整批创作。\n\n";
text +=
  "正式构建要求名册全员有完整深写，缺人时应报错，不得静默退回旧版短提示；仅临时分批预览可显式使用 `--draft`。交付前须以不带该参数的全员检查通过为准。\n\n";
text +=
  "1. 编辑某人素材并对照大陆蓝图；已定事实以蓝图和最新确认修改为准。\n2. `node scratchpad/build_spirit_cast.mjs region <大陆>` 输出人物文件补丁，用 apply_patch 应用。\n3. `node scratchpad/build_spirit_cast.mjs integrate` 输出 CSV 与 YAML 补丁；`node scratchpad/sync_spirit_reference_lists.mjs --with-cast` 输出相关清单补丁；`node scratchpad/document_spirit_cast.mjs` 输出本清单补丁。三者均不直接写盘。\n4. `node scratchpad/test_spirit_cast.mjs` 检查全员覆盖、CSV 字段、YAML 引用、EJS 单人/组织/混合路由、跨大陆、出场保护、世界隔离、缺 API 回退及多文件联合编译。\n\n";
text +=
  "核验命令：`node scratchpad/test_worldbook_chat_audit.mjs` 使用本机插件实现检查消息窗口、世界书语法和人物顺序；`node scratchpad/test_spirit_cast_depth.mjs` 检查全员深写结构与整段重复；`node scratchpad/test_spirit_cast.mjs` 检查 256 人、116 文件、CSV 与关系阶段路由，验证原有 101 行凡界字段保留。总览可用 `node scratchpad/test_spirit_overviews.mjs --ignore-table-spacing` 检查实际文件；圣银与沧溟已有表格空格排版与构建器不同，此开关仅忽略表格排版差异，默认严格模式仍保留。未为排版差异覆盖用户的总览。\n\n";
text +=
  "交付范围为本地源文件及 YAML 配置；本轮不推送酒馆、不发布远程仓库、不覆盖已有 PNG 角色卡，也未进行实际酒馆聊天联调。需要导入酒馆时应另行打包，旧 PNG 不含这批独立人物条目。地图 PNG 未改动。\n";
process.stdout.write(
  "*** Begin Patch\n" +
    patch("Doc/灵界人物落地清单.md", text) +
    "*** End Patch\n",
);
