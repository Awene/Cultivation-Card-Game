import { registerMvuSchema } from "https://testingcf.jsdelivr.net/gh/StageDog/tavern_resource/dist/util/mvu_zod.js";

// ===== 公用枚举 =====
const FiveElementValues = ["金", "木", "水", "火", "土", "阴", "阳", "混沌"];

function normalizeStringArray(input) {
  if (input === undefined || input === null || input === "") return [];
  let value = input;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) value = parsed;
    } catch (_) {}
  }
  const source = Array.isArray(value) ? value.flat(Infinity) : String(value).split(/[,，、;；|]/);
  return [...new Set(source.map((item) => String(item).trim()).filter(Boolean))];
}

function normalizeBoolean(input) {
  if (typeof input === "boolean" || input === null || input === undefined) return input;
  if (typeof input === "number") return input !== 0;
  const text = String(input).trim().toLowerCase();
  if (["true", "1", "是", "有", "开启", "启用", "在场", "已使用"].includes(text)) return true;
  if (["false", "0", "否", "无", "关闭", "禁用", "不在场", "未使用"].includes(text)) return false;
  return undefined;
}

function normalizeStringRecord(input) {
  if (input === undefined || input === null || input === "") return undefined;
  if (typeof input === "string") return { 说明: input };
  if (Array.isArray(input)) {
    return Object.fromEntries(
      input.map((value, index) => [`效果${index + 1}`, typeof value === "string" ? value : JSON.stringify(value)]),
    );
  }
  if (typeof input !== "object") return { 说明: String(input) };
  return Object.fromEntries(
    Object.entries(input).map(([key, value]) => [
      key,
      typeof value === "string" ? value : value === null || value === undefined ? "" : JSON.stringify(value),
    ]),
  );
}

const StringArraySchema = z.preprocess(normalizeStringArray, z.array(z.string()).prefault([]));
const StringRecordSchema = z.preprocess(
  normalizeStringRecord,
  z.record(z.string(), z.string()).optional(),
);

// AI 有时会把单值五行写成数组、复合字符串或变异属性名；统一取输入中最先出现的可识别属性。
// 变异属性映射遵循世界书《世界设定-灵根与体质》，并补充常见的同义描述。
const FIVE_ELEMENT_ALIAS_MAP = {
  金: "金",
  木: "木",
  水: "水",
  火: "火",
  土: "土",
  阴: "阴",
  阳: "阳",
  混沌: "混沌",
  剑: "金",
  血: "金",
  metal: "金",
  风: "木",
  毒: "木",
  wood: "木",
  冰: "水",
  雾: "水",
  霜: "水",
  雪: "水",
  寒: "水",
  water: "水",
  ice: "水",
  雷: "火",
  冥火: "火",
  炎: "火",
  焰: "火",
  fire: "火",
  磁: "土",
  沙: "土",
  岩: "土",
  earth: "土",
  soil: "土",
  幽: "阴",
  煞: "阴",
  暗: "阴",
  影: "阴",
  冥: "阴",
  yin: "阴",
  龙: "阳",
  梵: "阳",
  光: "阳",
  日: "阳",
  yang: "阳",
  虚空: "混沌",
  混元: "混沌",
  时空: "混沌",
  chaos: "混沌",
};

const FiveElementAliases = Object.entries(FIVE_ELEMENT_ALIAS_MAP).sort(
  ([left], [right]) => right.length - left.length,
);

function normalizeFiveElement(input) {
  const candidates = Array.isArray(input) ? input.flat(Infinity) : [input];

  for (const candidate of candidates) {
    if (typeof candidate !== "string") continue;
    const normalizedCandidate = candidate.toLowerCase();

    for (let index = 0; index < normalizedCandidate.length; index += 1) {
      const matched = FiveElementAliases.find(([alias]) => normalizedCandidate.startsWith(alias, index));
      if (matched) return matched[1];
    }
  }

  // 完全无法识别时删除这个可选字段，避免一个非法五行导致整个人物或物品更新失败。
  return undefined;
}

const FiveElementsEnum = z.preprocess(normalizeFiveElement, z.enum(FiveElementValues).optional());
const FiveElementsExtEnum = z.preprocess(
  (input) => {
    if (input === "未知" || input === "无") return input;
    return normalizeFiveElement(input) ?? "未知";
  },
  z.enum(["金", "木", "水", "火", "土", "阴", "阳", "混沌", "未知", "无"]),
);
const QualityValues = ["凡", "黄", "玄", "地", "天"];
const QUALITY_ALIAS_MAP = {
  普通: "凡", 常见: "凡", 粗劣: "凡", 基础: "凡",
  精良: "黄", 精品: "黄", 优良: "黄", 优秀: "黄",
  稀有: "玄", 珍稀: "玄", 罕见: "玄",
  史诗: "地", 极品: "地", 绝品: "地",
  传说: "天", 神话: "天", 仙品: "天", 神品: "天",
};

function normalizeQuality(input) {
  if (input === undefined || input === null || input === "") return "凡";
  const text = String(input).trim();
  if (QualityValues.includes(text)) return text;
  for (const quality of [...QualityValues].reverse()) {
    if (text.includes(quality)) return quality;
  }
  for (const [alias, quality] of Object.entries(QUALITY_ALIAS_MAP)) {
    if (text.includes(alias)) return quality;
  }
  // 品质是展示/平衡用枚举；无法识别时降级为最低品质，比整条物品更新失败更安全。
  return "凡";
}

const QualityEnum = z.preprocess(normalizeQuality, z.enum(QualityValues).prefault("凡"));
const SpiritualRootRankValues = ["无灵根", "未检测", "单灵根", "双灵根", "三灵根", "四灵根", "五灵根"];
const SpiritualRootRankEnum = z.preprocess(
  (input) => {
    const text = String(input ?? "未检测").trim();
    return SpiritualRootRankValues.find((value) => text.includes(value)) ?? "未检测";
  },
  z.enum(SpiritualRootRankValues),
);

// ===== 寿元 Schema =====
const LifespanSchema = z
  .object({
    // 生日仅记录年份，由「MVU核验」脚本维护；不向 AI 输出。
    生日: z.coerce.number().int().optional(),
    // 冥族停龄是本地转换标记：离开冥族时用于重置生日，不向 AI 输出。
    冥族停龄: z.preprocess(normalizeBoolean, z.boolean().optional()),
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
    五行: z.preprocess(normalizeStringArray, z.array(FiveElementsExtEnum)).prefault(["未知"]),
    品阶: SpiritualRootRankEnum.prefault("未检测"),
  })
  .prefault({ 名称: "未检测", 五行: ["未知"], 品阶: "未检测" });

// ===== 体质 Schema =====
const PhysiqueSchema = z
  .object({
    名称: z.string().prefault("凡体"),
    效果: StringRecordSchema,
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
    // 元阴/元阳: 性征三态(true 处子 / false 已破 / null 不存在)。null≡该性征不适用,
    //   据 (元阴,元阳) 值组合判定性别(单边成立=女/男, 其余=其他)。缺失时 prefault 补 null。
    元阴: z.preprocess(normalizeBoolean, z.boolean().nullable().prefault(null)),
    元阳: z.preprocess(normalizeBoolean, z.boolean().nullable().prefault(null)),
  })
  .prefault({ 名称: "凡体", 悟性: 0, 根骨: 0, 气感: 0, 元阴: null, 元阳: null });

// ===== 修炼进度 Schema =====
const CultivationProgressFieldsSchema = z
  .object({
    境界: z.string().prefault("凡人"),
    // 本地隐藏字段：主角与 NPC 均由 MVU 核验脚本在境界变动时写入，单位为修仙历年份。
    上次突破时间点: z.coerce.number().int().nullable().prefault(null),
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
    丹毒: z.coerce
      .number()
      .transform((n) => _.clamp(n, 0, Infinity))
      .prefault(0),
  });

const CultivationProgressSchema = CultivationProgressFieldsSchema.prefault({
  境界: "凡人", 上次突破时间点: null, 当前进度: 0, 进度上限: 100, 天谴: 0, 丹毒: 0,
});

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
  效果: StringRecordSchema,
  层数: z.coerce
    .number()
    .transform((n) => _.clamp(n, 0, Infinity))
    .prefault(1),
  剩余时间: z.string().prefault("永久"),
  来源: z.string().prefault(""),
});

// ===== 功法 Schema =====
const CultivationArtSchema = z.object({
  使用中: z.preprocess(normalizeBoolean, z.boolean().prefault(false)),
  品质: QualityEnum.prefault("凡"),
  境界: z.string().prefault("练气期"),
  五行: FiveElementsEnum.optional(),
  类型: z
    .enum(["心法", "攻击", "幻术", "神识", "咒法", "身法", "护体", "阵法"])
    .prefault("心法"),
  消耗: z.string().optional(),
  标签: StringArraySchema,
  效果: StringRecordSchema,
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
  标签: StringArraySchema,
  数量: z.coerce
    .number()
    .transform((n) => _.clamp(n, 0, Infinity))
    .prefault(0),
  效果: StringRecordSchema,
  描述: z.string().prefault(""),
});

// ===== 装备 Schema (法宝/护甲/饰品 合并) =====
const EquipmentSchema = z.object({
  品质: QualityEnum.prefault("凡"),
  境界: z.string().optional(),
  类型: z.enum(["法宝", "护甲", "饰品"]).prefault("法宝"),
  消耗: z.string().optional(),
  五行: FiveElementsEnum.optional(),
  标签: StringArraySchema, // 法宝→[攻击力:N]、护甲→[防御力:N]
  效果: StringRecordSchema,
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
  效果: StringRecordSchema,
});

// ===== 傀儡/灵兽 Schema =====
const CombatUnitSchema = z.object({
  使用中: z.preprocess(normalizeBoolean, z.boolean().prefault(false)),
  品质: QualityEnum.prefault("凡"),
  境界: z.string().prefault("凡人"),
  五行: FiveElementsEnum.optional(),
  标签: StringArraySchema,
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
  在场: z.preprocess(normalizeBoolean, z.boolean().prefault(false)),
  种族: z.string().prefault("人族"),
  身份: StringArraySchema,
  修炼进度: CultivationProgressSchema,
  寿元: LifespanSchema,
  灵根: SpiritualRootSchema,
  体质: PhysiqueSchema, // 元阴/元阳 已并入 体质
  技艺: SkillSchema,
  资源池: ResourcePoolSchema,
  状态效果: z.record(z.string(), StatusEffectSchema).prefault({}),
  功法: z.record(z.string(), CultivationArtSchema).prefault({}),
  ...StorageFields, // 灵石 / 物品 / 装备 / 傀儡 / 灵兽 直接挂在 NPC 根级,与 user 一致
  性格: z.string().prefault(""),
  外貌: z.string().prefault(""),
  着装: z.string().prefault(""),
  道侣: z.preprocess(normalizeBoolean, z.boolean().prefault(false)),
  好感度: z.coerce
    .number()
    .transform((n) => _.clamp(n, -100, 100))
    .prefault(0),
  关系: z.string().prefault(""), // NPC 与 <user> 的当前双方关系，一句话描述
  // 细节可见(前端偏好, 默认true; false时变量输出EJS隐去该NPC的物品/功法/装备/傀儡/灵兽)
  细节可见: z.preprocess(normalizeBoolean, z.boolean().prefault(true)),
  // 性器(外部脚本按五行随机填充, AI只读不更新; key=口腔/屄穴/肛门/乳房, value=描述)
  性器: z.record(z.string(), z.string()).prefault({}),
});

// ===== 无主战斗单位 (关系列表条目, 类型='傀儡'|'灵兽') =====
// 用于 关系列表 中表达 "野生妖兽 / 遗弃傀儡 / 临时随从" 等无主形态
const WildPuppetSchema = z.object({
  类型: z.literal("傀儡"),
  在场: z.preprocess(normalizeBoolean, z.boolean().prefault(true)),
  品质: QualityEnum.prefault("凡"),
  境界: z.string().prefault("凡人"),
  五行: FiveElementsEnum.optional(),
  标签: StringArraySchema,
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
  (val) => {
    if (!val || typeof val !== "object" || Array.isArray(val)) return val;
    let normalized = val;
    if (!normalized.类型) normalized = { ...normalized, 类型: "人物" };
    if (normalized.类型 === "人物" && !("关系" in normalized) && typeof normalized.关系类型 === "string") {
      normalized = { ...normalized, 关系: normalized.关系类型 };
    }
    return normalized;
  },
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
const TIME_PERIODS = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"];
const TIME_PERIOD_ALIASES = {
  夜半: "子",
  子夜: "子",
  午夜: "子",
  鸡鸣: "丑",
  平旦: "寅",
  日出: "卯",
  食时: "辰",
  隅中: "巳",
  日中: "午",
  日昳: "未",
  晡时: "申",
  日入: "酉",
  黄昏: "戌",
  人定: "亥",
};

function normalizeTimePeriod(input) {
  const text = String(input ?? "").trim();
  const period = TIME_PERIODS.find((item) =>
    text === item || ["时", "初", "正", "刻", "中", "末", "半"].some((suffix) => text.includes(`${item}${suffix}`)),
  );
  if (period) return `${period}时`;
  const alias = Object.entries(TIME_PERIOD_ALIASES).find(([name]) => text.includes(name));
  return alias ? `${alias[1]}时` : "午时";
}

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
    // “子时中 / 子时三刻 / 子初 / 子正”等可理解写法统一收敛到所属时辰。
    时辰: z.preprocess(normalizeTimePeriod, z.enum(TIME_PERIODS.map((item) => `${item}时`))).prefault("午时"),
  })
  .prefault({ 年: 1, 月: 1, 日: 1, 时辰: "午时" });

// ===== 固定资产 Schema (仅主角根级持有) =====
// 分配人物仅保存实际在该资产工作的 NPC 姓名数组；人物详细资料仍统一维护在关系列表，避免双处存储发生冲突。
// 所在地复用 LocationSchema；上次收取日期复用 TimeSchema，null 表示从未收取。
function normalizeLooseString(input, fallback) {
  if (input === undefined || input === null) return fallback;
  return typeof input === "string" ? input : String(input);
}

function normalizeNonNegativeInteger(input) {
  if (typeof input === "number" && Number.isFinite(input)) return Math.max(0, Math.trunc(input));
  const matched = String(input ?? "").match(/-?\d+(?:\.\d+)?/);
  return Math.max(0, Math.trunc(matched ? Number(matched[0]) : 0));
}

function normalizeAssetType(input) {
  const text = String(input ?? "").trim().toLowerCase();
  if (/宗门|宗派|门派|宗族|sect/.test(text)) return "宗门";
  if (/店铺|商铺|铺面|坊市|商行|商会|store|shop/.test(text)) return "店铺";
  return "洞府";
}

function normalizeAssetLocation(input) {
  if (typeof input === "string") {
    const parts = input.split(/\s*(?:[·•>＞/／|]|\s+-\s+)\s*/).filter(Boolean);
    const hasWorld = !!parts[0] && /[凡灵仙]界/.test(parts[0]);
    return {
      世界: hasWorld ? parts[0] : "凡界",
      地域: hasWorld ? parts[1] || "中原" : parts.length >= 2 ? parts[0] : "中原",
      具体地点: hasWorld
        ? parts.length >= 3 ? parts.slice(2).join("·") : "荒野"
        : parts.length >= 2 ? parts.slice(1).join("·") : parts[0] || "荒野",
    };
  }
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};
  return {
    世界: input.世界 ?? input.界域 ?? input.位面 ?? "凡界",
    地域: input.地域 ?? input.区域 ?? input.州域 ?? "中原",
    具体地点: input.具体地点 ?? input.地点 ?? input.地址 ?? input.位置 ?? "荒野",
  };
}

function normalizeAssetWorld(input) {
  const text = String(input ?? "");
  return /仙/.test(text) ? "仙界" : /灵/.test(text) ? "灵界" : "凡界";
}

function normalizeAssetTime(input) {
  if (input === undefined || input === null || ["", "无", "暂无", "从未", "未收取", "null"].includes(String(input).trim())) {
    return null;
  }
  if (typeof input === "string") {
    const numbers = (input.match(/\d+/g) || []).map(Number);
    if (numbers.length === 0) return null;
    return { 年: numbers[0], 月: numbers[1] ?? 1, 日: numbers[2] ?? 1, 时辰: normalizeTimePeriod(input) };
  }
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  return {
    年: normalizeNonNegativeInteger(input.年 ?? input.year ?? 1) || 1,
    月: _.clamp(normalizeNonNegativeInteger(input.月 ?? input.month ?? 1) || 1, 1, 12),
    日: _.clamp(normalizeNonNegativeInteger(input.日 ?? input.day ?? 1) || 1, 1, 30),
    时辰: normalizeTimePeriod(input.时辰 ?? input.时间 ?? "午时"),
  };
}

function normalizeNamedRecord(input, fallbackName) {
  if (input === undefined || input === null || input === "") return {};
  if (!Array.isArray(input)) return typeof input === "object" ? input : {};
  return Object.fromEntries(input.map((entry, index) => {
    const value = entry && typeof entry === "object" ? { ...entry } : { 效果: entry };
    const name = String(value.名称 ?? value.设施名 ?? value.资产名 ?? `${fallbackName}${index + 1}`).trim();
    delete value.名称;
    delete value.设施名;
    delete value.资产名;
    return [name || `${fallbackName}${index + 1}`, value];
  }));
}

function normalizeAssetFacility(input) {
  if (typeof input === "string") return { 效果: input };
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};
  return {
    效果: input.效果 ?? input.效用 ?? input.功能,
    每月产出: input.每月产出 ?? input.月产出 ?? input.产出,
    上次收取日期: input.上次收取日期 ?? input.上次收取 ?? input.收取日期,
  };
}

function normalizeFixedAsset(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};
  return {
    类型: input.类型 ?? input.分类 ?? input.资产类型,
    人员规模: input.人员规模 ?? input.人数 ?? input.规模,
    所在地: input.所在地 ?? input.地址 ?? input.位置,
    现状: input.现状 ?? input.状态 ?? input.当前状态,
    设施: normalizeNamedRecord(input.设施 ?? input.建筑 ?? input.功能区, "新设施"),
    // “所属人物”为旧版正式字段：只在读入时兼容，解析后统一迁移为“分配人物”。
    分配人物: input.分配人物 ?? input.所属人物 ?? input.工作人员 ?? input.工作者 ?? input.人员 ?? input.归属人物 ?? input.成员,
  };
}

const AssetLocationSchema = z.preprocess(
  normalizeAssetLocation,
  z.object({
    世界: z.preprocess(normalizeAssetWorld, z.enum(["凡界", "灵界", "仙界"])),
    地域: z.preprocess((input) => normalizeLooseString(input, "中原"), z.string()),
    具体地点: z.preprocess((input) => normalizeLooseString(input, "荒野"), z.string()),
  }),
).prefault({ 世界: "凡界", 地域: "中原", 具体地点: "荒野" });

const AssetTimeSchema = z.preprocess(normalizeAssetTime, TimeSchema.nullable()).prefault(null);

const AssetFacilitySchema = z.preprocess(
  normalizeAssetFacility,
  z.object({
    效果: StringRecordSchema.prefault({}),
    每月产出: z.preprocess((input) => normalizeLooseString(input, "无"), z.string()).prefault("无"),
    上次收取日期: AssetTimeSchema,
  }),
);
const FixedAssetSchema = z.preprocess(
  normalizeFixedAsset,
  z.object({
    类型: z.preprocess(normalizeAssetType, z.enum(["宗门", "店铺", "洞府"])).prefault("洞府"),
    人员规模: z.preprocess(normalizeNonNegativeInteger, z.number().int().min(0)).prefault(0),
    所在地: AssetLocationSchema,
    现状: z.preprocess((input) => normalizeLooseString(input, "正常"), z.string()).prefault("正常"),
    设施: z.preprocess((input) => normalizeNamedRecord(input, "新设施"), z.record(z.string(), AssetFacilitySchema)).prefault({}),
    分配人物: StringArraySchema,
  }),
);
const FixedAssetsSchema = z.preprocess(
  (input) => normalizeNamedRecord(input, "新资产"),
  z.record(z.string(), FixedAssetSchema),
).prefault({});

// ===== 任务 Schema =====
// 任务只保存尚未结束的条目；完成、失败或放弃后直接移除，不保留履历。
const TaskSchema = z.object({
  状态: z.enum(["进行中", "待结算"]).prefault("进行中"),
  委托方: z.preprocess((input) => normalizeLooseString(input, "未知"), z.string()).prefault("未知"),
  难度: z.preprocess((input) => normalizeLooseString(input, "未定"), z.string()).prefault("未定"),
  目标: z.preprocess((input) => normalizeLooseString(input, ""), z.string()).prefault(""),
  进展: z.preprocess((input) => normalizeLooseString(input, ""), z.string()).prefault(""),
  奖励: z.preprocess((input) => normalizeLooseString(input, "无"), z.string()).prefault("无"),
  交付: z.preprocess((input) => normalizeLooseString(input, "无"), z.string()).prefault("无"),
  截止时间: AssetTimeSchema,
});
const TasksSchema = z.record(z.string(), TaskSchema).prefault({});

// ===== 剧情事件 Schema =====
// 事件字段早已存在于初始变量与更新规则中；此前漏注册到主 Schema，导致合法事件命令
// 会被路径白名单或 Zod 校验误判为未知字段。
const EventSchema = z
  .object({
    开启: z.preprocess(normalizeBoolean, z.boolean().prefault(false)),
    标题: z.string().prefault(""),
    阶段: z.string().prefault(""),
    已完成事件: StringArraySchema,
    进度: z.record(z.string(), z.unknown()).optional(),
  })
  .prefault({ 开启: false, 标题: "", 阶段: "", 已完成事件: [] });

// ===== 传闻 Schema =====
// 内容由前端引擎 (src/修仙状态栏/timeline-engine.ts) 生成并写回此字段,
// AI 仅读、不写。详见 [mvu_update]变量更新规则.yaml。
const TimelineDateSchema = z.object({
  年: z.coerce.number(),
  月: z.coerce.number(),
  日: z.coerce.number(),
});
const RumorEntrySchema = z.object({
  id: z.string(),
  时间区间: z.object({
    起: TimelineDateSchema,
    止: TimelineDateSchema,
  }),
  世界: z.string(),
  地域: z.string(),
  地点: z.string(),
  类别: z.string(),
  内容: z.string(),
  难度: z.string(),
});

// ===== 主 Schema (扁平化:基本信息/修炼功法/储物空间 三大类拆掉) =====
export const Schema = z.object({
  // —— 原 基本信息.* ——
  姓名: z.string().prefault("User"),
  寿元: LifespanSchema,
  种族: z.string().prefault("人族"),
  身份: StringArraySchema, // 散修 / 宗门+地位,可多个(与 NPC 身份 一致)
  灵根: SpiritualRootSchema,
  体质: PhysiqueSchema,
  // 性器(外部脚本按五行随机填充, AI只读不更新; key=口腔/屄穴/肛门/乳房, value=描述)
  性器: z.record(z.string(), z.string()).prefault({}),
  修炼进度: CultivationProgressSchema,
  技艺: SkillSchema,
  资源池: ResourcePoolSchema,
  固定资产: FixedAssetsSchema,
  任务: TasksSchema,
  地点: LocationSchema,
  时间: TimeSchema,
  状态效果: z.record(z.string(), StatusEffectSchema).prefault({}),
  事件: EventSchema,

  // —— 原 修炼功法.功法 ——
  功法: z.record(z.string(), CultivationArtSchema).prefault({}),

  // —— 原 储物空间.* ——
  ...StorageFields,

  // —— 不变 ——
  关系列表: z.record(z.string(), RelationEntrySchema).prefault({}),

  // —— 传闻 (前端引擎写,AI 仅读) ——
  传闻: z.array(RumorEntrySchema).prefault([]),
});

// ============================================================
// JSONPatch 预处理器
//   在 mvu_zod 的 mag_command_parsed_for_zod 处理器之前执行,
//   对 AI 输出的 JSONPatch 中的 value 进行清洗,以提升对脏数据的容错:
//     1. 丢弃 schema 之外的多余字段(如 NPC.背景故事 / 体质.描述)
//     2. 好感度 中文映射(高:10/中:5/低:0/仇视:-10/友善:5, 其他:0)
//     3. 缺 类型 字段的 关系列表 条目默认补 '人物'
//     4. 按命令路径补齐旧存档中缺失的合法父容器
//     5. 丢弃目标本就不存在的 remove，避免一条坏命令拖累同批正确更新
//   依赖 eventOn 的"先注册先执行"特性: 本模块在 registerMvuSchema 之前注册.
// ============================================================

// 各 schema 允许字段白名单 — 与 Zod 定义保持同步
const NPC_FIELDS = new Set([
  "类型", "在场", "种族", "身份",
  "修炼进度", "寿元", "灵根", "体质",
  "技艺", "资源池", "状态效果", "功法",
  "灵石", "物品", "装备", "傀儡", "灵兽",
  "性格", "外貌", "着装", "道侣", "好感度", "关系",
  "细节可见", "性器",
]);
const PHYSIQUE_FIELDS = new Set(["名称", "效果", "悟性", "根骨", "气感", "元阴", "元阳"]);
const SPIRITUAL_ROOT_FIELDS = new Set(["名称", "五行", "品阶"]);
const LIFESPAN_FIELDS = new Set(["生日", "冥族停龄", "年龄", "寿命", "外观年龄"]);
const CULTIVATION_PROGRESS_FIELDS = new Set(["境界", "上次突破时间点", "当前进度", "进度上限", "天谴", "丹毒"]);
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
const FIXED_ASSET_FIELDS = new Set(["类型", "人员规模", "所在地", "现状", "设施", "分配人物"]);
const ASSET_FACILITY_FIELDS = new Set(["效果", "每月产出", "上次收取日期"]);
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

function sanitizeFixedAsset(asset) {
  if (!asset || typeof asset !== "object" || Array.isArray(asset)) return asset;
  const cleaned = pickFields(normalizeFixedAsset(asset), FIXED_ASSET_FIELDS);
  if (cleaned.设施 && typeof cleaned.设施 === "object") {
    for (const key of Object.keys(cleaned.设施)) {
      cleaned.设施[key] = pickFields(normalizeAssetFacility(cleaned.设施[key]), ASSET_FACILITY_FIELDS);
    }
  }
  if ("分配人物" in cleaned) cleaned.分配人物 = normalizeStringArray(cleaned.分配人物);
  return cleaned;
}

// 清洗 "关系列表/人物" 条目(原地修改并返回);
// 与 RelationEntrySchema 的 preprocess 共享同一份字段规则,作为入站清洗主入口
function sanitizeNpcEntry(input) {
  if (!input || typeof input !== "object") return input;
  // 1. 缺类型 → 默认 人物
  if (!input.类型) input.类型 = "人物";
  if (input.类型 !== "人物") return sanitizeWildEntry(input);

  // 兼容旧脚本曾使用的“关系类型”；标准字段统一为“关系”。
  if (!("关系" in input) && "关系类型" in input) input.关系 = input.关系类型;

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

  // 6. 元阴/元阳(已并入 体质)三态规整: null ≡ "该性征不存在"。
  //    无论 AI 写入何种格式(如只给 体质.元阴:true),都补齐为两字段、各取 true|false|null,
  //    供据 (元阴,元阳) 值组合判定性别: 单边成立=男/女, 其余=其他。
  if (npc.体质 && typeof npc.体质 === "object") {
    npc.体质.元阴 = npc.体质.元阴 === true || npc.体质.元阴 === false ? npc.体质.元阴 : null;
    npc.体质.元阳 = npc.体质.元阳 === true || npc.体质.元阳 === false ? npc.体质.元阳 : null;
  }

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
  "姓名", "寿元", "种族", "身份", "灵根", "体质", "修炼进度",
  "性器", "技艺", "资源池", "固定资产", "任务", "地点", "时间", "状态效果", "功法",
  "灵石", "物品", "装备", "傀儡", "灵兽",
  "关系列表", "事件", "传闻",
]);

// 这些键在 schema 中只在顶级出现, NPC 子结构、record 内都不含;
// 出现在路径中段必然是错误嵌套 (例 /状态效果/时间/年).
const TOP_LEVEL_ONLY_KEYS = new Set(["姓名", "固定资产", "任务", "地点", "时间", "事件", "传闻"]);
const TOP_LEVEL_KEY_ALIASES = { 资产: "固定资产", 不动产: "固定资产", 产业: "固定资产" };
const FIXED_ASSET_KEY_ALIASES = {
  分类: "类型", 资产类型: "类型",
  人数: "人员规模", 规模: "人员规模",
  地址: "所在地", 位置: "所在地",
  状态: "现状", 当前状态: "现状",
  建筑: "设施", 功能区: "设施",
  所属人物: "分配人物", 工作人员: "分配人物", 工作者: "分配人物",
  人员: "分配人物", 归属人物: "分配人物", 成员: "分配人物",
};
const ASSET_FACILITY_KEY_ALIASES = {
  效用: "效果", 功能: "效果",
  月产出: "每月产出", 产出: "每月产出",
  上次收取: "上次收取日期", 收取日期: "上次收取日期",
};
const ASSET_LOCATION_KEY_ALIASES = {
  界域: "世界", 位面: "世界",
  区域: "地域", 州域: "地域",
  地点: "具体地点", 地址: "具体地点", 位置: "具体地点",
};

// 这些字段在合法存档中必为容器。旧存档、初始化被截断或其他脚本误删字段时，
// MVU 会因为父级不存在而拒绝本来可以理解的 insert。这里只恢复 Schema 明确定义的
// 固定容器，不会创建 AI 杜撰的顶级字段。
const TOP_LEVEL_CONTAINER_DEFAULTS = {
  寿元: { 年龄: 0, 寿命: 100, 外观年龄: 18 },
  身份: [],
  灵根: { 名称: "未检测", 五行: ["未知"], 品阶: "未检测" },
  体质: { 名称: "凡体", 悟性: 0, 根骨: 0, 气感: 0, 元阴: null, 元阳: null },
  性器: {},
  修炼进度: { 境界: "凡人", 当前进度: 0, 进度上限: 100, 天谴: 0, 丹毒: 0 },
  技艺: {
    生产类: { 炼器: 0, 驯兽: 0, 培育: 0, 医术: 0, 炼丹: 0, 制符: 0 },
    战斗类: { 御物: 0, 咒法: 0, 幻术: 0, 阵法: 0, 神识: 0, 炼体: 0 },
  },
  资源池: {
    气血: { 现值: 100, 上限: 100 },
    灵气: { 现值: 100, 上限: 100 },
    遁速: 10,
  },
  固定资产: {},
  任务: {},
  地点: { 世界: "凡界", 地域: "中原", 具体地点: "荒野" },
  时间: { 年: 1, 月: 1, 日: 1, 时辰: "午时" },
  状态效果: {},
  事件: { 开启: false, 标题: "", 阶段: "", 已完成事件: [] },
  功法: {},
  物品: {},
  装备: {},
  傀儡: {},
  灵兽: {},
  关系列表: {},
  传闻: [],
};

const TOP_LEVEL_SCALAR_DEFAULTS = {
  姓名: "User",
  种族: "人族",
  灵石: 0,
};

function isPlainRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function cloneDefault(value) {
  return _.cloneDeep(value);
}

// 只补缺失键，不覆盖玩家存档里已有的合法值。safeParse 成功时，它给出的 data
// 同时包含 NPC、物品、装备等深层 prefault，能修复比顶层更深的残缺旧存档。
function fillMissingDefaults(target, defaults) {
  if (!isPlainRecord(target) || !isPlainRecord(defaults)) return;
  for (const [key, defaultValue] of Object.entries(defaults)) {
    if (target[key] === undefined || target[key] === null) {
      target[key] = cloneDefault(defaultValue);
    } else if (isPlainRecord(target[key]) && isPlainRecord(defaultValue)) {
      fillMissingDefaults(target[key], defaultValue);
    }
  }
}

function repairMissingSchemaContainers(variables) {
  const statData = variables?.stat_data;
  if (!isPlainRecord(statData)) return;

  for (const [key, defaultValue] of Object.entries(TOP_LEVEL_SCALAR_DEFAULTS)) {
    if (statData[key] === undefined || statData[key] === null || statData[key] === "") {
      statData[key] = defaultValue;
      console.warn(`[JSONPatch preprocessor] 恢复缺失的变量字段: ${key}`);
    }
  }

  // 无论整份存档是否能通过校验，都先保证固定顶级容器存在且类型正确。
  for (const [key, defaultValue] of Object.entries(TOP_LEVEL_CONTAINER_DEFAULTS)) {
    const current = statData[key];
    const expectedArray = Array.isArray(defaultValue);
    const hasRightShape = expectedArray ? Array.isArray(current) : isPlainRecord(current);
    if (current === undefined || current === null || current === "" || current === "无" || current === "暂无") {
      statData[key] = cloneDefault(defaultValue);
      console.warn(`[JSONPatch preprocessor] 恢复缺失或损坏的变量容器: ${key}`);
    } else if (!hasRightShape) {
      // 不擅自覆盖非空的异型旧数据；它可能仍对其他脚本有意义。
      console.warn(`[JSONPatch preprocessor] 变量容器类型异常，已保留原值: ${key}`);
    } else if (!expectedArray) {
      fillMissingDefaults(current, defaultValue);
    }
  }

  // 若其余现有值也都可被 Schema 解读，则进一步补齐每个已有记录的深层默认字段。
  // 使用“只补缺失”的合并方式，避免 Zod strip 行为删除任何旧版或外部脚本字段。
  try {
    const parsed = Schema.safeParse(statData);
    if (parsed.success) fillMissingDefaults(statData, parsed.data);
  } catch (error) {
    console.warn("[JSONPatch preprocessor] 深层默认值恢复失败，已保留顶级容错", error);
  }
}

function decodeJsonPointerSegment(segment) {
  return segment.replace(/~1/g, "/").replace(/~0/g, "~");
}

function splitPath(rawPath) {
  if (typeof rawPath !== "string" || !rawPath) return [];
  const stripped = rawPath.replace(/^[\\"'` ]+|[\\"'` ]+$/g, "");
  if (stripped.startsWith("/")) {
    return stripped.split("/").filter(Boolean).map(decodeJsonPointerSegment);
  }
  return _.toPath(stripped).filter(Boolean).map(decodeJsonPointerSegment);
}

function joinPath(segments) {
  return segments
    .map((segment, index) => {
      const text = String(segment);
      // 含点、斜杠或引号的动态名称必须保留为一个 key，不能被 lodash 再拆开。
      if (!/[.\\/\[\]'\"]/.test(text)) return index === 0 ? text : `.${text}`;
      return `[${JSON.stringify(text)}]`;
    })
    .join("");
}

function fixPath(rawPath) {
  if (typeof rawPath !== "string" || !rawPath) return rawPath;
  // 支持 JSON Pointer、lodash 点路径和方括号路径。
  const segments = splitPath(rawPath);
  if (segments.length === 0) return rawPath;

  // 先把 AI 常用的资产字段别名改为正式 schema 路径，再进行顶级键识别与截断。
  const likelyRootIndex = segments.findIndex((segment) => ALL_TOP_LEVEL_KEYS.has(segment) || TOP_LEVEL_KEY_ALIASES[segment]);
  if (likelyRootIndex >= 0) {
    segments[likelyRootIndex] = TOP_LEVEL_KEY_ALIASES[segments[likelyRootIndex]] ?? segments[likelyRootIndex];
  }
  const assetRootIndex = segments.indexOf("固定资产");
  if (assetRootIndex >= 0 && segments.length > assetRootIndex + 2) {
    const fieldIndex = assetRootIndex + 2;
    segments[fieldIndex] = FIXED_ASSET_KEY_ALIASES[segments[fieldIndex]] ?? segments[fieldIndex];
    if (segments[fieldIndex] === "所在地" && segments.length > fieldIndex + 1) {
      segments[fieldIndex + 1] = ASSET_LOCATION_KEY_ALIASES[segments[fieldIndex + 1]] ?? segments[fieldIndex + 1];
    }
    if (segments[fieldIndex] === "设施" && segments.length > fieldIndex + 2) {
      segments[fieldIndex + 2] = ASSET_FACILITY_KEY_ALIASES[segments[fieldIndex + 2]] ?? segments[fieldIndex + 2];
    }
  }

  const original = joinPath(segments);

  // A. 扫描首个合法顶级键, 截断之前的所有 segment (无论前缀长什么样)
  //    若 segments[0] 已是顶级键, firstTopIdx === 0, 不会截断
  //    若没有任何顶级键命中, 保持原样让下游报错(避免静默错改路径)
  const firstTopIdx = segments.findIndex((s) => ALL_TOP_LEVEL_KEYS.has(s));
  if (firstTopIdx > 0) {
    segments.splice(0, firstTopIdx);
  }

  // B. 扫描中段是否有 top-level-only 键 (错误嵌套), 有则从该段截断
  for (let i = 1; i < segments.length; i++) {
    if (TOP_LEVEL_ONLY_KEYS.has(segments[i])) {
      segments.splice(0, i);
      break;
    }
  }

  const fixed = joinPath(segments);
  if (fixed !== original || fixed !== rawPath) {
    console.warn(`[JSONPatch preprocessor] 规范路径: "${rawPath}" → "${fixed}"`);
  }
  return fixed;
}

// 取(修正后)路径的根段, 用于判断是否指向合法顶级词条
function pathRootKey(rawPath) {
  const segments = splitPath(rawPath);
  return segments[0] || "";
}

// MagVarUpdate 在触发命令钩子前会把 JSON Pointer 粗略转成点路径，导致动态 key
// 中原本合法的点、斜杠或方括号失去边界。利用 full_match 中的原始 JSON 还原它。
function restoreOriginalJsonPatchPath(command) {
  if (command?.reason !== "json_patch" || typeof command.full_match !== "string") return;
  let patch;
  try {
    patch = JSON.parse(command.full_match);
  } catch (_) {
    return;
  }

  const targetSegments = splitPath(patch.path ?? patch.to);
  if (targetSegments.length === 0) return;
  if (command.type === "insert") {
    command.args[0] = joinPath(targetSegments.slice(0, -1));
    command.args[1] = JSON.stringify(targetSegments.at(-1));
  } else if (command.type === "move") {
    command.args[0] = joinPath(splitPath(patch.from));
    command.args[1] = joinPath(targetSegments);
  } else {
    command.args[0] = joinPath(targetSegments);
  }
}

function commandCreatesPath(command, targetPath) {
  if (!command || !Array.isArray(command.args)) return false;
  if (command.type === "set") {
    const setPath = fixPath(command.args[0]);
    return setPath === targetPath || targetPath.startsWith(`${setPath}.`);
  }
  if (command.type === "insert" && command.args.length >= 3) {
    const parent = fixPath(command.args[0]);
    const key = tryParseValue(command.args[1]);
    const insertedPath = joinPath([...splitPath(parent), String(key)]);
    return insertedPath === targetPath || targetPath.startsWith(`${insertedPath}.`);
  }
  return false;
}

function dropHarmlessMissingDeletes(variables, commands) {
  const statData = variables?.stat_data;
  if (!isPlainRecord(statData)) return;
  for (let index = commands.length - 1; index >= 0; index--) {
    const command = commands[index];
    if (command?.type !== "delete" || !Array.isArray(command.args)) continue;
    const targetPath = fixPath(command.args.map((arg) => tryParseValue(arg)).join("."));
    if (_.has(statData, targetPath)) continue;
    const isCreatedEarlier = commands.slice(0, index).some((earlier) => commandCreatesPath(earlier, targetPath));
    if (!isCreatedEarlier) {
      console.warn(`[JSONPatch preprocessor] 忽略目标已不存在的删除: ${targetPath}`);
      commands.splice(index, 1);
    }
  }
}

// mag_command_parsed_for_zod 钩子: 在 mvu_zod 处理器之前清洗每个 command 的 args
function jsonPatchPreprocessor(_variables, commands) {
  if (!Array.isArray(commands)) return;
  repairMissingSchemaContainers(_variables);
  // 倒序遍历: 便于在原数组上 splice 掉无效命令而不打乱后续索引
  for (let ci = commands.length - 1; ci >= 0; ci--) {
    const cmd = commands[ci];
    if (!cmd || !Array.isArray(cmd.args)) continue;
    restoreOriginalJsonPatchPath(cmd);
    // 1. 先修正路径(args[0] 是 path, 对 move 命令 args[1] 也是 path)
    if (cmd.args.length > 0) cmd.args[0] = fixPath(cmd.args[0]);
    if (cmd.type === "move" && cmd.args.length > 1) cmd.args[1] = fixPath(cmd.args[1]);
    // 1.5 容错: 修正后路径根段仍不属于当前 schema 的合法顶级词条 → 指向不存在的字段。
    //     整批 JSONPatch 是原子应用的,留着它会令同批的正确命令(如新增 NPC)一并失败,
    //     故在此丢弃,使其余命令照常生效。判定以 ALL_TOP_LEVEL_KEYS 为准 —— 日后新增
    //     顶级字段时,同步把它加进该集合与 Schema 即可被正常接受。
    const rootKey = pathRootKey(cmd.args[0]);
    if (rootKey && !ALL_TOP_LEVEL_KEYS.has(rootKey)) {
      console.warn(`[JSONPatch preprocessor] 丢弃指向无效词条的命令: ${cmd.type} ${cmd.args[0]}`);
      commands.splice(ci, 1);
      continue;
    }
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
    const segments = splitPath(cmd.args[0]);
    // insert 的第二个参数是动态 key，不是 value；资产/设施由数组误写为 record 时，
    // 允许对象中的 名称/资产名/设施名 作为 key，缺失时再使用稳定占位名。
    if (cmd.type === "insert" && segments[0] === "固定资产" && cmd.args.length >= 3) {
      const rawKey = tryParseValue(cmd.args[1]);
      const rawValue = tryParseValue(cmd.args.at(-1));
      if ((rawKey === undefined || rawKey === null || typeof rawKey === "object" || String(rawKey).trim() === "")
        && rawValue && typeof rawValue === "object") {
        const fallback = segments[2] === "设施" ? "新设施" : "新资产";
        cmd.args[1] = String(rawValue.名称 ?? rawValue.设施名 ?? rawValue.资产名 ?? fallback).trim() || fallback;
      }
    }
    // 固定资产以“完整资产对象”新增；单独按路径处理，避免与 NPC 的递归识别混淆。
    if (segments[0] === "固定资产" && cmd.args.length >= 2) {
      const valueIndex = cmd.args.length - 1;
      const value = tryParseValue(cmd.args[valueIndex]);
      const pointsToAsset = segments.length === 2 || (cmd.type === "insert" && segments.length === 1);
      const pointsToFacility = segments[2] === "设施"
        && ((cmd.type === "insert" && segments.length === 3) || (cmd.type !== "insert" && segments.length === 4));
      if (value && typeof value === "object") {
        if (pointsToAsset) cmd.args[valueIndex] = sanitizeFixedAsset(value);
        else if (pointsToFacility) cmd.args[valueIndex] = pickFields(normalizeAssetFacility(value), ASSET_FACILITY_FIELDS);
      }
    }
  }
  dropHarmlessMissingDeletes(_variables, commands);
}

$(() => {
  // 先注册预处理器,确保在 mvu_zod 的同名事件处理器之前执行
  eventOn("mag_command_parsed_for_zod", jsonPatchPreprocessor);
  registerMvuSchema(Schema);
});
