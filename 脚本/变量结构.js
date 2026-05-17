import { registerMvuSchema } from "https://testingcf.jsdelivr.net/gh/StageDog/tavern_resource/dist/util/mvu_zod.js";

// ===== 公用枚举 =====
const FiveElementsEnum = z.enum(["金", "木", "水", "火", "土", "阴", "阳", "混沌"]);
const FiveElementsExtEnum = z.enum(["金", "木", "水", "火", "土", "阴", "阳", "混沌", "未知", "无"]);
const QualityEnum = z.enum(["凡", "黄", "玄", "地", "天"]);
const SpiritualRootRankEnum = z.enum([
  "无灵根",
  "未检测",
  "单灵根",
  "双灵根",
  "三灵根",
  "四灵根",
  "五灵根",
]);

// ===== 寿元 Schema =====
const LifespanSchema = z
  .object({
    年龄: z.coerce
      .number()
      .transform((n) => _.clamp(n, 0, Infinity))
      .prefault(0),
    寿命: z.coerce
      .number()
      .transform((n) => _.clamp(n, 0, Infinity))
      .prefault(100),
    外观年龄: z.coerce
      .number()
      .transform((n) => _.clamp(n, 0, Infinity))
      .prefault(18),
  })
  .prefault({ 年龄: 0, 寿命: 100, 外观年龄: 18 });

// ===== 灵根 Schema =====
const SpiritualRootSchema = z
  .object({
    名称: z.string().prefault("未检测"),
    五行: z.array(FiveElementsExtEnum).prefault(["未知"]),
    品阶: SpiritualRootRankEnum.prefault("未检测"),
  })
  .prefault({ 名称: "未检测", 五行: ["未知"], 品阶: "未检测" });

// ===== 体质 Schema =====
const PhysiqueSchema = z
  .object({
    名称: z.string().prefault("凡体"),
    效果: z.record(z.string(), z.string()).optional(),
    悟性: z.coerce
      .number()
      .transform((n) => _.clamp(n, 0, Infinity))
      .prefault(0),
    根骨: z.coerce
      .number()
      .transform((n) => _.clamp(n, 0, Infinity))
      .prefault(0),
    气感: z.coerce
      .number()
      .transform((n) => _.clamp(n, 0, Infinity))
      .prefault(0),
  })
  .prefault({ 名称: "凡体", 悟性: 0, 根骨: 0, 气感: 0 });

// ===== 修炼进度 Schema =====
const CultivationProgressSchema = z
  .object({
    境界: z.string().prefault("凡人"),
    当前进度: z.coerce
      .number()
      .transform((n) => _.clamp(n, 0, Infinity))
      .prefault(0),
    进度上限: z.coerce
      .number()
      .transform((n) => _.clamp(n, 1, Infinity))
      .prefault(100),
    天谴: z.coerce
      .number()
      .transform((n) => _.clamp(n, 0, Infinity))
      .prefault(0),
  })
  .prefault({ 境界: "凡人", 当前进度: 0, 进度上限: 100, 天谴: 0 });

// ===== 技艺 Schema =====
const SkillSchema = z
  .object({
    生产类: z
      .object({
        炼器: z.coerce
          .number()
          .transform((n) => _.clamp(n, 0, Infinity))
          .prefault(0),
        驯兽: z.coerce
          .number()
          .transform((n) => _.clamp(n, 0, Infinity))
          .prefault(0),
        培育: z.coerce
          .number()
          .transform((n) => _.clamp(n, 0, Infinity))
          .prefault(0),
        医术: z.coerce
          .number()
          .transform((n) => _.clamp(n, 0, Infinity))
          .prefault(0),
        炼丹: z.coerce
          .number()
          .transform((n) => _.clamp(n, 0, Infinity))
          .prefault(0),
        制符: z.coerce
          .number()
          .transform((n) => _.clamp(n, 0, Infinity))
          .prefault(0),
      })
      .prefault({}),
    战斗类: z
      .object({
        御物: z.coerce
          .number()
          .transform((n) => _.clamp(n, 0, Infinity))
          .prefault(0),
        咒法: z.coerce
          .number()
          .transform((n) => _.clamp(n, 0, Infinity))
          .prefault(0),
        幻术: z.coerce
          .number()
          .transform((n) => _.clamp(n, 0, Infinity))
          .prefault(0),
        阵法: z.coerce
          .number()
          .transform((n) => _.clamp(n, 0, Infinity))
          .prefault(0),
        神识: z.coerce
          .number()
          .transform((n) => _.clamp(n, 0, Infinity))
          .prefault(0),
        炼体: z.coerce
          .number()
          .transform((n) => _.clamp(n, 0, Infinity))
          .prefault(0),
      })
      .prefault({}),
  })
  .prefault({});

// ===== 资源池 Schema (气血/灵气/遁速) =====
const ResourcePoolSchema = z
  .object({
    气血: z
      .object({
        现值: z.coerce
          .number()
          .transform((n) => _.clamp(n, 0, Infinity))
          .prefault(100),
        上限: z.coerce
          .number()
          .transform((n) => _.clamp(n, 1, Infinity))
          .prefault(100),
      })
      .prefault({ 现值: 100, 上限: 100 }),
    灵气: z
      .object({
        现值: z.coerce
          .number()
          .transform((n) => _.clamp(n, 0, Infinity))
          .prefault(100),
        上限: z.coerce
          .number()
          .transform((n) => _.clamp(n, 1, Infinity))
          .prefault(100),
      })
      .prefault({ 现值: 100, 上限: 100 }),
    遁速: z.coerce
      .number()
      .transform((n) => _.clamp(n, 0, Infinity))
      .describe("单位：m/s")
      .prefault(10),
  })
  .prefault({
    气血: { 现值: 100, 上限: 100 },
    灵气: { 现值: 100, 上限: 100 },
    遁速: 10,
  });

// ===== 状态效果 Schema =====
const StatusEffectSchema = z.object({
  类型: z.enum(["增益", "减益", "特殊"]).prefault("特殊"),
  效果: z.record(z.string(), z.string()).optional(),
  层数: z.coerce
    .number()
    .transform((n) => _.clamp(n, 0, Infinity))
    .prefault(1),
  剩余时间: z.string().prefault("永久"),
  来源: z.string().prefault(""),
});

// ===== 功法 Schema =====
const CultivationArtSchema = z.object({
  使用中: z.boolean().prefault(false),
  品质: QualityEnum.prefault("凡"),
  境界: z.string().prefault("练气期"),
  五行: FiveElementsEnum.optional(),
  类型: z
    .enum(["心法", "攻击", "幻术", "神识", "咒法", "身法", "护体", "阵法"])
    .prefault("心法"),
  消耗: z.string().optional(),
  标签: z.array(z.string()).prefault([]),
  效果: z.record(z.string(), z.string()).optional(),
  描述: z.string().prefault(""),
});

// ===== 物品 Schema =====
const ItemSchema = z.object({
  品质: QualityEnum.prefault("凡"),
  境界: z.string().optional(),
  类型: z
    .enum(["秘籍", "配方", "符箓", "丹药", "素材", "工具"])
    .prefault("素材"),
  消耗: z.string().optional(),
  五行: FiveElementsEnum.optional(),
  标签: z.array(z.string()).prefault([]),
  数量: z.coerce
    .number()
    .transform((n) => _.clamp(n, 0, Infinity))
    .prefault(0),
  效果: z.record(z.string(), z.string()).optional(),
  描述: z.string().prefault(""),
});

// ===== 装备 Schema (法宝/护甲/饰品 合并) =====
const EquipmentSchema = z.object({
  品质: QualityEnum.prefault("凡"),
  境界: z.string().optional(),
  类型: z.enum(["法宝", "护甲", "饰品"]).prefault("法宝"),
  消耗: z.string().optional(),
  五行: FiveElementsEnum.optional(),
  标签: z.array(z.string()).prefault([]), // 法宝→[攻击力:N]、护甲→[防御力:N]
  效果: z.record(z.string(), z.string()).optional(),
  描述: z.string().prefault(""),
  位置: z.string().prefault("储物袋"),
});

// ===== 傀儡/灵兽 技能 Schema =====
const CombatSkillSchema = z.object({
  攻击力: z.coerce
    .number()
    .transform((n) => _.clamp(n, 0, Infinity))
    .prefault(0),
  消耗: z.string().optional(),
  效果: z.record(z.string(), z.string()).optional(),
});

// ===== 傀儡/灵兽 Schema =====
const CombatUnitSchema = z.object({
  使用中: z.boolean().prefault(false),
  品质: QualityEnum.prefault("凡"),
  境界: z.string().prefault("凡人"),
  五行: FiveElementsEnum.optional(),
  标签: z.array(z.string()).prefault([]),
  描述: z.string().prefault(""),
  资源池: ResourcePoolSchema,
  防御力: z.coerce
    .number()
    .transform((n) => _.clamp(n, 0, Infinity))
    .prefault(0),
  技能: z.record(z.string(), CombatSkillSchema).prefault({}),
});

// ===== 储物字段(根级 + NPC 共用,直接 spread 进 z.object) =====
const StorageFields = {
  灵石: z.coerce
    .number()
    .transform((n) => _.clamp(n, 0, Infinity))
    .describe("默认单位为下品灵石")
    .prefault(0),
  物品: z.record(z.string(), ItemSchema).prefault({}),
  装备: z.record(z.string(), EquipmentSchema).prefault({}),
  傀儡: z.record(z.string(), CombatUnitSchema).prefault({}),
  灵兽: z.record(z.string(), CombatUnitSchema).prefault({}),
};

// ===== NPC Schema (类型='人物') =====
const NPCSchema = z.object({
  类型: z.literal("人物").prefault("人物"),
  在场: z.boolean().prefault(false),
  种族: z.string().prefault("人族"),
  身份: z.array(z.string()).prefault([]),
  修炼进度: CultivationProgressSchema,
  寿元: LifespanSchema,
  灵根: SpiritualRootSchema,
  体质: PhysiqueSchema,
  元阴: z.boolean().optional(),
  元阳: z.boolean().optional(),
  技艺: SkillSchema,
  资源池: ResourcePoolSchema,
  状态效果: z.record(z.string(), StatusEffectSchema).prefault({}),
  功法: z.record(z.string(), CultivationArtSchema).prefault({}),
  ...StorageFields, // 灵石 / 物品 / 装备 / 傀儡 / 灵兽 直接挂在 NPC 根级,与 user 一致
  性格: z.string().prefault(""),
  外貌: z.string().prefault(""),
  着装: z.string().prefault(""),
  道侣: z.boolean().prefault(false),
  好感度: z.coerce
    .number()
    .transform((n) => _.clamp(n, -100, 100))
    .prefault(0),
});

// ===== 无主战斗单位 (关系列表条目, 类型='傀儡'|'灵兽') =====
// 用于 关系列表 中表达 "野生妖兽 / 遗弃傀儡 / 临时随从" 等无主形态
const WildPuppetSchema = z.object({
  类型: z.literal("傀儡"),
  在场: z.boolean().prefault(true),
  品质: QualityEnum.prefault("凡"),
  境界: z.string().prefault("凡人"),
  五行: FiveElementsEnum.optional(),
  标签: z.array(z.string()).prefault([]),
  描述: z.string().prefault(""),
  资源池: ResourcePoolSchema,
  防御力: z.coerce
    .number()
    .transform((n) => _.clamp(n, 0, Infinity))
    .prefault(0),
  技能: z.record(z.string(), CombatSkillSchema).prefault({}),
  状态效果: z.record(z.string(), StatusEffectSchema).prefault({}),
  好感度: z.coerce
    .number()
    .transform((n) => _.clamp(n, -100, 100))
    .prefault(-50), // 无主战斗单位默认敌对
});

const WildBeastSchema = WildPuppetSchema.extend({
  类型: z.literal("灵兽"),
});

// ===== 关系列表 条目 = 人物 | 傀儡 | 灵兽 =====
// preprocess 仅做最低限度的"类型字段补全"以兼容老存档;
// AI 新写入数据的全套清洗放在文末的 JSONPatch 预处理器里完成
const RelationEntrySchema = z.preprocess(
  (val) => (val && typeof val === "object" && !val.类型 ? { ...val, 类型: "人物" } : val),
  z.discriminatedUnion("类型", [NPCSchema, WildPuppetSchema, WildBeastSchema]),
);

// ===== 地点 Schema =====
const LocationSchema = z
  .object({
    世界: z.enum(["凡界", "灵界", "仙界"]).prefault("凡界"),
    地域: z.string().prefault("中原"),
    具体地点: z.string().prefault("荒野"),
  })
  .prefault({ 世界: "凡界", 地域: "中原", 具体地点: "荒野" });

// ===== 时间 Schema =====
const TimeSchema = z
  .object({
    年: z.coerce.number().prefault(1),
    月: z.coerce
      .number()
      .transform((n) => _.clamp(n, 1, 12))
      .prefault(1),
    日: z.coerce
      .number()
      .transform((n) => _.clamp(n, 1, 30))
      .prefault(1),
    时辰: z
      .enum([
        "子时",
        "丑时",
        "寅时",
        "卯时",
        "辰时",
        "巳时",
        "午时",
        "未时",
        "申时",
        "酉时",
        "戌时",
        "亥时",
      ])
      .prefault("午时"),
  })
  .prefault({ 年: 1, 月: 1, 日: 1, 时辰: "午时" });

// ===== 传闻 Schema =====
const RumorSchema = z.object({
  类型: z.enum([
    "大派动向",
    "仙人行迹",
    "宗门战事",
    "灵脉异变",
    "道庭法令",
    "秘境传闻",
    "高额悬赏",
    "妖兽异动",
    "通缉魔修",
    "宝物现世",
    "风流韵事",
    "千里同心",
    "缘分将至",
    "邂逅预兆",
    "恩怨流转",
    "同门轶事",
    "师长动向",
    "门内任务",
    "资源调配",
    "内部秘辛",
  ]),
  时间: z.string().prefault(""),
  来源: z.string().prefault(""),
  内容: z.string().prefault(""),
});

// ===== 主 Schema (扁平化:基本信息/修炼功法/储物空间 三大类拆掉) =====
export const Schema = z.object({
  // —— 原 基本信息.* ——
  姓名: z.string().prefault("User"),
  寿元: LifespanSchema,
  种族: z.string().prefault("人族"),
  灵根: SpiritualRootSchema,
  体质: PhysiqueSchema,
  修炼进度: CultivationProgressSchema,
  技艺: SkillSchema,
  资源池: ResourcePoolSchema,
  地点: LocationSchema,
  时间: TimeSchema,
  状态效果: z.record(z.string(), StatusEffectSchema).prefault({}),

  // —— 原 修炼功法.功法 ——
  功法: z.record(z.string(), CultivationArtSchema).prefault({}),

  // —— 原 储物空间.* ——
  ...StorageFields,

  // —— 不变 ——
  关系列表: z.record(z.string(), RelationEntrySchema).prefault({}),
  传闻: z.array(RumorSchema).prefault([]),
});

// ============================================================
// JSONPatch 预处理器
//   在 mvu_zod 的 mag_command_parsed_for_zod 处理器之前执行,
//   对 AI 输出的 JSONPatch 中的 value 进行清洗,以提升对脏数据的容错:
//     1. 丢弃 schema 之外的多余字段(如 NPC.背景故事 / 体质.描述)
//     2. 好感度 中文映射(高:10/中:5/低:0/仇视:-10/友善:5, 其他:0)
//     3. 缺 类型 字段的 关系列表 条目默认补 '人物'
//   依赖 eventOn 的"先注册先执行"特性: 本模块在 registerMvuSchema 之前注册.
// ============================================================

// 各 schema 允许字段白名单 — 与 Zod 定义保持同步
const NPC_FIELDS = new Set([
  "类型", "在场", "种族", "身份",
  "修炼进度", "寿元", "灵根", "体质", "元阴", "元阳",
  "技艺", "资源池", "状态效果", "功法",
  "灵石", "物品", "装备", "傀儡", "灵兽",
  "性格", "外貌", "着装", "道侣", "好感度",
]);
const PHYSIQUE_FIELDS = new Set(["名称", "效果", "悟性", "根骨", "气感"]);
const SPIRITUAL_ROOT_FIELDS = new Set(["名称", "五行", "品阶"]);
const LIFESPAN_FIELDS = new Set(["年龄", "寿命", "外观年龄"]);
const CULTIVATION_PROGRESS_FIELDS = new Set(["境界", "当前进度", "进度上限", "天谴"]);
const STATUS_EFFECT_FIELDS = new Set(["类型", "效果", "层数", "剩余时间", "来源"]);
const CULTIVATION_ART_FIELDS = new Set([
  "使用中", "品质", "境界", "五行", "类型", "消耗", "标签", "效果", "描述",
]);
const ITEM_FIELDS = new Set([
  "品质", "境界", "类型", "消耗", "五行", "标签", "数量", "效果", "描述",
]);
const EQUIPMENT_FIELDS = new Set([
  "品质", "境界", "类型", "消耗", "五行", "标签", "效果", "描述", "位置",
]);
const COMBAT_UNIT_FIELDS = new Set([
  "使用中", "品质", "境界", "五行", "标签", "描述", "资源池", "防御力", "技能",
]);
const COMBAT_SKILL_FIELDS = new Set(["攻击力", "消耗", "效果"]);
const WILD_RELATION_FIELDS = new Set([
  "类型", "在场", "品质", "境界", "五行", "标签", "描述",
  "资源池", "防御力", "技能", "状态效果", "好感度",
]);

// 好感度 中文 → 数字 映射
const FAVOR_TEXT_MAP = { 高: 10, 中: 5, 低: 0, 仇视: -10, 友善: 5 };

function pickFields(obj, allowed) {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return obj;
  const out = {};
  for (const k of Object.keys(obj)) {
    if (allowed.has(k)) out[k] = obj[k];
  }
  return out;
}

function coerceFavor(v) {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    if (v in FAVOR_TEXT_MAP) return FAVOR_TEXT_MAP[v];
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function sanitizeChildRecord(map, fieldset) {
  if (!map || typeof map !== "object" || Array.isArray(map)) return map;
  for (const key of Object.keys(map)) {
    if (map[key] && typeof map[key] === "object") {
      map[key] = pickFields(map[key], fieldset);
    }
  }
  return map;
}

// 清洗 "关系列表/人物" 条目(原地修改并返回);
// 与 RelationEntrySchema 的 preprocess 共享同一份字段规则,作为入站清洗主入口
function sanitizeNpcEntry(input) {
  if (!input || typeof input !== "object") return input;
  // 1. 缺类型 → 默认 人物
  if (!input.类型) input.类型 = "人物";
  if (input.类型 !== "人物") return sanitizeWildEntry(input);

  // 2. 顶层字段白名单过滤
  let npc = pickFields(input, NPC_FIELDS);

  // 3. 子对象内部清洗(逐字段处理)
  if (npc.体质) npc.体质 = pickFields(npc.体质, PHYSIQUE_FIELDS);
  if (npc.灵根) npc.灵根 = pickFields(npc.灵根, SPIRITUAL_ROOT_FIELDS);
  if (npc.寿元) npc.寿元 = pickFields(npc.寿元, LIFESPAN_FIELDS);
  if (npc.修炼进度) npc.修炼进度 = pickFields(npc.修炼进度, CULTIVATION_PROGRESS_FIELDS);

  // 4. record 类字段: 每条记录都清洗
  sanitizeChildRecord(npc.状态效果, STATUS_EFFECT_FIELDS);
  sanitizeChildRecord(npc.功法, CULTIVATION_ART_FIELDS);
  sanitizeChildRecord(npc.物品, ITEM_FIELDS);
  sanitizeChildRecord(npc.装备, EQUIPMENT_FIELDS);
  // 傀儡/灵兽 是 CombatUnitSchema,内部 技能 是 CombatSkillSchema
  for (const slot of ["傀儡", "灵兽"]) {
    if (npc[slot] && typeof npc[slot] === "object") {
      for (const uname of Object.keys(npc[slot])) {
        const u = npc[slot][uname];
        if (u && typeof u === "object") {
          npc[slot][uname] = pickFields(u, COMBAT_UNIT_FIELDS);
          sanitizeChildRecord(npc[slot][uname].技能, COMBAT_SKILL_FIELDS);
        }
      }
    }
  }

  // 5. 好感度 中文/异常值 兜底
  if ("好感度" in npc) npc.好感度 = coerceFavor(npc.好感度);

  return npc;
}

// 清洗 "关系列表/傀儡|灵兽"(无主战斗单位)
function sanitizeWildEntry(input) {
  if (!input || typeof input !== "object") return input;
  const wild = pickFields(input, WILD_RELATION_FIELDS);
  sanitizeChildRecord(wild.技能, COMBAT_SKILL_FIELDS);
  sanitizeChildRecord(wild.状态效果, STATUS_EFFECT_FIELDS);
  if ("好感度" in wild) wild.好感度 = coerceFavor(wild.好感度);
  return wild;
}

// 看起来像不像 关系列表 条目(类型='人物' 或 缺 类型 但有 NPC 特征字段)
function looksLikeRelationEntry(obj) {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return false;
  if (obj.类型 === "人物" || obj.类型 === "傀儡" || obj.类型 === "灵兽") return true;
  if (!obj.类型) {
    return "种族" in obj || "身份" in obj || "修炼进度" in obj || "寿元" in obj;
  }
  return false;
}

// 递归扫描 value, 凡是 关系列表 条目形状的对象都清洗一遍
function deepSanitize(value) {
  if (looksLikeRelationEntry(value)) return sanitizeNpcEntry(value);
  if (Array.isArray(value)) return value.map(deepSanitize);
  if (value && typeof value === "object") {
    for (const k of Object.keys(value)) value[k] = deepSanitize(value[k]);
    return value;
  }
  return value;
}

// 把 标签 字符串中误写的最外层 [..] 剥掉
//   ["[炼制难度: 18]"]  →  ["炼制难度:18"]
//   ["攻击力:2500"]     →  不变
// 同时去掉冒号两侧多余空白
function normalizeTagString(s) {
  if (typeof s !== "string") return s;
  let t = s.trim();
  // 可能 AI 套了多层 [[...]] , 用 while 全部剥掉
  while (t.length >= 2 && t.startsWith("[") && t.endsWith("]")) {
    t = t.slice(1, -1).trim();
  }
  // 折叠 "label : value" 内冒号两侧空白
  t = t.replace(/^([^:：]+?)\s*[:：]\s*(.+)$/, "$1:$2");
  return t;
}

function normalizeTagsArray(arr) {
  if (!Array.isArray(arr)) return arr;
  return arr.map(normalizeTagString).filter((s) => typeof s === "string" && s);
}

// 递归扫描整棵 value 树, 凡发现 标签 字段是数组就规范化里面的字符串
function normalizeTagsDeep(value) {
  if (Array.isArray(value)) {
    for (const item of value) normalizeTagsDeep(item);
    return;
  }
  if (value && typeof value === "object") {
    if (Array.isArray(value.标签)) value.标签 = normalizeTagsArray(value.标签);
    for (const k of Object.keys(value)) {
      if (k !== "标签") normalizeTagsDeep(value[k]);
    }
  }
}

// 复用 mvu_zod 内部的字符串→值解析逻辑(JSON / Function / YAML 多级回退)
function tryParseValue(t) {
  if (typeof t !== "string") return t;
  const e = t.trim();
  if (e === "true") return true;
  if (e === "false") return false;
  if (e === "null") return null;
  if (e === "undefined") return undefined;
  try { return JSON.parse(e); } catch (_) {}
  if ((e.startsWith("{") && e.endsWith("}")) || (e.startsWith("[") && e.endsWith("]"))) {
    try {
      const r = new Function(`return ${e};`)();
      if (typeof r === "object" && r !== null) return r;
    } catch (_) {}
  }
  try { return YAML.parse(e); } catch (_) {}
  return t;
}

// ===== 路径修正 =====
// 处理两类 AI 路径错误:
//   A. 任意未知前缀: "/X/Y/Z" 中 X 不是合法顶级键, 但 Y 是 → 截断到 Y
//      涵盖 stat_data / status_current_variable(s) / 状态_当前变量 / mvu_data / 任何 AI 杜撰前缀
//   B. 错误嵌套: "/状态效果/时间/年" → "/时间/年"
//      利用 "全 schema 唯一出现位置" 的键作为锚点, 在路径中段发现即截断

// 全部合法顶级键 (与 Schema z.object 内字段名一致); 任一段命中即认为是真正的根入口
const ALL_TOP_LEVEL_KEYS = new Set([
  "姓名", "寿元", "种族", "灵根", "体质", "修炼进度",
  "技艺", "资源池", "地点", "时间", "状态效果", "功法",
  "灵石", "物品", "装备", "傀儡", "灵兽",
  "关系列表", "传闻",
]);

// 这 4 个键在 schema 中只在顶级出现, NPC 子结构、record 内都不含;
// 出现在路径中段必然是错误嵌套 (例 /状态效果/时间/年).
const TOP_LEVEL_ONLY_KEYS = new Set(["姓名", "地点", "时间", "传闻"]);

function fixPath(rawPath) {
  if (typeof rawPath !== "string" || !rawPath) return rawPath;
  // 去除外围引号/空白
  const stripped = rawPath.replace(/^[\\"'` ]+|[\\"'` ]+$/g, "");
  // 支持 JSON Patch 斜杠路径 / 与 lodash 点路径 .  (filter(Boolean) 去掉前导斜杠产生的空段)
  const segments = stripped.includes("/")
    ? stripped.split("/").filter(Boolean)
    : stripped.split(".").filter(Boolean);
  if (segments.length === 0) return rawPath;

  let mutated = false;

  // A. 扫描首个合法顶级键, 截断之前的所有 segment (无论前缀长什么样)
  //    若 segments[0] 已是顶级键, firstTopIdx === 0, 不会截断
  //    若没有任何顶级键命中, 保持原样让下游报错(避免静默错改路径)
  const firstTopIdx = segments.findIndex((s) => ALL_TOP_LEVEL_KEYS.has(s));
  if (firstTopIdx > 0) {
    segments.splice(0, firstTopIdx);
    mutated = true;
  }

  // B. 扫描中段是否有 top-level-only 键 (错误嵌套), 有则从该段截断
  for (let i = 1; i < segments.length; i++) {
    if (TOP_LEVEL_ONLY_KEYS.has(segments[i])) {
      segments.splice(0, i);
      mutated = true;
      break;
    }
  }

  if (!mutated) return rawPath;
  const fixed = segments.join(".");
  console.warn(`[JSONPatch preprocessor] 修正路径: "${rawPath}" → "${fixed}"`);
  return fixed;
}

// mag_command_parsed_for_zod 钩子: 在 mvu_zod 处理器之前清洗每个 command 的 args
function jsonPatchPreprocessor(_variables, commands) {
  if (!Array.isArray(commands)) return;
  for (const cmd of commands) {
    if (!cmd || !Array.isArray(cmd.args)) continue;
    // 1. 先修正路径(args[0] 是 path, 对 move 命令 args[1] 也是 path)
    if (cmd.args.length > 0) cmd.args[0] = fixPath(cmd.args[0]);
    if (cmd.type === "move" && cmd.args.length > 1) cmd.args[1] = fixPath(cmd.args[1]);
    // 2. 再清洗 value (递归扫描对象, 命中 NPC 形状就过 schema 字段白名单)
    for (let i = 0; i < cmd.args.length; i++) {
      const parsed = tryParseValue(cmd.args[i]);
      if (parsed && typeof parsed === "object") {
        // mvu_zod 的 c() 对非字符串直接返回,可以放心写回对象
        const cleaned = deepSanitize(parsed);
        // 3. 标签数组规范化 ([炼制难度:18] → 炼制难度:18)
        normalizeTagsDeep(cleaned);
        cmd.args[i] = cleaned;
      }
    }
  }
}

$(() => {
  // 先注册预处理器,确保在 mvu_zod 的同名事件处理器之前执行
  eventOn("mag_command_parsed_for_zod", jsonPatchPreprocessor);
  registerMvuSchema(Schema);
});
