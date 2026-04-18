import { registerMvuSchema } from 'https://testingcf.jsdelivr.net/gh/StageDog/tavern_resource/dist/util/mvu_zod.js';

export const Schema = z.object({
  基本信息: z.object({
    姓名: z.string().prefault('User'),
    灵根: z.string().prefault('凡品'),
    体质: z.string().prefault('凡体'),
    境界: z.string().prefault('凡人'),
    进度: z.coerce.number().transform(n => _.clamp(n, 0, 100)).prefault(0),
    道途: z.string().prefault('未定'),
    状态: z.object({
      气血: z.object({
        现值: z.coerce.number().transform(n => _.clamp(n, 0, Infinity)).prefault(100),
        上限: z.coerce.number().transform(n => _.clamp(n, 1, Infinity)).prefault(100),
      }).prefault({}),
      法力: z.object({
        现值: z.coerce.number().transform(n => _.clamp(n, 0, Infinity)).prefault(100),
        上限: z.coerce.number().transform(n => _.clamp(n, 1, Infinity)).prefault(100),
      }).prefault({}),
      速度: z.coerce.number().transform(n => _.clamp(n, 0, Infinity)).describe('单位：m/s').prefault(10),
      力量: z.coerce.number().transform(n => _.clamp(n, 0, Infinity)).describe('单位：牛顿(N)').prefault(500),
      施法系数: z.coerce.number().transform(n => _.clamp(n, 0.1, Infinity)).describe('单位：赫兹(Hz)').prefault(0.1),
    }).prefault({}),
    地点: z.object({
      地域: z.string().prefault('中原'),
      具体地点: z.string().prefault('荒野'),
    }).prefault({}),
    时间: z.object({
      年: z.coerce.number().prefault(1),
      月: z.coerce.number().transform(n => _.clamp(n, 1, 12)).prefault(1),
      日: z.coerce.number().transform(n => _.clamp(n, 1, 30)).prefault(1),
      时刻: z.string().prefault('08:00'),
    }).prefault({}),
  }).prefault({}),

  修炼功法: z.object({
    主修: z.object({
      名称: z.string().prefault('无'),
      描述: z.string().prefault(''),
    }).prefault({}),
    辅修: z.record(z.string(), z.string().describe('功法详情')).prefault({}),
  }).prefault({}),

  储物空间: z.object({
    货币: z.record(z.string(), z.coerce.number().prefault(0)).prefault({}),
    法宝: z.record(z.string(), z.object({
      品阶: z.string().prefault('凡品'),
      描述: z.string().prefault(''),
    }).prefault({})).prefault({}),
    丹药: z.record(z.string(), z.coerce.number().prefault(0)).prefault({}),
    符箓: z.record(z.string(), z.coerce.number().prefault(0)).prefault({}),
    其它: z.record(z.string(), z.coerce.number().prefault(0)).prefault({}),
  }).prefault({}),

  社交关系: z.object({
    当前互动: z.record(z.string(), z.object({
      境界: z.string().prefault('未知'),
      好感度: z.coerce.number().transform(n => _.clamp(n, -100, 100)).prefault(0),
      态度: z.string().prefault('中立'),
      当前状态: z.string().prefault('正常'),
      心绪: z.string().prefault('平静'),
    }).prefault({})).prefault({}),
    道侣: z.record(z.string(), z.object({
      境界: z.string().prefault('未知'),
      好感度: z.coerce.number().transform(n => _.clamp(n, -100, 100)).prefault(0),
      态度: z.string().prefault('爱慕'),
    }).prefault({})).prefault({}),
    仇敌: z.record(z.string(), z.object({
      境界: z.string().prefault('未知'),
      好感度: z.coerce.number().transform(n => _.clamp(n, -100, 100)).prefault(0),
      态度: z.string().prefault('仇恨'),
    }).prefault({})).prefault({}),
  }).prefault({}),

  谋划策略: z.object({
    积极: z.string().prefault('无'),
    合理: z.string().prefault('无'),
    消极: z.string().prefault('无'),
    幽默: z.string().prefault('无'),
  }).prefault({}),
});

$(() => {
  registerMvuSchema(Schema);
})
