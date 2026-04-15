import { registerMvuSchema } from 'https://testingcf.jsdelivr.net/gh/StageDog/tavern_resource/dist/util/mvu_zod.js';

/* ═══════════════════════════════════════════
 *  复用子结构
 * ═══════════════════════════════════════════ */

// 技艺
const Skill = z.object({
  生产类: z.object({
    炼器: z.coerce.number().prefault(0),
    驯兽: z.coerce.number().prefault(0),
    培育: z.coerce.number().prefault(0),
    卜卦: z.coerce.number().prefault(0),
    炼丹: z.coerce.number().prefault(0),
    符箓: z.coerce.number().prefault(0),
  }).prefault({}),
  战斗类: z.object({
    御物: z.coerce.number().prefault(0),
    咒法: z.coerce.number().prefault(0),
    幻术: z.coerce.number().prefault(0),
    阵法: z.coerce.number().prefault(0),
    神识: z.coerce.number().prefault(0),
    炼体: z.coerce.number().prefault(0),
  }).prefault({}),
}).prefault({});

// 状态效果
const Buff = z.record(
  z.string(),
  z.object({
    类型: z.string().prefault('增益'),
    效果: z.string().prefault(''),
    层数: z.coerce.number().prefault(1),
    剩余时间: z.string().prefault(''),
    来源: z.string().prefault(''),
  })
).prefault({});

// 功法
const Cultivation = z.object({
  运行中: z.boolean().prefault(false),
  境界: z.string().prefault(''),
  五行: z.string().prefault(''),
  类型: z.string().prefault('功法'),
  消耗: z.string().prefault(''),
  标签: z.array(z.string()).prefault([]),
  效果: z.record(z.string(), z.string()).prefault({}),
  描述: z.string().prefault(''),
}).prefault({});

// 物品
const Item = z.object({
  类型: z.string().prefault('其他'),
  境界: z.string().prefault(''),
  五行: z.string().prefault(''),
  消耗: z.string().prefault(''),
  标签: z.array(z.string()).prefault([]),
  数量: z.coerce.number().prefault(1),
  效果: z.record(z.string(), z.string()).prefault({}),
  描述: z.string().prefault(''),
  位置: z.string().prefault('储物袋'),
}).prefault({});

// 战斗单位（法宝/傀儡/灵兽）
const CombatUnit = z.object({
  境界: z.string().prefault(''),
  五行: z.string().prefault(''),
  消耗: z.string().prefault(''),
  标签: z.array(z.string()).prefault([]),
  数量: z.coerce.number().prefault(1),
  效果: z.record(z.string(), z.string()).prefault({}),
  描述: z.string().prefault(''),
  位置: z.string().prefault('储物袋'),
  气血: z.coerce.number().prefault(0),
  灵气: z.coerce.number().prefault(0),
  遁速: z.coerce.number().prefault(0),
  命中: z.coerce.number().prefault(0),
  攻击力: z.coerce.number().prefault(0),
  防御力: z.coerce.number().prefault(0),
}).prefault({});

// 储物空间
const Storage = z.object({
  灵石: z.coerce.number().prefault(0),
  物品: z.record(z.string(), Item).prefault({}),
  法宝: z.record(z.string(), CombatUnit).prefault({}),
  傀儡: z.record(z.string(), CombatUnit).prefault({}),
  灵兽: z.record(z.string(), CombatUnit).prefault({}),
}).prefault({});

// 状态
const Status = z.object({
  气血: z.object({
    现值: z.coerce.number().transform(n => _.clamp(n, 0, Infinity)).prefault(100),
    上限: z.coerce.number().transform(n => _.clamp(n, 1, Infinity)).prefault(100),
  }).prefault({}),
  灵力: z.object({
    现值: z.coerce.number().transform(n => _.clamp(n, 0, Infinity)).prefault(100),
    上限: z.coerce.number().transform(n => _.clamp(n, 1, Infinity)).prefault(100),
  }).prefault({}),
  遁速: z.coerce.number().transform(n => _.clamp(n, 0, Infinity)).prefault(10),
}).prefault({});

/* ═══════════════════════════════════════════
 *  NPC 角色结构
 * ═══════════════════════════════════════════ */
const NpcCharacter = z.object({
  头像: z.string().prefault(''),
  在场: z.boolean().prefault(true),
  种族: z.string().prefault('人族'),
  身份: z.array(z.string()).prefault([]),
  境界: z.string().prefault('炼气初期'),
  寿元: z.string().prefault('0/0'),
  灵根: z.string().prefault(''),
  体质: z.object({
    名称: z.string().prefault('凡体'),
    描述: z.string().prefault(''),
    悟性: z.coerce.number().prefault(1),
    根骨: z.coerce.number().prefault(1),
  }).prefault({}),
  技艺: Skill,
  状态: Status,
  状态效果: Buff,
  功法: z.record(z.string(), Cultivation).prefault({}),
  储物空间: Storage,
  性格: z.string().prefault(''),
  外貌: z.string().prefault(''),
  着装: z.string().prefault(''),
  道侣: z.boolean().prefault(false),
  好感度: z.coerce.number().transform(n => _.clamp(n, -100, 100)).prefault(0),
}).prefault({});

/* ═══════════════════════════════════════════
 *  主 Schema
 * ═══════════════════════════════════════════ */
export const Schema = z.object({
  基本信息: z.object({
    姓名: z.string().prefault('无名'),
    头像: z.string().prefault(''),
    寿元: z.string().prefault('16/80'),
    种族: z.string().prefault('人族'),
    灵根: z.string().prefault(''),
    体质: z.object({
      名称: z.string().prefault('凡体'),
      描述: z.string().prefault(''),
      悟性: z.coerce.number().prefault(1),
      根骨: z.coerce.number().prefault(1),
    }).prefault({}),
    境界: z.object({
      当前境界: z.string().prefault('凡人'),
      进度: z.string().prefault('0/100'),
    }).prefault({}),
    技艺: Skill,
    状态: Status,
    地点: z.object({
      世界: z.string().prefault('灵界'),
      地域: z.string().prefault('中原'),
      具体地点: z.string().prefault('荒野'),
    }).prefault({}),
    时间: z.object({
      年: z.coerce.number().prefault(1),
      月: z.coerce.number().transform(n => _.clamp(n, 1, 12)).prefault(1),
      日: z.coerce.number().transform(n => _.clamp(n, 1, 30)).prefault(1),
      时辰: z.string().prefault('卯时'),
    }).prefault({}),
    状态效果: Buff,
  }).prefault({}),
  修炼功法: z.record(z.string(), Cultivation).prefault({}),
  储物空间: Storage,
  关系列表: z.record(z.string(), NpcCharacter).prefault({}),
}).prefault({});

$(() => {
  registerMvuSchema(Schema);
});
