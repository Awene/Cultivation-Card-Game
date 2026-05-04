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
// preprocess: 老数据/AI 遗漏 类型 字段时 默认补 '人物',保持向后兼容
const RelationEntrySchema = z.preprocess(
  (val) => {
    if (val && typeof val === "object" && !val.类型) {
      return { ...val, 类型: "人物" };
    }
    return val;
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

$(() => {
  registerMvuSchema(Schema);
});
